"use client";

import { useState, useEffect } from "react";
import { useNotificationContext } from "@/contexts/notification-context";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";
import { Notification, AppSetting } from "@/types";

export function GlobalNotificationHandler() {
  const { setNotificationClickHandler, updateNotifications, notifications, setNotifications } = useNotificationContext();
  
  // User History Modal state for notifications
  const [notificationHistoryModalOpen, setNotificationHistoryModalOpen] = useState(false);
  const [notificationHistoryUser, setNotificationHistoryUser] = useState<{userId: string, username?: string} | null>(null);
  const [notificationScrollToSessionId, setNotificationScrollToSessionId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSetting[]>([]);

  // Fetch settings to check auto-mark-as-read preference
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${config.api.baseUrl}/config`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Failed to fetch settings for notification handler:', error);
      }
    };

    fetchSettings();
  }, []);

  // Independent notification fetching - consistent across all pages
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const notificationData = await apiClient.getAllNotifications<any[]>();
        
        // Format to match what the context expects
        const unreadCount = notificationData.filter(n => !n.read).length;
        const formattedData = {
          data: notificationData,
          unreadCount: unreadCount
        };
        
        setNotifications(formattedData);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    // Fetch immediately on mount
    fetchNotifications();

    // Set up interval to fetch notifications
    const interval = setInterval(fetchNotifications, 6000);
    
    return () => {clearInterval(interval);};
  }, [setNotifications]);

  // Set up global notification click handler
  useEffect(() => {
    const handleNotificationClick = (notification: Notification) => {
      if (!notification?.sessionHistoryId || !notification?.userId) {
        return; // Only handle notifications with sessionHistoryId
      }
      
      // Open the modal immediately
      setNotificationHistoryUser({ 
        userId: notification.userId, 
        username: notification.username 
      });
      setNotificationScrollToSessionId(notification.sessionHistoryId);
      setNotificationHistoryModalOpen(true);
      
      // Check if auto-mark as read is enabled and mark as read in background
      const autoMarkReadSetting = settings.find(s => s.key === 'AUTO_MARK_NOTIFICATION_READ');
      const shouldAutoMarkRead = autoMarkReadSetting?.value === 'true';
      
      if (shouldAutoMarkRead && !notification.read) {
        // Update UI immediately for better UX
        updateNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, read: true }
              : n
          )
        );
        
        // Make API call in background
        apiClient.markNotificationAsRead(notification.id).catch(error => {
          console.error('Failed to mark notification as read:', error);
          // Revert the UI change if API call fails
          updateNotifications(prev =>
            prev.map(n =>
              n.id === notification.id
                ? { ...n, read: false }
                : n
            )
          );
        });
      }
    };

    setNotificationClickHandler(handleNotificationClick);
  }, [setNotificationClickHandler, settings, updateNotifications]);

  return (
    <UserHistoryModal
      userId={notificationHistoryUser?.userId || null}
      username={notificationHistoryUser?.username}
      isOpen={notificationHistoryModalOpen}
      onClose={() => {
        setNotificationHistoryModalOpen(false);
        setNotificationHistoryUser(null);
        setNotificationScrollToSessionId(null);
      }}
      scrollToSessionId={notificationScrollToSessionId}
    />
  );
}