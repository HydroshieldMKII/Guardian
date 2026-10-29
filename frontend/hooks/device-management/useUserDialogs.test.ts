import { act, renderHook } from "@testing-library/react";
import type { UserDeviceGroup } from "@/components/device-management/user-group";
import { useUserDialogs } from "@/hooks/device-management/useUserDialogs";
import type { UserDevice, UserPreference } from "@/types";

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 7,
  userId: "u-1",
  username: "testuser",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  deviceProduct: "Plex for Roku",
  devicePlatform: "Roku",
  approved: true,
  status: "approved",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 0,
  ...overrides,
});

const preference: UserPreference = {
  id: 1,
  userId: "u-2",
  username: "saved-name",
  defaultBlock: null,
  hidden: false,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const group = (
  user: UserDeviceGroup["user"],
  devices: UserDevice[] = [],
): UserDeviceGroup => ({
  user,
  devices,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
});

const GROUPS = [
  group({ userId: "u-1", username: "testuser" }, [device()]),
  group({ userId: "u-2", preference }),
];

const renderDialogs = () => renderHook(() => useUserDialogs(GROUPS));

describe("history", () => {
  it("opens for a known user and closes again", () => {
    const { result } = renderDialogs();

    act(() => result.current.showHistory("u-1"));
    expect(result.current.historyUser).toEqual({
      userId: "u-1",
      username: "testuser",
    });

    act(() => result.current.closeHistory());
    expect(result.current.historyUser).toBeNull();
  });

  it("falls back to the stored preference name", () => {
    const { result } = renderDialogs();

    act(() => result.current.showHistory("u-2"));

    expect(result.current.historyUser?.username).toBe("saved-name");
  });

  it("still opens for a user that is not listed", () => {
    const { result } = renderDialogs();

    act(() => result.current.showHistory("u-9"));

    expect(result.current.historyUser).toEqual({
      userId: "u-9",
      username: undefined,
    });
  });
});

describe("time rules", () => {
  it("opens for a known user and device, then closes", () => {
    const { result } = renderDialogs();

    act(() => result.current.showTimeRules("u-1", "device-1"));
    expect(result.current.timeRuleUser).toEqual({
      userId: "u-1",
      username: "testuser",
      deviceIdentifier: "device-1",
    });

    act(() => result.current.closeTimeRules());
    expect(result.current.timeRuleUser).toBeNull();
  });

  it("ignores an unknown user", () => {
    const { result } = renderDialogs();

    act(() => result.current.showTimeRules("u-9"));

    expect(result.current.timeRuleUser).toBeNull();
  });
});

describe("temporary access", () => {
  it("opens with the user's devices, then closes", () => {
    const { result } = renderDialogs();
    expect(result.current.temporaryAccessDevices).toEqual([]);

    act(() => result.current.showTemporaryAccess("u-1"));
    expect(result.current.temporaryAccessUser).toEqual({
      userId: "u-1",
      username: "testuser",
    });
    expect(result.current.temporaryAccessDevices).toEqual([device()]);

    act(() => result.current.closeTemporaryAccess());
    expect(result.current.temporaryAccessUser).toBeNull();
  });

  it("ignores an unknown user", () => {
    const { result } = renderDialogs();

    act(() => result.current.showTemporaryAccess("u-9"));

    expect(result.current.temporaryAccessUser).toBeNull();
  });

  it("offers no devices once the user drops out of the list", () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useUserDialogs(groups),
      { initialProps: { groups: GROUPS } },
    );
    act(() => result.current.showTemporaryAccess("u-1"));

    rerender({ groups: [] });

    expect(result.current.temporaryAccessDevices).toEqual([]);
  });
});
