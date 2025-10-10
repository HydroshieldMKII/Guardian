"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  Settings,
} from "lucide-react";
import StreamsList from "./streams-list";
import { DeviceManagement } from "./device-management";
import { PlexErrorHandler } from "./plex-error-handler";

import { DashboardStats, UnifiedDashboardData, PlexStatus, Notification } from "@/types";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";
import { useVersion } from "@/contexts/version-context";
import { useNotificationContext } from "@/contexts/notification-context";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";

export function Dashboard() {
  const router = useRouter();
  const { versionInfo, checkForUpdatesIfEnabled } = useVersion();
  const { setNotifications, setNotificationClickHandler } = useNotificationContext();
  const [dashboardData, setDashboardData] = useState<UnifiedDashboardData | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activeStreams: 0,
    totalDevices: 0,
    pendingDevices: 0,
    approvedDevices: 0,
  });
  const [activeTab, setActiveTab] = useState<"streams" | "devices">("devices");
  const [loading, setLoading] = useState(true);
  const [plexStatus, setPlexStatus] = useState<PlexStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<{userId: string, deviceIdentifier: string} | null>(null);
  
  // User History Modal state for notifications
  const [notificationHistoryModalOpen, setNotificationHistoryModalOpen] = useState(false);
  const [notificationHistoryUser, setNotificationHistoryUser] = useState<{userId: string, username?: string} | null>(null);
  const [notificationScrollToSessionId, setNotificationScrollToSessionId] = useState<number | null>(null);

  const handleShowSettings = () => {
    router.push('/settings');
  };

  const refreshDashboard = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      // Fetch all dashboard data
      const newDashboardData = await apiClient.getDashboardData<UnifiedDashboardData>();
      
      // Always update the data
      setDashboardData(newDashboardData);
      setPlexStatus(newDashboardData.plexStatus);
      setStats(newDashboardData.stats);
      
      // Update notifications in context
      if (newDashboardData.notifications) {
        setNotifications(newDashboardData.notifications);
      }
      
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      setPlexStatus({
        configured: false,
        hasValidCredentials: false,
        connectionStatus: "Backend connection error: Cannot connect to Guardian backend service",
      });
    } finally {
      setLoading(false);
    }
  };

  // Set initial tab only once when dashboard data is first available
  useEffect(() => {
    if (dashboardData && !initialTabSet) {
      const defaultPageSetting = dashboardData.settings.find(s => s.key === "DEFAULT_PAGE");
      const defaultPage = defaultPageSetting?.value || "devices";
      setActiveTab(defaultPage === "streams" ? "streams" : "devices");
      setInitialTabSet(true);
    }
  }, [dashboardData, initialTabSet]);

  // Navigate to device in device management
  const handleNavigateToDevice = (userId: string, deviceIdentifier: string) => {
    // Switch to devices tab
    setActiveTab("devices");
    
    // Set navigation target for DeviceManagement component
    setNavigationTarget({ userId, deviceIdentifier });
  };

  // Handle navigation completion
  const handleNavigationComplete = () => {
    setNavigationTarget(null);
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  // Check for updates automatically when dashboard loads
  useEffect(() => {
    checkForUpdatesIfEnabled();
  }, []);

  useEffect(() => {
    if (versionInfo?.version) {
      checkForUpdatesIfEnabled();
    }
  }, [versionInfo?.version, checkForUpdatesIfEnabled]);

  useEffect(() => {
    if (!autoRefresh) return; // Don't set up interval in manual mode
    
    const interval = setInterval(() => refreshDashboard(true), config.app.refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Set up notification click handler
  useEffect(() => {
    const handleNotificationClick = (notification: Notification) => {
      if (!notification) {
        console.error('Notification click handler called without notification object');
        return;
      }
      
      if (notification.sessionHistoryId && notification.userId) {
        // Set up the modal to open with the specific session
        setNotificationHistoryUser({ 
          userId: notification.userId, 
          username: notification.username 
        });
        setNotificationScrollToSessionId(notification.sessionHistoryId);
        setNotificationHistoryModalOpen(true);
      } else {
        // For notifications without sessionHistoryId, just open the user history without scrolling
        if (notification.userId) {
          setNotificationHistoryUser({ 
            userId: notification.userId, 
            username: notification.username 
          });
          setNotificationScrollToSessionId(null);
          setNotificationHistoryModalOpen(true);
        }
      }
    };

    setNotificationClickHandler(handleNotificationClick);
  }, [setNotificationClickHandler]);

  if (loading) {
    // Loading dots animation
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
          <div
            className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          ></div>
        </div>
      </div>
    );
  }

  // Show configuration prompt if Plex is not properly connected
  if (!plexStatus?.configured || !plexStatus?.hasValidCredentials) {
    return (
      <PlexErrorHandler 
        plexStatus={plexStatus}
        onShowSettings={handleShowSettings}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">

        {/* Server Statistics */}
        <div className="mb-3 sm:mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
            Devices Overview
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Active Streams</span>
                  <span className="sm:hidden">Streams</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.activeStreams}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Pending Approval</span>
                  <span className="sm:hidden">Pending</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.pendingDevices}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Approved Devices</span>
                  <span className="sm:hidden">Approved</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.approvedDevices}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Total Devices</span>
                  <span className="sm:hidden">Total</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.totalDevices}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 sm:mb-6">
          <div className="flex w-full sm:w-fit space-x-0 sm:space-x-1 bg-muted p-1 rounded-lg">
            <Button
              variant={activeTab === "devices" ? "default" : "ghost"}
              onClick={() => setActiveTab("devices")}
              className="flex-1 sm:flex-none px-3 sm:px-6 text-sm relative"
            >
              <Shield className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Device Management</span>
              <span className="sm:hidden">Devices</span>
              {stats.pendingDevices > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-2 min-w-5 h-5 text-xs bg-red-600 dark:bg-red-700 text-white"
                >
                  {stats.pendingDevices}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeTab === "streams" ? "default" : "ghost"}
              onClick={() => setActiveTab("streams")}
              className="flex-1 sm:flex-none px-3 sm:px-6 text-sm relative"
            >
              <Activity className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Active Streams</span>
              <span className="sm:hidden">Streams</span>
              {stats.activeStreams > 0 && (
                <Badge
                  variant="default"
                  className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-2 min-w-5 h-5 text-xs bg-blue-600 dark:bg-blue-700 text-white"
                >
                  {stats.activeStreams}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "streams" ? (
          <StreamsList 
            sessionsData={dashboardData?.sessions}
            onRefresh={() => refreshDashboard(true)}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            onNavigateToDevice={handleNavigateToDevice}
          />
        ) : (
          <DeviceManagement 
            devicesData={dashboardData?.devices}
            usersData={dashboardData?.users}
            settingsData={dashboardData?.settings}
            onRefresh={() => refreshDashboard(true)}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            navigationTarget={navigationTarget}
            onNavigationComplete={handleNavigationComplete}
          />
        )}
      </div>

      {/* User History Modal for notifications */}
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
    </div>
  );
}
