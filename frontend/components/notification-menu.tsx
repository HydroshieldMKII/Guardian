"use client";

import { BellRing, X, CheckCheck, Check } from "lucide-react";
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
import { useNotificationContext } from "@/contexts/notification-context";
import { Notification } from "@/types";
import { apiClient } from "@/lib/api";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onRemove: (id: number) => void;
  onClick?: (notification: Notification) => void;
}

function NotificationItem({ notification, onMarkAsRead, onRemove, onClick }: NotificationItemProps) {
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
        <div 
          className={`flex-1 min-w-0 rounded p-1 -m-1 transition-colors ${
            notification.sessionHistoryId 
              ? 'cursor-pointer hover:bg-accent/30' 
              : 'cursor-default'
          }`}
          onClick={() => notification.sessionHistoryId && onClick?.(notification)}
          title={notification.sessionHistoryId ? "Click to view session history" : ""}
        >
          <div className="flex items-center gap-2 mb-1">
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(notification.createdAt)}
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            {notification.text}
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
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(notification.id)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            title="Delete notification"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationMenu() {
  const { notifications, unreadCount, updateNotifications, onNotificationClick } = useNotificationContext();

  // Mark notification as read
  const markAsRead = async (id: number) => {
    try {
      await apiClient.markNotificationAsRead(id);
      updateNotifications(prev =>
        prev.map(notification =>
          notification.id === id
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Remove notification
  const removeNotification = async (id: number) => {
    try {
      await apiClient.deleteNotification(id);
      updateNotifications(prev =>
        prev.filter(notification => notification.id !== id)
      );
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      updateNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    try {
      await apiClient.clearAllNotifications();
      updateNotifications(() => []);
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full relative"
          title="Notifications"
        >
          <BellRing className="h-4 w-4" />
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
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-muted-foreground hover:text-foreground h-auto p-1 flex items-center gap-1"
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
                className="text-xs text-muted-foreground hover:text-foreground h-auto p-1"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <BellRing className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
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
                  onClick={onNotificationClick}
                />
              ))}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}