"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StreamsList from "./streams-list";
import { DeviceManagement } from "./device-management";
import { PlexErrorHandler, ErrorHandler } from "./error-handler";
import { PageLoader } from "./three-dot-loader";

import type { PlexStatus } from "@/types";
import { countWaitingDevices } from "@/lib/device-policies";
import { useVersion } from "@/contexts/version-context";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardQuery } from "@/hooks/useDashboardQuery";
import {
  dashboardHref,
  useDashboardNav,
  type DashboardView,
} from "@/contexts/dashboard-nav-context";

const BACKEND_UNREACHABLE: PlexStatus = {
  configured: false,
  hasValidCredentials: false,
  connectionStatus:
    "Backend connection error: Cannot connect to the backend service",
};

const usersHref = (userId?: string | null) =>
  userId
    ? `${dashboardHref("users")}&user=${encodeURIComponent(userId)}`
    : dashboardHref("users");

export function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { versionInfo, checkForUpdatesIfEnabled } = useVersion();
  const { setupRequired, backendError, retryConnection } = useAuth();

  const {
    data: dashboardData,
    isError,
    refetch,
  } = useDashboardQuery(!setupRequired);
  const plexStatus = isError
    ? BACKEND_UNREACHABLE
    : (dashboardData?.plexStatus ?? null);
  const loading = !dashboardData && !isError;
  const [navigationTarget, setNavigationTarget] = useState<{
    userId: string;
    deviceIdentifier: string;
  } | null>(null);

  const handleShowSettings = () => {
    router.push("/settings");
  };

  const refreshDashboard = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
    : 0;
  const activeStreams = dashboardData?.stats.activeStreams ?? 0;

  useEffect(() => {
    if (!dashboardData) return;
    publish({ view, pendingDevices: waitingDevices, activeStreams });
  }, [publish, dashboardData, view, waitingDevices, activeStreams]);

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

  if (backendError) {
    return (
      <ErrorHandler
        backendError={backendError}
        onRetry={() => void retryConnection()}
      />
    );
  }

  if (setupRequired) {
    return null;
  }

  if (loading) {
    return <PageLoader />;
  }

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
            onRefresh={refreshDashboard}
            onNavigateToDevice={handleNavigateToDevice}
            onNavigateToUser={handleSelectUser}
          />
        ) : (
          <DeviceManagement
            devicesData={dashboardData?.devices}
            usersData={dashboardData?.users}
            settingsData={dashboardData?.settings}
            onRefresh={refreshDashboard}
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
