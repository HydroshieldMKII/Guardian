import type { PortalDevice, PortalUserRules } from "@/types";

export const portalDevice = (
  overrides: Partial<PortalDevice> = {},
): PortalDevice => ({
  id: 1,
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  devicePlatform: "Android TV",
  deviceProduct: "Plex for Android",
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-02T00:00:00Z",
  hasTemporaryAccess: false,
  excludeFromConcurrentLimit: false,
  ...overrides,
});

export const portalRules = (
  overrides: Partial<PortalUserRules> = {},
): PortalUserRules => ({
  networkPolicy: "both",
  ipAccessPolicy: "all",
  concurrentStreamLimit: null,
  effectiveConcurrentStreamLimit: 0,
  defaultBlock: null,
  effectiveDefaultBlock: false,
  timeRules: [],
  ...overrides,
});
