import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceFocus } from "@/components/device-management/UserDetail";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";

const DEVICE_LOOKUP_ATTEMPTS = 20;
const DEVICE_LOOKUP_RETRY_MS = 100;

const findDeviceElement = (deviceIdentifier: string) =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-device-identifier]"),
  ).find((element) => element.dataset.deviceIdentifier === deviceIdentifier);

export const useDeviceFocus = (
  selectedUserId: string | null,
  selectUser: (userId: string) => void,
) => {
  const [deviceFocus, setDeviceFocus] = useState<DeviceFocus | null>(null);
  const latest = useRef({ selectedUserId, selectUser });

  useEffect(() => {
    latest.current = { selectedUserId, selectUser };
  });

  const focusDevice = useCallback(
    (userId: string, deviceIdentifier: string, onDone?: () => void) => {
      const wasSelected = latest.current.selectedUserId === userId;
      if (!wasSelected) {
        latest.current.selectUser(userId);
      }
      setDeviceFocus({ deviceIdentifier });

      const highlightDevice = (attempt: number) => {
        const deviceElement = findDeviceElement(deviceIdentifier);
        if (!deviceElement) {
          if (attempt < DEVICE_LOOKUP_ATTEMPTS) {
            setTimeout(
              () => highlightDevice(attempt + 1),
              DEVICE_LOOKUP_RETRY_MS,
            );
          } else {
            onDone?.();
          }
          return;
        }

        deviceElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        setTimeout(() => {
          deviceElement.classList.add(...HIGHLIGHT_CLASSES);
          setTimeout(() => {
            deviceElement.classList.remove(...HIGHLIGHT_CLASSES);
            onDone?.();
          }, 1500);
        }, 200);
      };

      setTimeout(() => highlightDevice(1), wasSelected ? 100 : 400);
    },
    [],
  );

  return { deviceFocus, setDeviceFocus, focusDevice };
};
