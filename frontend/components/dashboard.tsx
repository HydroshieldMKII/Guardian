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
import { StatTile } from "@/components/ui/entity";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle, CheckCircle } from "lucide-react";
import StreamsList from "./streams-list";
import { DeviceManagement } from "./device-management";
import { DashboardTabs } from "./dashboard-tabs";
import { PlexErrorHandler, ErrorHandler } from "./error-handler";
import { ThreeDotLoader } from "./three-dot-loader";

import {
  DashboardStats,
  UnifiedDashboardData,
  PlexStatus,
  Notification,
} from "@/types";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";
import { useVersion } from "@/contexts/version-context";
import { useAuth } from "@/contexts/auth-context";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";

export function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { versionInfo, checkForUpdatesIfEnabled } = useVersion();
  const { setupRequired, backendError, retryConnection } = useAuth();

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

  // Navigate to user in device management (scroll to user card)
  const handleNavigateToUser = (userId: string) => {
    // Switch to devices tab
    setActiveTab("devices");

    // Wait for tab switch to complete before scrolling
    setTimeout(() => {
      const userElement = document.querySelector(`[data-user-id="${userId}"]`);
      if (userElement) {
        // Scroll to the user card
        userElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        // Add highlight effect
        setTimeout(() => {
          userElement.classList.add(
            "ring-2",
            "ring-blue-500",
            "ring-opacity-75",
          );
          setTimeout(() => {
            userElement.classList.remove(
              "ring-2",
              "ring-blue-500",
              "ring-opacity-75",
            );
          }, 1500);
        }, 200);
      }
    }, 100);
  };

  // Handle navigation completion
  const handleNavigationComplete = () => {
    setNavigationTarget(null);
  };

  useEffect(() => {
    // Don't fetch dashboard data during setup
    if (setupRequired) {
      return;
    }
    refreshDashboard();
  }, [setupRequired]);

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

  const applyLiveDashboard = useCallback((payload: UnifiedDashboardData) => {
    setDashboardData(payload);
    setPlexStatus(payload.plexStatus);
    setStats(payload.stats);
    setLoading(false);
  }, []);

  const { connected: liveConnected } = useLiveDashboard<UnifiedDashboardData>(
    applyLiveDashboard,
    autoRefresh && !setupRequired,
  );

  // Poll only while the live connection is unavailable
  useEffect(() => {
    if (!autoRefresh) return; // Don't set up interval in manual mode
    if (liveConnected) return; // Updates arrive over the socket instead

    const interval = setInterval(
      () => refreshDashboard(true),
      config.app.refreshInterval,
    );
    return () => clearInterval(interval);
  }, [autoRefresh, liveConnected, refreshDashboard]);

  // Show error if backend is unavailable
  if (backendError) {
    return (
      <ErrorHandler backendError={backendError} onRetry={retryConnection} />
    );
  }

  // Don't render dashboard during setup
  if (setupRequired) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <ThreeDotLoader />
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

  const tabs = (
    <DashboardTabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pendingDevices={stats.pendingDevices}
      activeStreams={stats.activeStreams}
    />
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Server Statistics */}
        <div className="mb-4 sm:mb-6 lg:mb-10">
          <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4 flex items-center">
            Devices Overview
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            <StatTile
              label="Active Streams"
              value={stats.activeStreams}
              tone="info"
            />
            <StatTile
              label="Pending Approval"
              value={stats.pendingDevices}
              tone="warning"
            />
            <StatTile
              label="Approved Devices"
              value={stats.approvedDevices}
              tone="positive"
            />
            <StatTile
              label="Total Devices"
              value={stats.totalDevices}
              tone="accent"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="w-full">
          {activeTab === "streams" ? (
            <StreamsList
              tabs={tabs}
              sessionsData={dashboardData?.sessions}
              onRefresh={() => refreshDashboard(true)}
              autoRefresh={autoRefresh}
              onAutoRefreshChange={setAutoRefresh}
              onNavigateToDevice={handleNavigateToDevice}
              onNavigateToUser={handleNavigateToUser}
            />
          ) : (
            <DeviceManagement
              tabs={tabs}
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
