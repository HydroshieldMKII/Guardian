import { act, renderHook } from "@testing-library/react";
import { useDeviceRename } from "@/hooks/device-management/useDeviceRename";
import type { UserDevice } from "@/types";

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

describe("useDeviceRename", () => {
  it("starts from the current name and clears on cancel", () => {
    const { result } = renderHook(() => useDeviceRename());

    act(() => result.current.startEditing(device()));
    expect(result.current.editingDevice).toBe(7);
    expect(result.current.newDeviceName).toBe("Living Room TV");

    act(() => result.current.setNewDeviceName("Bedroom TV"));
    expect(result.current.newDeviceName).toBe("Bedroom TV");

    act(() => result.current.cancelEditing());
    expect(result.current.editingDevice).toBeNull();
    expect(result.current.newDeviceName).toBe("");
  });

  it("starts empty for a device without a name", () => {
    const { result } = renderHook(() => useDeviceRename());

    act(() => result.current.startEditing(device({ deviceName: "" })));

    expect(result.current.newDeviceName).toBe("");
  });
});
