import type { AppSetting, UnifiedDashboardData } from "@/types";

export const appSetting = (key: string, value: string): AppSetting => ({
  id: 1,
  key,
  value,
  description: "",
  type: "string",
  private: false,
  updatedAt: "2026-01-01T00:00:00Z",
});

export const dashboardData = (
  overrides: Partial<UnifiedDashboardData> = {},
): UnifiedDashboardData => ({
  plexStatus: {
    configured: true,
    hasValidCredentials: true,
    connectionStatus: "Connected",
  },
  settings: [],
  sessions: {},
  devices: { all: [], pending: [], approved: [], processed: [] },
  users: [],
  stats: {
    activeStreams: 0,
    totalDevices: 0,
    pendingDevices: 0,
    approvedDevices: 0,
  },
  ...overrides,
});
