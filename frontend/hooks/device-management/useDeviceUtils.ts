import { UserDevice } from "@/types";

export const useDeviceUtils = () => {
  const hasTemporaryAccess = (device: UserDevice): boolean => {
    if (!device.temporaryAccessUntil) {
      return false;
    }
    const now = new Date();
    const expiresAt = new Date(device.temporaryAccessUntil);
    return expiresAt > now;
  };

  const getTemporaryAccessTimeLeft = (device: UserDevice): string | null => {
    if (!device.temporaryAccessUntil) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(device.temporaryAccessUntil);
    const timeLeft = expiresAt.getTime() - now.getTime();

    if (timeLeft <= 0) {
      return "Expired";
    }

    const totalMinutes = Math.ceil(timeLeft / (60 * 1000));

    // Calculate time units
    const weeks = Math.floor(totalMinutes / (7 * 24 * 60));
    const days = Math.floor((totalMinutes % (7 * 24 * 60)) / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    // Build formatted string with only non-zero values
    const parts = [];
    if (weeks > 0) parts.push(`${weeks}w`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    // If no parts, it means less than 1 minute
    if (parts.length === 0) {
      return "< 1m";
    }

    // Return up to 3 most significant parts for readability
    return parts.slice(0, 3).join(" ");
  };

  // Convert duration value and unit to minutes
  const convertToMinutes = (
    value: number,
    unit: "minutes" | "hours" | "days" | "weeks",
  ): number => {
    if (value <= 0) return 1; // Minimum 1 minute

    switch (unit) {
      case "minutes":
        return Math.round(value);
      case "hours":
        return Math.round(value * 60);
      case "days":
        return Math.round(value * 60 * 24);
      case "weeks":
        return Math.round(value * 60 * 24 * 7);
      default:
        return Math.round(value);
    }
  };

  // Format duration for display
  const formatDuration = (
    value: number,
    unit: "minutes" | "hours" | "days" | "weeks",
  ): string => {
    if (value === 1) {
      return `1 ${unit.slice(0, -1)}`; // Remove 's' for singular
    }
    return `${value} ${unit}`;
  };

  // Validate if duration is reasonable (not more than 1 year)
  const isValidDuration = (
    value: number,
    unit: "minutes" | "hours" | "days" | "weeks",
  ): boolean => {
    if (value <= 0) return false; // Invalid if empty or zero
    const totalMinutes = convertToMinutes(value, unit);
    const oneYearInMinutes = 365 * 24 * 60; // 525,600 minutes
    return totalMinutes > 0 && totalMinutes <= oneYearInMinutes;
  };

  return {
    hasTemporaryAccess,
    getTemporaryAccessTimeLeft,
    convertToMinutes,
    formatDuration,
    isValidDuration,
  };
};
