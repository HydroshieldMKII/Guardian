"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DashboardTab = "devices" | "streams";

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  pendingDevices: number;
  activeStreams: number;
}

export function DashboardTabs({
  activeTab,
  onTabChange,
  pendingDevices,
  activeStreams,
}: DashboardTabsProps) {
  return (
    <div className="flex w-full space-x-1 rounded-lg bg-muted p-1 sm:p-1.5 lg:w-fit">
      <Button
        variant={activeTab === "devices" ? "default" : "ghost"}
        onClick={() => onTabChange("devices")}
        className="relative min-w-0 flex-1 px-2 py-2 text-xs font-medium sm:px-4 sm:py-2.5 sm:text-sm lg:flex-none lg:px-8"
      >
        <span className="hidden truncate sm:inline">Device Management</span>
        <span className="truncate sm:hidden">Devices</span>
        {pendingDevices > 0 && (
          <Badge
            variant="destructive"
            className="ml-1 h-4 min-w-4 flex-shrink-0 bg-red-600 text-[10px] text-white sm:ml-2 sm:h-5 sm:min-w-5 sm:text-xs dark:bg-red-700"
          >
            {pendingDevices}
          </Badge>
        )}
      </Button>
      <Button
        variant={activeTab === "streams" ? "default" : "ghost"}
        onClick={() => onTabChange("streams")}
        className="relative min-w-0 flex-1 px-2 py-2 text-xs font-medium sm:px-4 sm:py-2.5 sm:text-sm lg:flex-none lg:px-8"
      >
        <span className="hidden truncate sm:inline">Active Streams</span>
        <span className="truncate sm:hidden">Streams</span>
        {activeStreams > 0 && (
          <Badge
            variant="default"
            className="ml-1 h-4 min-w-4 flex-shrink-0 bg-blue-600 text-[10px] text-white sm:ml-2 sm:h-5 sm:min-w-5 sm:text-xs dark:bg-blue-700"
          >
            {activeStreams}
          </Badge>
        )}
      </Button>
    </div>
  );
}
