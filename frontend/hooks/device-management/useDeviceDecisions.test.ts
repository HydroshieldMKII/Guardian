import { act, renderHook } from "@testing-library/react";
import { useDeviceDecisions } from "@/hooks/device-management/useDeviceDecisions";
import type { UserDevice } from "@/types";

const actions = {
  approveDevice: jest.fn<Promise<boolean>, [number]>(),
  rejectDevice: jest.fn<Promise<boolean>, [number]>(),
  deleteDevice: jest.fn<Promise<boolean>, [number]>(),
  revokeTemporaryAccess: jest.fn<Promise<boolean>, [number]>(),
  setPendingDevice: jest.fn<Promise<boolean>, [number]>(),
  renameDevice: jest.fn<Promise<boolean>, [number, string]>(),
  grantTemporaryAccess: jest.fn<Promise<boolean>, unknown[]>(),
  grantBatchTemporaryAccess: jest.fn<
    Promise<{ success: boolean; results?: unknown }>,
    unknown[]
  >(),
};
jest.mock("@/hooks/device-management/useDeviceActions", () => ({
  useDeviceActions: () => actions,
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 7,
  userId: "u-1",
  deviceIdentifier: "device-1",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 0,
  ...overrides,
});

const setup = () => {
  const callbacks = {
    refresh: jest.fn().mockResolvedValue(undefined),
    onPendingSet: jest.fn(),
    onRenamed: jest.fn(),
    onAccessGranted: jest.fn(),
  };
  const { result } = renderHook(() => useDeviceDecisions(callbacks));
  return { result, ...callbacks };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  [
    actions.approveDevice,
    actions.rejectDevice,
    actions.deleteDevice,
    actions.revokeTemporaryAccess,
    actions.setPendingDevice,
  ].forEach((action) => action.mockResolvedValue(true));
  actions.renameDevice.mockResolvedValue(true);
  actions.grantTemporaryAccess.mockResolvedValue(true);
  actions.grantBatchTemporaryAccess.mockResolvedValue({ success: true });
});

afterEach(() => jest.useRealTimers());

describe("useDeviceDecisions", () => {
  it.each([
    ["approved", "Reject device", "rejectDevice"],
    ["pending", "Approve device", "approveDevice"],
    ["rejected", "Approve device", "approveDevice"],
  ] as const)(
    "turns a toggle on a %s device into the opposite decision",
    async (status, title, action) => {
      const { result } = setup();

      act(() => result.current.confirmToggle(device({ status })));
      expect(result.current.confirmAction).toMatchObject({
        action: "toggle",
        title,
      });

      await act(() => result.current.runConfirmedAction());

      expect(actions[action]).toHaveBeenCalledWith(7);
      expect(result.current.confirmAction).toBeNull();
    },
  );

  it("refreshes shortly after a decision goes through", async () => {
    const { result, refresh } = setup();

    act(() => result.current.confirmDelete(device()));
    await act(() => result.current.runConfirmedAction());

    expect(refresh).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(100));
    expect(refresh).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Device deleted" }),
    );
  });

  it("closes the confirmation quietly when the server refuses", async () => {
    actions.revokeTemporaryAccess.mockResolvedValue(false);
    const { result, refresh } = setup();

    act(() => result.current.confirmRemoveTemporaryAccess(device()));
    await act(() => result.current.runConfirmedAction());
    act(() => jest.advanceTimersByTime(100));

    expect(result.current.confirmAction).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("does nothing when there is nothing to confirm", async () => {
    const { result } = setup();

    await act(() => result.current.runConfirmedAction());

    expect(actions.approveDevice).not.toHaveBeenCalled();
  });

  it("can drop a pending confirmation", () => {
    const { result } = setup();

    act(() => result.current.confirmApprove(device()));
    act(() => result.current.cancelConfirmation());

    expect(result.current.confirmAction).toBeNull();
  });

  it("reports a rename back", async () => {
    const { result, onRenamed } = setup();

    await act(() => result.current.rename(7, "Kitchen"));

    expect(actions.renameDevice).toHaveBeenCalledWith(7, "Kitchen");
    expect(onRenamed).toHaveBeenCalledWith(7, "Kitchen");
  });

  it("leaves a refused rename alone", async () => {
    actions.renameDevice.mockResolvedValue(false);
    const { result, onRenamed } = setup();

    await act(() => result.current.rename(7, "Kitchen"));

    expect(onRenamed).not.toHaveBeenCalled();
  });

  it("tells the caller when a device goes back to pending", async () => {
    const { result, onPendingSet } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.setPending(7);
    });

    expect(success).toBe(true);
    expect(onPendingSet).toHaveBeenCalled();
  });

  it("grants one device through the single endpoint", async () => {
    const { result, onAccessGranted } = setup();

    await act(() => result.current.grantTemporaryAccess([7], 60, true));

    expect(actions.grantTemporaryAccess).toHaveBeenCalledWith(7, 60, true);
    expect(onAccessGranted).toHaveBeenCalled();
  });

  it("grants several devices in one batch and flags the ones that failed", async () => {
    actions.grantBatchTemporaryAccess.mockResolvedValue({
      success: true,
      results: [{ success: true }, { success: false }],
    });
    const { result } = setup();

    await act(() => result.current.grantTemporaryAccess([7, 8], 30));

    expect(actions.grantBatchTemporaryAccess).toHaveBeenCalledWith(
      [7, 8],
      30,
      undefined,
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Some devices were not granted access",
      }),
    );
  });
});
