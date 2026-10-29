import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/entity";
import { RefreshButton } from "@/components/ui/refresh-button";
import type { AppFilter } from "@/lib/session-history";
import { cn } from "@/lib/utils";

const APP_FILTERS: { value: AppFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "plex", label: "Plex" },
  { value: "plexamp", label: "Plexamp" },
];

export function SessionHistoryFilters({
  searchTerm,
  onSearchChange,
  refreshing,
  refreshDisabled,
  onRefresh,
  appFilter,
  onAppFilterChange,
  terminatedOnly,
  onTerminatedOnlyChange,
}: {
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  refreshing: boolean;
  refreshDisabled: boolean;
  onRefresh: () => void;
  appFilter: AppFilter;
  onAppFilterChange: (appFilter: AppFilter) => void;
  terminatedOnly: boolean;
  onTerminatedOnlyChange: (terminatedOnly: boolean) => void;
}) {
  const canFilterTerminated = appFilter !== "plexamp";

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by title, device or IP address"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1"
        />
        <RefreshButton
          refreshing={refreshing}
          disabled={refreshDisabled}
          onRefresh={onRefresh}
          className="size-9"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          options={APP_FILTERS}
          value={appFilter}
          onChange={onAppFilterChange}
        />
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity duration-200",
            !canFilterTerminated && "opacity-50",
          )}
          title={
            canFilterTerminated
              ? undefined
              : "Plexamp streams are never terminated"
          }
        >
          <Switch
            id="terminated-filter"
            checked={terminatedOnly}
            onCheckedChange={onTerminatedOnlyChange}
            disabled={!canFilterTerminated}
            className="cursor-pointer disabled:cursor-not-allowed"
          />
          <Label
            htmlFor="terminated-filter"
            className="whitespace-nowrap text-sm text-muted-foreground"
          >
            Terminated only
          </Label>
        </div>
      </div>
    </div>
  );
}
