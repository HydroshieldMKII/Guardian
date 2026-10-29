import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAgoShort } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onRemove: (id: number) => void;
  onClick?: (notification: Notification) => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
  onClick,
}: NotificationItemProps) {
  const openable = Boolean(notification.sessionHistoryId);
  const body = (
    <>
      <p
        className={cn(
          "text-sm leading-snug transition-colors duration-200",
          notification.read ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {notification.text}
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {formatAgoShort(notification.createdAt)}
      </p>
    </>
  );

  return (
    <li className="group relative flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-200",
          notification.read ? "bg-transparent" : "bg-info",
        )}
      />
      {openable ? (
        <button
          type="button"
          onClick={() => onClick?.(notification)}
          title="Open this stream in the user's history"
          className="min-w-0 flex-1 cursor-pointer text-left outline-none after:absolute after:inset-0 focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset"
        >
          {body}
        </button>
      ) : (
        <div
          title="The stream behind this notification is no longer in the history"
          className="min-w-0 flex-1 cursor-default"
        >
          {body}
        </div>
      )}
      <div className="relative z-10 -mr-1.5 -mt-1 flex shrink-0 items-start gap-0.5 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
        {!notification.read && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarkAsRead(notification.id)}
            className="size-8 p-0 text-muted-foreground hover:text-foreground sm:size-7"
            title="Mark as read"
          >
            <Check className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(notification.id)}
          className="size-8 p-0 text-muted-foreground hover:bg-blocked/10 hover:text-blocked sm:size-7"
          title="Delete this notification"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
