import { countWaitingDevices } from "@/lib/device-policies";
import type { UnifiedDashboardData } from "@/types";

export type DashboardView = "streams" | "users";

export interface DashboardCounts {
  pendingDevices: number;
  activeStreams: number;
}

export const dashboardHref = (view: DashboardView) => `/?view=${view}`;

const isDashboardView = (value: string | null): value is DashboardView =>
  value === "streams" || value === "users";

export const resolveDashboardView = (
  requestedView: string | null,
  data: UnifiedDashboardData | undefined,
): DashboardView | null => {
  if (isDashboardView(requestedView)) return requestedView;
  if (!data) return null;
  const defaultPage = data.settings.find(
    (setting) => setting.key === "DEFAULT_PAGE",
  )?.value;
  return defaultPage === "streams" ? "streams" : "users";
};

export const dashboardCounts = (
  data: UnifiedDashboardData | undefined,
): DashboardCounts =>
  data
    ? {
        pendingDevices: countWaitingDevices(data.devices.all, data.users),
        activeStreams: data.stats.activeStreams,
      }
    : { pendingDevices: 0, activeStreams: 0 };
