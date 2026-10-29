import { act, renderHook } from "@testing-library/react";
import { useSetDevicePending } from "@/hooks/device-management/useSetDevicePending";
import type { UserDevice } from "@/types";

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const device: UserDevice = {
  id: 7,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  approved: true,
  status: "approved",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 0,
};

const onSetPending = jest.fn<Promise<boolean>, [number]>();
const onDeviceUpdate = jest.fn();
const onDone = jest.fn();

const setup = (withHandler = true) =>
  renderHook(() =>
    useSetDevicePending({
      device,
      onSetPending: withHandler ? onSetPending : undefined,
      onDeviceUpdate,
      onDone,
    }),
  );

const run = async (result: ReturnType<typeof setup>["result"]) => {
  await act(async () => {
    await result.current.setPending();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useSetDevicePending", () => {
  it("does nothing without a handler", async () => {
    const { result } = setup(false);

    await run(result);

    expect(toast).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("moves the device back to pending and closes", async () => {
    onSetPending.mockResolvedValue(true);
    const { result } = setup();

    await run(result);

    expect(onSetPending).toHaveBeenCalledWith(7);
    expect(onDeviceUpdate).toHaveBeenCalledWith({
      ...device,
      status: "pending",
    });
    expect(onDone).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Device set to pending" }),
    );
    expect(result.current.saving).toBe(false);
  });

  it("reports a refused change and stays open", async () => {
    onSetPending.mockResolvedValue(false);
    const { result } = setup();

    await run(result);

    expect(toast).toHaveBeenCalledWith({
      title: "Error",
      description: "Failed to set device to pending",
      variant: "destructive",
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("Device not found"), "Device not found"],
    ["offline", "Failed to set device to pending"],
  ])("reports a failure (%s)", async (error, description) => {
    onSetPending.mockRejectedValue(error);
    const { result } = setup();

    await run(result);

    expect(toast).toHaveBeenCalledWith({
      title: "Error",
      description,
      variant: "destructive",
    });
    expect(result.current.saving).toBe(false);
  });
});
