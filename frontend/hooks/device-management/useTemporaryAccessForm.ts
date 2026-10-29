import { useEffect, useState } from "react";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import {
  MAX_TEMPORARY_ACCESS_MINUTES,
  type DurationUnit,
} from "@/lib/duration";
import type { UserDevice } from "@/types";

export type ExpiryMode = "duration" | "calendar";

export type GrantAccess = (
  deviceIds: number[],
  durationMinutes: number,
  bypassPolicies?: boolean,
) => void;

const MINUTE_MS = 60 * 1000;

const withinMaximum = (minutes: number) =>
  minutes <= MAX_TEMPORARY_ACCESS_MINUTES;

export function useTemporaryAccessForm(
  isOpen: boolean,
  eligibleDevices: UserDevice[],
) {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");
  const [bypassPolicies, setBypassPolicies] = useState(false);
  const [mode, setMode] = useState<ExpiryMode>("duration");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const { convertToMinutes, isValidDuration } = useDeviceUtils();

  useEffect(() => {
    if (!isOpen) return;
    setSelectedDeviceIds([]);
    setDurationValue(1);
    setDurationUnit("hours");
    setBypassPolicies(false);
    setMode("duration");
    setSelectedDate(undefined);
  }, [isOpen]);

  const durationValid = isValidDuration(durationValue, durationUnit);

  const durationExpiry = () => {
    if (durationValue <= 0 || !durationValid) return null;
    const minutes = convertToMinutes(durationValue, durationUnit);
    return withinMaximum(minutes)
      ? new Date(Date.now() + minutes * MINUTE_MS)
      : null;
  };

  const dateInPast =
    selectedDate !== undefined && selectedDate.getTime() <= Date.now();

  const dateTooFar =
    selectedDate !== undefined &&
    !withinMaximum(
      Math.ceil((selectedDate.getTime() - Date.now()) / MINUTE_MS),
    );

  const expiry =
    mode === "calendar"
      ? selectedDate && !dateInPast && !dateTooFar
        ? selectedDate
        : null
      : durationExpiry();

  const allSelected =
    eligibleDevices.length > 0 &&
    selectedDeviceIds.length === eligibleDevices.length;

  const toggleDevice = (deviceId: number) =>
    setSelectedDeviceIds((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId],
    );

  const toggleAll = () =>
    setSelectedDeviceIds(
      selectedDeviceIds.length === eligibleDevices.length
        ? []
        : eligibleDevices.map((device) => device.id),
    );

  const chooseDuration = (value: number, unit: DurationUnit) => {
    setDurationValue(value);
    setDurationUnit(unit);
  };

  const grant = (onGrant: GrantAccess) => {
    if (selectedDeviceIds.length === 0 || !expiry) return;
    const minutes =
      mode === "calendar"
        ? Math.ceil((expiry.getTime() - Date.now()) / MINUTE_MS)
        : convertToMinutes(durationValue, durationUnit);
    onGrant(selectedDeviceIds, minutes, bypassPolicies);
  };

  return {
    selectedDeviceIds,
    allSelected,
    toggleDevice,
    toggleAll,
    mode,
    setMode,
    durationValue,
    setDurationValue,
    durationUnit,
    setDurationUnit,
    chooseDuration,
    selectedDate,
    setSelectedDate,
    bypassPolicies,
    setBypassPolicies,
    expiry,
    durationValid,
    durationInvalid: mode === "duration" && durationValue <= 0,
    dateInPast: mode === "calendar" && dateInPast,
    dateTooFar: mode === "calendar" && dateTooFar,
    durationTooLarge:
      mode === "duration" && durationValue > 0 && durationValid && !expiry,
    grant,
  };
}
