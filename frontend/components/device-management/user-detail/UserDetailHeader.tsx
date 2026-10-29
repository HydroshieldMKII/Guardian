import { ChevronLeft, EyeOff, History, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAgo, pluralize } from "@/lib/duration";
import { UserAvatar } from "../SharedComponents";
import { groupName, type UserDeviceGroup } from "../user-group";

const summaryOf = (group: UserDeviceGroup) =>
  [
    pluralize(group.devices.length, "device"),
    group.pendingCount > 0 ? `${group.pendingCount} waiting` : null,
    group.lastSeen ? `last seen ${formatAgo(group.lastSeen)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

export function UserDetailHeader({
  group,
  onBack,
  onShowHistory,
  onHide,
}: {
  group: UserDeviceGroup;
  onBack: () => void;
  onShowHistory: () => void;
  onHide: () => void;
}) {
  const { userId, username, preference } = group.user;
  const name = groupName(group);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
      >
        <ChevronLeft className="size-4" />
        Back
      </button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <UserAvatar
          userId={userId}
          username={username}
          avatarUrl={preference?.avatarUrl}
          className="size-14 text-sm"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold tracking-[-0.01em] text-foreground">
            {name}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {summaryOf(group)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onShowHistory}
            title="Browse everything this user has streamed"
          >
            <History />
            History
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="size-8 px-0">
                <span className="sr-only">More for {name}</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={onHide}>
                <EyeOff />
                Hide user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
