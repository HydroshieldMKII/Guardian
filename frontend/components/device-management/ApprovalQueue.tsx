import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/entity";
import { formatAgo } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { UserDevice } from "@/types";
import { UserAvatar } from "./SharedComponents";
import { groupName, type UserDeviceGroup } from "./user-group";

export interface QueueItem {
  device: UserDevice;
  group: UserDeviceGroup;
}

const COMPACT_LIMIT = 3;

export function ApprovalQueue({
  items,
  actionLoading,
  onApprove,
  onReject,
  onOpenDevice,
  className,
}: {
  items: QueueItem[];
  actionLoading: number | null;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onOpenDevice: (userId: string, deviceIdentifier: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const foldedOnSmallScreens = (index: number) =>
    !expanded && index >= COMPACT_LIMIT;

  if (items.length === 0) {
    return (
      <section
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-input px-6 py-6 text-center lg:py-20",
          className,
        )}
      >
        <div>
          <h2 className="inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <StatusMark tone="positive" className="size-3.5" />
            Nothing waiting for approval
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            New devices show up here the first time they stream.
            <span className="hidden lg:inline">
              {" "}
              Pick a user to see their devices and rules.
            </span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5">
        <StatusMark tone="warning" className="size-3.5" />
        <h2 className="text-[15px] font-semibold text-foreground">
          Waiting for approval
        </h2>
      </header>
      <ul className="divide-y divide-border/70">
        {items.map(({ device, group }, index) => {
          const busy = actionLoading === device.id;
          return (
            <li
              key={device.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3.5 sm:px-5",
                foldedOnSmallScreens(index) && "hidden lg:flex",
              )}
            >
              <button
                type="button"
                onClick={() =>
                  onOpenDevice(group.user.userId, device.deviceIdentifier)
                }
                className="flex min-w-0 flex-1 basis-56 cursor-pointer items-center gap-3 text-left"
                title={`Show in ${groupName(group)}`}
              >
                <UserAvatar
                  userId={group.user.userId}
                  username={group.user.username}
                  avatarUrl={group.user.preference?.avatarUrl}
                  className="size-9"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <span className="truncate">
                      {device.deviceName || "Unknown"}
                    </span>
                    {device.requestDescription &&
                      device.requestSubmittedAt &&
                      !device.requestNoteReadAt && (
                        <MessageSquareText
                          aria-label="Has a note from the user"
                          className="size-3.5 shrink-0 text-waiting"
                        />
                      )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {groupName(group)},{" "}
                    {[device.deviceProduct, device.devicePlatform]
                      .filter(Boolean)
                      .join(" on ") || "Unknown device"}
                    , seen {formatAgo(device.lastSeen)}
                  </span>
                </span>
              </button>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onReject(device)}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onApprove(device)}
                >
                  Approve
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > COMPACT_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full cursor-pointer rounded-b-2xl border-t px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground lg:hidden"
        >
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
