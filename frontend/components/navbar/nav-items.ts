import { MonitorPlay, Settings, Users } from "lucide-react";
import { dashboardHref } from "@/lib/dashboard-view";

export type NavKey = "streams" | "users" | "settings";
export type CountTone = "waiting" | "info";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: typeof Settings;
  count?: number;
  countTone?: CountTone;
  dot?: boolean;
}

export const COUNT_TONE: Record<CountTone, string> = {
  waiting: "bg-waiting text-white dark:text-background",
  info: "bg-info/15 text-info",
};

export const badgeCount = ({ count, countTone }: NavItem) =>
  count !== undefined && count > 0 && countTone ? count : null;

export function navItems({
  pendingDevices,
  activeStreams,
  versionMismatch,
  plexConfigured,
}: {
  pendingDevices: number;
  activeStreams: number;
  versionMismatch: boolean;
  plexConfigured: boolean;
}): NavItem[] {
  const sections: NavItem[] = [
    {
      key: "users",
      label: "Users",
      href: dashboardHref("users"),
      icon: Users,
      count: pendingDevices,
      countTone: "waiting",
    },
    {
      key: "streams",
      label: "Streams",
      href: dashboardHref("streams"),
      icon: MonitorPlay,
      count: activeStreams,
      countTone: "info",
    },
  ];
  return [
    ...(plexConfigured ? sections : []),
    {
      key: "settings",
      label: "Settings",
      href: "/settings",
      icon: Settings,
      dot: versionMismatch,
    },
  ];
}
