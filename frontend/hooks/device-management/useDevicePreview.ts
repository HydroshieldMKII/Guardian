import { useEffect, useState } from "react";
import type { DeviceFocus } from "@/components/device-management/user-group";
import { isWaitingDevice } from "@/lib/device-policies";
import type { UserDevice } from "@/types";

export const DEVICE_PREVIEW = 5;
export const MIN_HIDDEN_DEVICES = 3;

export function useDevicePreview(
  devices: UserDevice[],
  deviceFocus?: DeviceFocus | null,
) {
  const [showAll, setShowAll] = useState(false);
  const overflow = devices.slice(DEVICE_PREVIEW);
  const collapsible =
    overflow.length >= MIN_HIDDEN_DEVICES && !overflow.some(isWaitingDevice);
  const focusedDeviceHidden = overflow.some(
    (device) => device.deviceIdentifier === deviceFocus?.deviceIdentifier,
  );

  useEffect(() => {
    if (focusedDeviceHidden) setShowAll(true);
  }, [deviceFocus, focusedDeviceHidden]);

  return {
    collapsible,
    showAll,
    toggle: () => setShowAll((value) => !value),
    visible:
      collapsible && !showAll ? devices.slice(0, DEVICE_PREVIEW) : devices,
  };
}
