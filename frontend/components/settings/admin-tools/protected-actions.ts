import { apiClient } from "@/lib/api";

export interface ProtectedAction {
  key: string;
  title: string;
  description: string;
  busyLabel: string;
  confirm: {
    description: string;
    confirmText: string;
    variant: "default" | "destructive";
  };
  password: {
    description: string;
    isDangerous: boolean;
  };
  run: (password: string) => Promise<unknown>;
  success: { title: string; description: string };
  failure: string;
  refreshesSettings: boolean;
  reloads: boolean;
}

export const MAINTENANCE_ACTIONS: ProtectedAction[] = [
  {
    key: "resetStreamCounts",
    title: "Reset stream counts",
    description:
      "Set every device's stream count back to zero. Nothing else about the device changes.",
    busyLabel: "Resetting...",
    confirm: {
      description:
        "Every device's stream count goes back to zero. The devices themselves are kept.",
      confirmText: "Reset stream counts",
      variant: "default",
    },
    password: {
      description: "Enter your password to reset every device's stream count.",
      isDangerous: false,
    },
    run: (password) => apiClient.resetStreamCounts(password),
    success: {
      title: "Stream counts reset",
      description: "Every device's stream count is back to zero.",
    },
    failure: "Failed to reset stream counts",
    refreshesSettings: false,
    reloads: false,
  },
  {
    key: "clearSessionHistory",
    title: "Clear session history",
    description:
      "Permanently delete every session history record. Devices, users and settings are left untouched.",
    busyLabel: "Clearing...",
    confirm: {
      description:
        "Every session history record is deleted for good, for every user. Devices, users and settings are left untouched.",
      confirmText: "Clear session history",
      variant: "destructive",
    },
    password: {
      description:
        "Enter your password to permanently delete every session history record.",
      isDangerous: true,
    },
    run: (password) => apiClient.clearSessionHistory(password),
    success: {
      title: "Session history cleared",
      description: "Every session history record has been deleted.",
    },
    failure: "Failed to clear session history",
    refreshesSettings: false,
    reloads: false,
  },
];

export const DANGER_ACTIONS: ProtectedAction[] = [
  {
    key: "deleteAllDevices",
    title: "Delete all devices",
    description:
      "Permanently delete every device, along with its session history and notifications. Users and application settings are kept, and every device has to be approved again the next time it connects.",
    busyLabel: "Deleting...",
    confirm: {
      description:
        "Every device is deleted for good, along with its session history and notifications. Each one reappears as pending the next time it connects, and per-device settings are lost.",
      confirmText: "Delete all devices",
      variant: "destructive",
    },
    password: {
      description:
        "Enter your password to permanently delete every device. Each one has to be approved again the next time it connects.",
      isDangerous: true,
    },
    run: (password) => apiClient.deleteAllDevices(password),
    success: {
      title: "All devices deleted",
      description:
        "Every device is gone. They reappear as pending the next time they connect.",
    },
    failure: "Failed to delete all devices",
    refreshesSettings: true,
    reloads: false,
  },
  {
    key: "resetDatabase",
    title: "Factory reset",
    description:
      "Permanently delete everything: settings, devices, user preferences, session history and notifications. Everything restarts as a fresh install.",
    busyLabel: "Resetting...",
    confirm: {
      description:
        "Everything is deleted for good: settings, devices, users and session history. It all restarts as a fresh install.",
      confirmText: "Yes, Wipe All Data",
      variant: "destructive",
    },
    password: {
      description:
        "Enter your password to erase all of your data and restore the default settings.",
      isDangerous: true,
    },
    run: (password) => apiClient.resetDatabase(password),
    success: {
      title: "Success",
      description: "Database has been reset successfully. Page will reload.",
    },
    failure: "Failed to reset database",
    refreshesSettings: true,
    reloads: true,
  },
];
