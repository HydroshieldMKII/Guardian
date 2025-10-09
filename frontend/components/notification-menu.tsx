"use client";

import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { Notification } from "@/types";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead, onRemove }: NotificationItemProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  return (
    <div
      className={`relative p-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
        !notification.read ? "bg-accent/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(notification.date)}
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            User <span className="font-medium">{notification.username}</span> attempted to stream on{" "}
            <span className="font-medium">{notification.deviceName}</span> but was blocked
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(notification.id)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="Mark as read"
            >
              <div className="w-3 h-3 rounded-full border border-current" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(notification.id)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            title="Remove notification"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationMenu() {
  const { notifications, unreadCount, markAsRead, removeNotification, clearAll } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full relative"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-medium"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <DropdownMenuLabel className="text-sm font-semibold p-0">
            Notifications
          </DropdownMenuLabel>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground h-auto p-1"
            >
              Clear all
            </Button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <div className="h-80 overflow-y-auto scrollbar-hide">
            <div>
              {notifications.map((notification: Notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onRemove={removeNotification}
                />
              ))}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}