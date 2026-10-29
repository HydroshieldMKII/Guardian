import { ArrowUpDown, Check, EyeOff, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scrollEdgeMask, useScrollEdges } from "@/hooks/use-scroll-edges";
import { pluralize } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./SharedComponents";
import { groupName, type UserDeviceGroup } from "./user-group";

export type UserSort =
  "username" | "deviceCount" | "pendingCount" | "lastSeen" | "streamCount";

export type UserFilter = "all" | "waiting" | "blocked";

export const SORT_LABEL: Record<UserSort, string> = {
  username: "Username",
  deviceCount: "Device count",
  pendingCount: "Pending count",
  lastSeen: "Last stream",
  streamCount: "Stream count",
};

export const matchesFilter = (group: UserDeviceGroup, filter: UserFilter) =>
  filter === "waiting"
    ? group.pendingCount > 0
    : filter === "blocked"
      ? group.rejectedCount > 0
      : true;

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "blocked", label: "Blocked" },
];

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2.5">
      <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

interface UserListProps {
  groups: UserDeviceGroup[];
  allGroups: UserDeviceGroup[];
  loading: boolean;
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  pendingCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filter: UserFilter;
  onFilterChange: (filter: UserFilter) => void;
  sortBy: UserSort;
  onSortByChange: (sort: UserSort) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (order: "asc" | "desc") => void;
  onShowHidden: () => void;
  className?: string;
}

export function UserList({
  groups,
  allGroups,
  loading,
  selectedUserId,
  onSelect,
  searchTerm,
  onSearchChange,
  filter,
  onFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onShowHidden,
  pendingCount,
  refreshing,
  onRefresh,
  className,
}: UserListProps) {
  const { ref: scrollRef, edges } = useScrollEdges<HTMLDivElement>(
    `${loading}:${groups.length}`,
  );
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
        className,
      )}
    >
      <div className="space-y-3 border-b p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by user or device"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
              aria-label="Search by user or device"
            />
          </div>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors",
                filter === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto size-7 px-0"
                title={`Sorted by ${SORT_LABEL[sortBy]?.toLowerCase()}`}
              >
                <span className="sr-only">Sort users</span>
                <ArrowUpDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Sort by
              </DropdownMenuLabel>
              {(Object.keys(SORT_LABEL) as UserSort[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => onSortByChange(key)}
                >
                  <Check
                    className={cn(sortBy === key ? "opacity-100" : "opacity-0")}
                  />
                  {SORT_LABEL[key]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {(["asc", "desc"] as const).map((order) => (
                <DropdownMenuItem
                  key={order}
                  onSelect={() => onSortOrderChange(order)}
                >
                  <Check
                    className={cn(
                      sortOrder === order ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {order === "asc" ? "Ascending" : "Descending"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto p-1.5",
          scrollEdgeMask(edges),
        )}
      >
        <button
          type="button"
          aria-current={!selectedUserId || undefined}
          onClick={() => onSelect(null)}
          className={cn(
            "mb-1 hidden w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors lg:flex",
            !selectedUserId ? "bg-accent" : "hover:bg-accent/60",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground">
            <Inbox className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              Approval queue
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              New devices from every user
            </span>
          </span>
          {pendingCount > 0 && (
            <span className="tabular shrink-0 rounded-full bg-waiting/12 px-2 text-xs leading-5 font-semibold text-waiting">
              {pendingCount}
              <span className="sr-only"> waiting</span>
            </span>
          )}
        </button>
        <div className="mx-2.5 mb-1 hidden border-t lg:block" />
        {loading && allGroups.length === 0 ? (
          Array.from({ length: 6 }, (_, i) => <UserRowSkeleton key={i} />)
        ) : groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {searchTerm.trim() || filter !== "all"
              ? "No users match"
              : "No users yet. They appear here the first time they stream."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {groups.map((group) => {
              const selected = group.user.userId === selectedUserId;
              return (
                <li key={group.user.userId}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    onClick={() => onSelect(group.user.userId)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                      selected ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <UserAvatar
                      userId={group.user.userId}
                      username={group.user.username}
                      avatarUrl={group.user.preference?.avatarUrl}
                      className="size-9"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {groupName(group)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {pluralize(group.devices.length, "device")}
                        {group.rejectedCount > 0 &&
                          `, ${group.rejectedCount} blocked`}
                      </span>
                    </span>
                    {group.pendingCount > 0 && (
                      <span className="tabular shrink-0 rounded-full bg-waiting/12 px-2 text-xs leading-5 font-semibold text-waiting">
                        {group.pendingCount}
                        <span className="sr-only"> waiting</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t p-1.5">
        <button
          type="button"
          onClick={onShowHidden}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <EyeOff className="size-4" />
          Hidden users
        </button>
      </div>
    </div>
  );
}
