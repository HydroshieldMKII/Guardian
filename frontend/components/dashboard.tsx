"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

import {
  DashboardStats,
  UnifiedDashboardData,
  PlexStatus,
  Notification,
} from "@/types";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";
import { useVersion } from "@/contexts/version-context";

export function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { versionInfo, checkForUpdatesIfEnabled } = useVersion();

  const [dashboardData, setDashboardData] =
    useState<UnifiedDashboardData | null>(null);
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
  const [navigationTarget, setNavigationTarget] = useState<{
    userId: string;
    deviceIdentifier: string;
  } | null>(null);

  const handleShowSettings = () => {
    router.push("/settings");
  };

  const refreshDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // Fetch all dashboard data
      const newDashboardData =
        await apiClient.getDashboardData<UnifiedDashboardData>();

      // Always update the data
      setDashboardData(newDashboardData);
      setPlexStatus(newDashboardData.plexStatus);
      setStats(newDashboardData.stats);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      setPlexStatus({
        configured: false,
        hasValidCredentials: false,
        connectionStatus:
          "Backend connection error: Cannot connect to Guardian backend service",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Set initial tab only once when dashboard data is first available
  useEffect(() => {
    if (dashboardData && !initialTabSet) {
      const defaultPageSetting = dashboardData.settings.find(
        (s) => s.key === "DEFAULT_PAGE",
      );
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

  // Handle URL parameters for device navigation
  useEffect(() => {
    const userId = searchParams.get("userId");
    const deviceId = searchParams.get("deviceId");

    if (userId && deviceId) {
      // Switch to devices tab and set navigation target
      setActiveTab("devices");
      setNavigationTarget({ userId, deviceIdentifier: deviceId });

      // Clean up URL parameters
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

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

    const interval = setInterval(
      () => refreshDashboard(true),
      config.app.refreshInterval,
    );
    return () => clearInterval(interval);
  }, [autoRefresh, refreshDashboard]);

  if (loading) {
    // Loading dots animation
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 bg-blue-600 rounded-full animate-pulse"></div>
          <div
            className="w-5 h-5 bg-blue-600 rounded-full animate-pulse"
            style={{ animationDelay: "0.15s" }}
          ></div>
          <div
            className="w-5 h-5 bg-blue-600 rounded-full animate-pulse"
            style={{ animationDelay: "0.3s" }}
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
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Server Statistics */}
        <div className="mb-6 lg:mb-10">
          <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
            Devices Overview
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
            <Card className="border-l-4 border-l-blue-500 transition-all hover:shadow-md">
              <CardHeader className="pb-3 lg:pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center mb-2 mt-2">
                  <Activity className="w-4 h-4 mr-2" />
                  Active Streams
                </CardTitle>
                <CardDescription className="text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground">
                  {stats.activeStreams}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-yellow-500 transition-all hover:shadow-md">
              <CardHeader className="pb-3 lg:pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center mb-2 mt-2">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Pending Approval
                </CardTitle>
                <CardDescription className="text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground">
                  {stats.pendingDevices}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-green-500 transition-all hover:shadow-md">
              <CardHeader className="pb-3 lg:pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center mb-2 mt-2">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approved Devices
                </CardTitle>
                <CardDescription className="text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground">
                  {stats.approvedDevices}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-purple-500 transition-all hover:shadow-md">
              <CardHeader className="pb-3 lg:pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center mb-2 mt-2">
                  <Users className="w-4 h-4 mr-2" />
                  Total Devices
                </CardTitle>
                <CardDescription className="text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground">
                  {stats.totalDevices}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 lg:mb-8">
          <div className="flex w-full lg:w-fit space-x-1 bg-muted p-1.5 rounded-lg">
            <Button
              variant={activeTab === "devices" ? "default" : "ghost"}
              onClick={() => setActiveTab("devices")}
              className="flex-1 lg:flex-none px-4 lg:px-8 py-2.5 text-sm font-medium relative min-w-0"
            >
              <Shield className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Device Management</span>
              {stats.pendingDevices > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 min-w-5 h-5 text-xs bg-red-600 dark:bg-red-700 text-white flex-shrink-0"
                >
                  {stats.pendingDevices}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeTab === "streams" ? "default" : "ghost"}
              onClick={() => setActiveTab("streams")}
              className="flex-1 lg:flex-none px-4 lg:px-8 py-2.5 text-sm font-medium relative min-w-0"
            >
              <Activity className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Active Streams</span>
              {stats.activeStreams > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 min-w-5 h-5 text-xs bg-blue-600 dark:bg-blue-700 text-white flex-shrink-0"
                >
                  {stats.activeStreams}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="w-full">
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
      </div>
    </div>
  );
}
