"use client";

import { useState, useEffect } from "react";
import { useNotificationContext } from "@/contexts/notification-context";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";
import { Notification, AppSetting } from "@/types";

export function GlobalNotificationHandler() {
  const {
    setNotificationClickHandler,
    updateNotifications,
    notifications,
    setNotifications,
  } = useNotificationContext();

  // User History Modal state for notifications
  const [notificationHistoryModalOpen, setNotificationHistoryModalOpen] =
    useState(false);
  const [notificationHistoryUser, setNotificationHistoryUser] = useState<{
    userId: string;
    username?: string;
  } | null>(null);
  const [notificationScrollToSessionId, setNotificationScrollToSessionId] =
    useState<number | null>(null);
  const [settings, setSettings] = useState<AppSetting[]>([]);

  // Independent notification fetching
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const notificationData = await apiClient.getAllNotifications<any[]>();

        // Format to match what the context expects
        const unreadCount = notificationData.filter((n) => !n.read).length;
        const formattedData = {
          data: notificationData,
          unreadCount: unreadCount,
        };

        setNotifications(formattedData);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    const fetchSettings = async () => {
      try {
        const response = await fetch(`${config.api.baseUrl}/config`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error(
          "Failed to fetch settings for notification handler:",
          error
        );
      }
    };

    const fetchAll = async () => {
      await Promise.all([fetchNotifications(), fetchSettings()]);
    };

    // Fetch notification and settings immediately on mount
    fetchAll();
    const intervalNotification = setInterval(fetchNotifications, 10000);

    // Listen for settings updates from the setting component
    const handleSettingsUpdate = () => {
      fetchSettings();
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdate);

    return () => {
      clearInterval(intervalNotification);
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
    };
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
        username: notification.username,
      });
      setNotificationScrollToSessionId(notification.sessionHistoryId);
      setNotificationHistoryModalOpen(true);

      // Check if auto-mark as read is enabled and mark as read in background
      const autoMarkReadSetting = settings.find(
        (s) => s.key === "AUTO_MARK_NOTIFICATION_READ"
      );
      const shouldAutoMarkRead = autoMarkReadSetting?.value === "true";

      if (shouldAutoMarkRead && !notification.read) {
        // Update UI immediately for better UX
        updateNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );

        // Make API call in background
        apiClient.markNotificationAsReadAuto(notification.id).catch((error) => {
          console.error("Failed to mark notification as read:", error);
          // Revert the UI change if API call fails
          updateNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, read: false } : n
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
