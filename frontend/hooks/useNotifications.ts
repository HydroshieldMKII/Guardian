"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NOTIFICATIONS_EVENT, useLiveEvent } from "@/hooks/useLiveDashboard";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Notification } from "@/types";

export const NOTIFICATION_POLL_MS = 10000;

const NO_NOTIFICATIONS: Notification[] = [];

const withDates = (notifications: Notification[]) =>
  notifications.map((notification) => ({
    ...notification,
    createdAt: new Date(notification.createdAt),
  }));

const markedRead = (id: number, read: boolean) => (prev: Notification[]) =>
  prev.map((notification) =>
    notification.id === id ? { ...notification, read } : notification,
  );

export function useNotifications(enabled: boolean) {
  const queryClient = useQueryClient();

  const update = useCallback(
    (updater: (prev: Notification[]) => Notification[]) =>
      queryClient.setQueryData<Notification[]>(
        queryKeys.notifications,
        (prev) => prev && updater(prev),
      ),
    [queryClient],
  );

  const applyLive = useCallback(
    (payload: Notification[]) =>
      queryClient.setQueryData(queryKeys.notifications, payload),
    [queryClient],
  );

  const { connected } = useLiveEvent<Notification[]>(
    NOTIFICATIONS_EVENT,
    applyLive,
    enabled,
  );

  const { data: notifications = NO_NOTIFICATIONS } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => apiClient.getAllNotifications<Notification[]>(),
    enabled,
    refetchInterval: connected ? false : NOTIFICATION_POLL_MS,
    select: withDates,
  });

  const markAsRead = async (id: number) => {
    try {
      await apiClient.markNotificationAsRead(id);
      update(markedRead(id, true));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const remove = async (id: number) => {
    try {
      await apiClient.deleteNotification(id);
      update((prev) => prev.filter((notification) => notification.id !== id));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      update((prev) =>
        prev.map((notification) => ({ ...notification, read: true })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const clearAll = async () => {
    try {
      await apiClient.clearAllNotifications();
      update(() => []);
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  };

  const markReadAutomatically = async (id: number) => {
    update(markedRead(id, true));
    try {
      await apiClient.markNotificationAsReadAuto(id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      update(markedRead(id, false));
    }
  };

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read)
      .length,
    markAsRead,
    remove,
    markAllAsRead,
    clearAll,
    markReadAutomatically,
  };
}
