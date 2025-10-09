"use client";

import { useState, useEffect, useCallback } from "react";
import { Notification, NotificationData } from "@/types";

// Mock data for demonstration
const mockNotifications: Notification[] = [
  {
    id: "1",
    userId: "user123",
    username: "john_doe",
    deviceName: "John's iPhone",
    date: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    read: false,
    type: "block",
  },
  {
    id: "2",
    userId: "user456",
    username: "sarah_smith",
    deviceName: "Sarah's MacBook Pro",
    date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: false,
    type: "block",
  },
  {
    id: "3",
    userId: "user789",
    username: "mike_wilson",
    deviceName: "Mike's Android TV",
    date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    read: true,
    type: "block",
  },
  {
    id: "4",
    userId: "user101",
    username: "emily_brown",
    deviceName: "Emily's iPad",
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    read: true,
    type: "block",
  },
  {
    id: "5",
    userId: "user202",
    username: "alex_jones",
    deviceName: "Alex's Fire TV Stick",
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    read: false,
    type: "block",
  },
  {
    id: "6",
    userId: "user303",
    username: "lisa_wang",
    deviceName: "Lisa's Roku Ultra",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    read: true,
    type: "block",
  },
  {
    id: "7",
    userId: "user404",
    username: "david_clark",
    deviceName: "David's Xbox Series X",
    date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    read: false,
    type: "block",
  },
  {
    id: "8",
    userId: "user505",
    username: "maria_garcia",
    deviceName: "Maria's Samsung Smart TV",
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    read: true,
    type: "block",
  },
];

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize with mock data
  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setNotifications(mockNotifications);
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev =>
      prev.filter(notification => notification.id !== id)
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Add new notification (for future use)
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'date'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date(),
    };
    
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    removeNotification,
    markAllAsRead,
    clearAll,
    addNotification,
  };
}