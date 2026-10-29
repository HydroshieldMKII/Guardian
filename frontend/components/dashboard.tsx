"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StreamsList from "./streams-list";
import { DeviceManagement } from "./device-management";
import { PlexErrorHandler, ErrorHandler } from "./error-handler";
import { PageLoader } from "./three-dot-loader";

import { DashboardStats, UnifiedDashboardData, PlexStatus } from "@/types";
import { apiClient } from "@/lib/api";
import { countWaitingDevices } from "@/lib/device-policies";
import { config } from "@/lib/config";
import { useVersion } from "@/contexts/version-context";
import { useAuth } from "@/contexts/auth-context";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import {
  dashboardHref,
  useDashboardNav,
  type DashboardView,
} from "@/contexts/dashboard-nav-context";

const usersHref = (userId?: string | null) =>
  userId
    ? `${dashboardHref("users")}&user=${encodeURIComponent(userId)}`
    : dashboardHref("users");

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
  const [loading, setLoading] = useState(true);
  const [plexStatus, setPlexStatus] = useState<PlexStatus | null>(null);
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
          "Backend connection error: Cannot connect to the backend service",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const requestedView = searchParams.get("view");
  const selectedUserId = searchParams.get("user");
  const defaultView: DashboardView | null = dashboardData
    ? dashboardData.settings.find((s) => s.key === "DEFAULT_PAGE")?.value ===
      "streams"
      ? "streams"
      : "users"
    : null;
  const view: DashboardView | null =
    requestedView === "streams" || requestedView === "users"
      ? requestedView
      : defaultView;

  const { publish } = useDashboardNav();
  const waitingDevices = dashboardData
    ? countWaitingDevices(dashboardData.devices.all, dashboardData.users)
    : stats.pendingDevices;

  useEffect(() => {
    if (!dashboardData) return;
    publish({
      view,
      pendingDevices: waitingDevices,
      activeStreams: stats.activeStreams,
    });
  }, [publish, dashboardData, view, waitingDevices, stats.activeStreams]);

  const handleSelectUser = (userId: string | null) => {
    router.push(usersHref(userId), { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const handleNavigateToDevice = (userId: string, deviceIdentifier: string) => {
    router.push(usersHref(userId), { scroll: false });
    setNavigationTarget({ userId, deviceIdentifier });
  };

  const handleNavigationComplete = useCallback(() => {
    setNavigationTarget(null);
  }, []);

  useEffect(() => {
    // Don't fetch dashboard data during setup
    if (setupRequired) {
      return;
    }
    void refreshDashboard();
  }, [setupRequired, refreshDashboard]);

  // Handle URL parameters for device navigation
  useEffect(() => {
    const userId = searchParams.get("userId");
    const deviceId = searchParams.get("deviceId");

    if (userId && deviceId) {
      setNavigationTarget({ userId, deviceIdentifier: deviceId });
      router.replace(usersHref(userId), { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (versionInfo?.version) {
      void checkForUpdatesIfEnabled();
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
    !setupRequired,
  );

  // Poll only while the live connection is unavailable
  useEffect(() => {
    if (liveConnected) return; // Updates arrive over the socket instead

    const interval = setInterval(
      () => void refreshDashboard(true),
      config.app.refreshInterval,
    );
    return () => clearInterval(interval);
  }, [liveConnected, refreshDashboard]);

  // Show error if backend is unavailable
  if (backendError) {
    return (
      <ErrorHandler
        backendError={backendError}
        onRetry={() => void retryConnection()}
      />
    );
  }

  // Don't render dashboard during setup
  if (setupRequired) {
    return null;
  }

  if (loading) {
    return <PageLoader />;
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
    <div>
      <div
        key={view}
        className="mx-auto w-full max-w-[1400px] animate-in fade-in px-4 py-6 duration-300 ease-out motion-reduce:animate-none sm:px-6 sm:py-8 lg:px-8"
      >
        {view === "streams" ? (
          <StreamsList
            sessionsData={dashboardData?.sessions}
            onRefresh={() => refreshDashboard(true)}
            onNavigateToDevice={handleNavigateToDevice}
            onNavigateToUser={handleSelectUser}
          />
        ) : (
          <DeviceManagement
            devicesData={dashboardData?.devices}
            usersData={dashboardData?.users}
            settingsData={dashboardData?.settings}
            onRefresh={() => refreshDashboard(true)}
            navigationTarget={navigationTarget}
            onNavigationComplete={handleNavigationComplete}
            selectedUserId={selectedUserId}
            onSelectUser={handleSelectUser}
          />
        )}
      </div>
    </div>
  );
}
