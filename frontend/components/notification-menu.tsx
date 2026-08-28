"use client";

import { useState } from "react";
import { BellRing, Bell, X, CheckCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
  onClick,
}: NotificationItemProps) {
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

  const openable = Boolean(notification.sessionHistoryId);

  return (
    <div
      className={`relative border-b p-3 transition-colors last:border-b-0 hover:bg-accent/50 ${
        !notification.read ? "bg-accent/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={`-m-1 min-w-0 flex-1 rounded p-1 transition-colors ${
            openable ? "cursor-pointer hover:bg-accent/30" : "cursor-default"
          }`}
          onClick={() => openable && onClick?.(notification)}
          title={
            openable
              ? "Open this stream in the user's history"
              : "The stream behind this notification is no longer in the history"
          }
        >
          <div className="mb-1 flex items-center gap-2">
            {!notification.read && (
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(notification.createdAt)}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{notification.text}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(notification.id)}
              className="size-8 p-0 text-muted-foreground hover:text-foreground sm:size-6"
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(notification.id)}
            className="size-8 p-0 text-muted-foreground hover:text-destructive sm:size-6"
            title="Delete this notification"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
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

  const actions = notifications.length > 0 && (
    <div className="flex items-center gap-2">
      {unreadCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={markAllAsRead}
          className="flex h-auto items-center gap-1 p-1 text-xs text-muted-foreground hover:text-foreground"
          title="Mark all as read"
        >
          <CheckCheck className="h-3 w-3" />
          Mark all as read
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearAll}
        className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear all
      </Button>
    </div>
  );

  const list =
    notifications.length === 0 ? (
      <div className="p-8 text-center">
        <BellRing className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">No notifications</p>
      </div>
    ) : (
      <div>
        {notifications.map((notification: Notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={markAsRead}
            onRemove={removeNotification}
            onClick={handleSelect}
          />
        ))}
      </div>
    );

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 rounded-full"
      title="Notifications"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      {unreadCount > 0 ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs font-medium"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Modal open={open} onOpenChange={setOpen} size="sm">
          <ModalHeader title="Notifications">{actions}</ModalHeader>
          <ModalBody className="space-y-0 px-0 py-0 sm:px-0">{list}</ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-4">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {actions}
        </div>
        <div className="h-80 overflow-y-auto scrollbar-hide">{list}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
