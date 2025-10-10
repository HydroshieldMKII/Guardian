"use client";

import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from "react";
import { Notification } from "@/types";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (data: { data: Notification[]; unreadCount: number }) => void;
  updateNotifications: (updater: (prev: Notification[]) => Notification[]) => void;
  onNotificationClick?: (notification: Notification) => void;
  setNotificationClickHandler: (handler: (notification: Notification) => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  initialData?: {
    data: Notification[];
    unreadCount: number;
  };
}

export function NotificationProvider({ children, initialData }: NotificationProviderProps) {
  const [notifications, setNotificationsState] = useState<Notification[]>(
    initialData?.data || []
  );
  const [unreadCount, setUnreadCount] = useState(initialData?.unreadCount || 0);
  const notificationClickHandlerRef = useRef<((notification: Notification) => void) | undefined>(undefined);

  const setNotifications = useCallback((data: { data: Notification[]; unreadCount: number }) => {
    // Convert createdAt strings to Date objects
    const processedNotifications = data.data.map(notification => ({
      ...notification,
      createdAt: new Date(notification.createdAt),
    }));
    setNotificationsState(processedNotifications);
    setUnreadCount(data.unreadCount);
  }, []);

  const updateNotifications = useCallback((updater: (prev: Notification[]) => Notification[]) => {
    setNotificationsState(prev => {
      const updated = updater(prev);
      // Recalculate unread count
      const newUnreadCount = updated.filter(n => !n.read).length;
      setUnreadCount(newUnreadCount);
      return updated;
    });
  }, []);

  const setNotificationClickHandler = useCallback((handler: (notification: Notification) => void) => {
    notificationClickHandlerRef.current = handler;
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    if (notificationClickHandlerRef.current) {
      notificationClickHandlerRef.current(notification);
    } else {
      console.warn('No notification click handler set');
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        setNotifications,
        updateNotifications,
        onNotificationClick: handleNotificationClick,
        setNotificationClickHandler,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
}