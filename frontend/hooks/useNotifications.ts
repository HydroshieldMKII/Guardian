"use client";

import { useState, useEffect, useCallback } from "react";
import { Notification } from "@/types";
import { apiClient } from "@/lib/api";

interface UseNotificationsProps {
  initialData?: {
    data: Notification[];
    unreadCount: number;
  };
}

export function useNotifications(props?: UseNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>(props?.initialData?.data || []);
  const [isLoading, setIsLoading] = useState(!props?.initialData);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await apiClient.getAllNotifications<Notification[]>();
      
      // Convert createdAt strings to Date objects
      const processedNotifications = data.map(notification => ({
        ...notification,
        createdAt: new Date(notification.createdAt),
      }));
      
      setNotifications(processedNotifications);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
      // Fallback to empty array on error
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load only if no initial data provided
  useEffect(() => {
    if (!props?.initialData) {
      fetchNotifications();
    } else {
      setIsLoading(false);
    }
  }, [fetchNotifications, props?.initialData]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark notification as read
  const markAsRead = useCallback(async (id: number) => {
    try {
      await apiClient.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Remove notification
  const removeNotification = useCallback(async (id: number) => {
    try {
      await apiClient.deleteNotification(id);
      setNotifications(prev =>
        prev.filter(notification => notification.id !== id)
      );
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await apiClient.clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  }, []);

  // Refresh notifications 
  const refreshNotifications = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    removeNotification,
    markAllAsRead,
    clearAll,
    refreshNotifications,
  };
}