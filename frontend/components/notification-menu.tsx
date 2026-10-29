"use client";

import { useId, useState } from "react";
import { Bell, X, CheckCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useNotificationContext } from "@/contexts/notification-context";
import { Notification } from "@/types";
import { apiClient } from "@/lib/api";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onRemove: (id: number) => void;
  onClick?: (notification: Notification) => void;
}

const formatDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 2) {
    return "now";
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return `${days}d ago`;
  }
};

function NotificationItem({
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
        {formatDate(notification.createdAt)}
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

export function NotificationMenu() {
  const {
    notifications,
    unreadCount,
    updateNotifications,
    onNotificationClick,
  } = useNotificationContext();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const headingId = useId();

  const markAsRead = async (id: number) => {
    try {
      await apiClient.markNotificationAsRead(id);
      updateNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id
            ? { ...notification, read: true }
            : notification,
        ),
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const removeNotification = async (id: number) => {
    try {
      await apiClient.deleteNotification(id);
      updateNotifications((prev) =>
        prev.filter((notification) => notification.id !== id),
      );
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      updateNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read: true })),
      );
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const clearAll = async () => {
    try {
      await apiClient.clearAllNotifications();
      updateNotifications(() => []);
    } catch (err) {
      console.error("Failed to clear all notifications:", err);
    }
  };

  const handleSelect = (notification: Notification) => {
    setOpen(false);
    onNotificationClick?.(notification);
  };

  const hasNotifications = notifications.length > 0;
  const summary = unreadCount > 0 ? `${unreadCount} unread` : "All caught up";

  const markAllButton = unreadCount > 0 && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void markAllAsRead()}
      className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
      title="Mark all as read"
    >
      <CheckCheck className="size-3.5" />
      Mark all as read
    </Button>
  );

  const clearAllButton = hasNotifications && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void clearAll()}
      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
    >
      Clear all
    </Button>
  );

  const list = hasNotifications ? (
    <ul className="divide-y divide-border/60">
      {notifications.map((notification: Notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={(id) => void markAsRead(id)}
          onRemove={(id) => void removeNotification(id)}
          onClick={handleSelect}
        />
      ))}
    </ul>
  ) : (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
        <Bell className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No notifications</p>
      <p className="text-xs text-muted-foreground">
        New devices and blocked streams show up here.
      </p>
    </div>
  );

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-8 rounded-full"
      title="Notifications"
      aria-label={
        unreadCount > 0 ? `Notifications, ${summary}` : "Notifications"
      }
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span
          data-testid="unread-dot"
          className="absolute right-1.5 top-1.5 size-2 animate-in zoom-in-50 rounded-full bg-blocked ring-2 ring-background duration-200 motion-reduce:animate-none"
        />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Modal open={open} onOpenChange={setOpen} size="sm">
          <ModalHeader title="Notifications" description={summary} />
          <ModalBody className="space-y-0 px-0 py-0 sm:px-0">{list}</ModalBody>
          <ModalFooter className="flex-row items-center [&>button]:w-auto">
            {clearAllButton}
            <div className="ml-auto flex items-center gap-1">
              {markAllButton}
            </div>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-labelledby={headingId}
        className="flex w-96 flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b py-2.5 pl-4 pr-2">
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-semibold">
              Notifications
            </h2>
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
          <div className="flex items-center">
            {markAllButton}
            {clearAllButton}
          </div>
        </div>
        <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain">
          {list}
        </div>
      </PopoverContent>
    </Popover>
  );
}
