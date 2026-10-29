import { act, renderHook } from "@testing-library/react";
import { useTemporaryAccessForm } from "@/hooks/device-management/useTemporaryAccessForm";
import type { UserDevice } from "@/types";

const DEVICES: UserDevice[] = [
  {
    id: 1,
    userId: "u-1",
    deviceIdentifier: "device-1",
    deviceName: "TV",
    devicePlatform: "Roku",
    approved: false,
    status: "pending",
    firstSeen: "2026-01-01T00:00:00Z",
    lastSeen: "2026-01-01T00:00:00Z",
    sessionCount: 1,
  },
];

describe("useTemporaryAccessForm", () => {
  it("grants nothing until a device is selected", () => {
    const onGrant = jest.fn();
    const { result } = renderHook(() => useTemporaryAccessForm(true, DEVICES));

    act(() => result.current.grant(onGrant));

    expect(onGrant).not.toHaveBeenCalled();
  });

  it("grants the selected devices for the chosen duration", () => {
    const onGrant = jest.fn();
    const { result } = renderHook(() => useTemporaryAccessForm(true, DEVICES));
    act(() => result.current.toggleDevice(1));

    act(() => result.current.grant(onGrant));

    expect(onGrant).toHaveBeenCalledWith([1], 60, false);
  });
});
