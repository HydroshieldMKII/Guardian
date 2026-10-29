"use client";

import { useId, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
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
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification } from "@/types";

interface HistoryTarget {
  userId: string;
  username?: string;
  sessionId: number;
}

export function NotificationMenu() {
  const { setupRequired, isAuthenticated, user } = useAuth();
  const { getSetting } = useSettings();
  const {
    notifications,
    unreadCount,
    markAsRead,
    remove,
    markAllAsRead,
    clearAll,
    markReadAutomatically,
  } = useNotifications(!setupRequired && isAuthenticated && isAdminUser(user));
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryTarget | null>(null);
  const headingId = useId();

  const handleSelect = (notification: Notification) => {
    setOpen(false);
    if (!notification.sessionHistoryId || !notification.userId) return;

    setHistory({
      userId: notification.userId,
      username: notification.username,
      sessionId: notification.sessionHistoryId,
    });
    if (
      getSetting("AUTO_MARK_NOTIFICATION_READ") === "true" &&
      !notification.read
    ) {
      void markReadAutomatically(notification.id);
    }
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
          onRemove={(id) => void remove(id)}
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

  const panel = isMobile ? (
    <>
      {trigger}
      <Modal open={open} onOpenChange={setOpen} size="sm">
        <ModalHeader title="Notifications" description={summary} />
        <ModalBody className="space-y-0 px-0 py-0 sm:px-0">{list}</ModalBody>
        <ModalFooter className="flex-row items-center [&>button]:w-auto">
          {clearAllButton}
          <div className="ml-auto flex items-center gap-1">{markAllButton}</div>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  ) : (
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

  return (
    <>
      {panel}
      <UserHistoryModal
        userId={history?.userId ?? null}
        username={history?.username}
        isOpen={history !== null}
        onClose={() => setHistory(null)}
        scrollToSessionId={history?.sessionId ?? null}
      />
    </>
  );
}
