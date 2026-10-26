"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { config } from "@/lib/config";
import { AppSetting } from "@/types";
import { useAuth, isAdminUser } from "./auth-context";

interface VersionInfo {
  version: string;
  name: string;
  databaseVersion: string;
  codeVersion: string;
  isVersionMismatch: boolean;
}

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  updateUrl: string;
  releaseNotes?: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body?: string | null;
}

type UpdateCheckResult = {
  hasUpdate: boolean;
  latestVersion?: string;
  currentVersion?: string;
  updateUrl?: string;
  releaseNotes?: string;
};

interface VersionContextType {
  versionInfo: VersionInfo | null;
  updateInfo: UpdateInfo | null;
  loading: boolean;
  error: string | null;
  refreshVersionInfo: () => Promise<void>;
  checkForUpdatesIfEnabled: () => Promise<UpdateCheckResult | null>;
  checkForUpdatesManually: () => Promise<UpdateCheckResult | null>;
  clearUpdateInfo: () => void;
}

// Helper function for version comparison
const isVersionNewer = (
  newVersion: string,
  currentVersion: string
): boolean => {
  const parseVersion = (version: string) => {
    const [core, ...prerelease] = version.split("-");
    return {
      parts: core.split(".").map((v) => parseInt(v) || 0),
      prerelease: prerelease.join("-"),
    };
  };

  const newV = parseVersion(newVersion);
  const currentV = parseVersion(currentVersion);

  for (let i = 0; i < Math.max(newV.parts.length, currentV.parts.length); i++) {
    const newPart = newV.parts[i] || 0;
    const currentPart = currentV.parts[i] || 0;

    if (newPart > currentPart) return true;
    if (newPart < currentPart) return false;
  }

  if (newV.prerelease === currentV.prerelease) return false;
  if (!newV.prerelease) return true;
  if (!currentV.prerelease) return false;
  return (
    newV.prerelease.localeCompare(currentV.prerelease, undefined, {
      numeric: true,
    }) > 0
  );
};

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export function VersionProvider({ children }: { children: React.ReactNode }) {
  const {
    setupRequired,
    isLoading: authLoading,
    isAuthenticated,
    user,
  } = useAuth();
  const isAdmin = user && isAdminUser(user);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const installedVersion = versionInfo?.version;
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastUpdateCheckRef = useRef<number>(0);
  const updateCheckCacheRef = useRef<{
    hasUpdate: boolean;
    latestVersion: string;
    currentVersion: string;
    updateUrl: string;
    releaseNotes?: string;
  } | null>(null);

  // Constants
  const UPDATE_CHECK_COOLDOWN = 1 * 60 * 1000; // 1 minute
  const PERIODIC_UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

  const fetchVersionInfo = useCallback(async () => {
    // Skip fetching during setup, auth loading, or if not admin
    if (setupRequired || authLoading || !isAuthenticated || !isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const response = await fetch(`${config.api.baseUrl}/config/version`);
      if (response.ok) {
        const data = (await response.json()) as VersionInfo;
        setVersionInfo(data);
      } else {
        throw new Error(`Failed to fetch version info: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch version info:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [setupRequired, authLoading, isAuthenticated, isAdmin]);

  const refreshVersionInfo = useCallback(async () => {
    setLoading(true);
    await fetchVersionInfo();
  }, [fetchVersionInfo]);

  const checkForUpdatesIfEnabled = useCallback(async () => {
    if (setupRequired || !installedVersion) {
      return null;
    }

    // Rate limiting: Check if we've checked recently
    const now = Date.now();
    if (now - lastUpdateCheckRef.current < UPDATE_CHECK_COOLDOWN) {
      // Return cached result if available
      if (updateCheckCacheRef.current) {
        const cached = updateCheckCacheRef.current;
        // Update global state from cache if there's an update
        if (cached.hasUpdate) {
          setUpdateInfo({
            hasUpdate: cached.hasUpdate,
            latestVersion: cached.latestVersion,
            currentVersion: cached.currentVersion,
            updateUrl: cached.updateUrl,
            releaseNotes: cached.releaseNotes || "",
          });
        }
        return cached;
      }
      return null;
    }

    try {
      // First check if AUTO_CHECK_UPDATES is enabled
      const settingsResponse = await fetch(`${config.api.baseUrl}/config`);
      if (!settingsResponse.ok) {
        console.warn(
          "Version check: Failed to fetch settings for update check"
        );
        return null;
      }

      const settings = (await settingsResponse.json()) as AppSetting[];
      const autoCheckSetting = settings.find(
        (setting) => setting.key === "AUTO_CHECK_UPDATES"
      );
      const shouldAutoCheck = autoCheckSetting?.value === "true";

      if (!shouldAutoCheck) {
        return null; // Auto check is disabled
      }

      // Update last check time
      lastUpdateCheckRef.current = now;

      // Fetch latest release from GitHub API
      const response = await fetch(
        "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest"
      );
      if (!response.ok) {
        console.warn(
          "Version check: Failed to check for updates:",
          response.status
        );
        return null;
      }

      const release = (await response.json()) as GitHubRelease;
      const latestVersion = release.tag_name.replace(/^v/, ""); // Remove 'v' prefix if present
      const currentVersion = installedVersion;


      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);

      const result = {
        hasUpdate,
        latestVersion,
        currentVersion,
        updateUrl: release.html_url,
        releaseNotes: release.body || "",
      };

      // Cache the result
      updateCheckCacheRef.current = result;

      // Update global state when auto-checking
      if (hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          latestVersion,
          currentVersion,
          updateUrl: release.html_url,
          releaseNotes: release.body || "",
        });
      }

      return result;
    } catch (error) {
      console.error(
        "Version check: Failed to check for updates automatically:",
        error
      );
      return null;
    }
  }, [setupRequired, installedVersion, UPDATE_CHECK_COOLDOWN]);

  const checkForUpdatesManually = useCallback(async () => {
    if (!installedVersion) return null;

    try {
      // Manual check bypasses the AUTO_CHECK_UPDATES setting
      const response = await fetch(
        "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest"
      );
      if (!response.ok) {
        console.warn("Failed to check for updates:", response.status);
        return null;
      }

      const release = (await response.json()) as GitHubRelease;
      const latestVersion = release.tag_name.replace(/^v/, ""); // Remove 'v' prefix if present
      const currentVersion = installedVersion;

      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);

      const result = {
        hasUpdate,
        latestVersion,
        currentVersion,
        updateUrl: release.html_url,
        releaseNotes: release.body || "",
      };

      // Update global state
      if (hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          latestVersion,
          currentVersion,
          updateUrl: release.html_url,
          releaseNotes: release.body || "",
        });
      } else {
        setUpdateInfo(null);
      }

      return result;
    } catch (error) {
      console.error("Failed to check for updates manually:", error);
      return null;
    }
  }, [installedVersion]);

  const clearUpdateInfo = useCallback(() => {
    setUpdateInfo(null);
  }, []);

  useEffect(() => {
    void fetchVersionInfo();
  }, [fetchVersionInfo, setupRequired, authLoading]);

  // Automatically check for updates once version info is available
  useEffect(() => {
    if (versionInfo?.version) {
      const timeoutId = setTimeout(() => {
        void checkForUpdatesIfEnabled();
      }, 1000); // 1 second delay

      return () => clearTimeout(timeoutId);
    }
  }, [versionInfo?.version, checkForUpdatesIfEnabled]);

  // Periodic update checking
  useEffect(() => {
    if (!versionInfo?.version) return;

    const intervalId = setInterval(() => {
      void checkForUpdatesIfEnabled();
    }, PERIODIC_UPDATE_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [
    versionInfo?.version,
    checkForUpdatesIfEnabled,
    PERIODIC_UPDATE_CHECK_INTERVAL,
  ]);

  const contextValue = {
    versionInfo,
    updateInfo,
    loading,
    error,
    refreshVersionInfo,
    checkForUpdatesIfEnabled,
    checkForUpdatesManually,
    clearUpdateInfo,
  };

  return (
    <VersionContext.Provider value={contextValue}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  const context = useContext(VersionContext);
  if (context === undefined) {
    throw new Error("useVersion must be used within a VersionProvider");
  }
  return context;
}
