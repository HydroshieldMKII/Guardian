import { UserDevice } from "@/types";
import {
  hasTemporaryAccess,
  temporaryAccessTimeLeft,
} from "@/lib/device-policies";
import { DurationUnit, formatUnitCount, toMinutes } from "@/lib/duration";

export const useDeviceUtils = () => {
  const getTemporaryAccessTimeLeft = (device: UserDevice): string | null =>
    temporaryAccessTimeLeft(device);

  const convertToMinutes = (value: number, unit: DurationUnit): number =>
    toMinutes(value, unit);

  const formatDuration = (value: number, unit: DurationUnit): string =>
    formatUnitCount(value, unit);

  const isValidDuration = (value: number, unit: DurationUnit): boolean =>
    value > 0 && toMinutes(value, unit) > 0;

  return {
    hasTemporaryAccess,
    getTemporaryAccessTimeLeft,
    convertToMinutes,
    formatDuration,
    isValidDuration,
  };
};
