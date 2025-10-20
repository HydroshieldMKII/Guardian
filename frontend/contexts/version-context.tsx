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
}

interface VersionContextType {
  versionInfo: VersionInfo | null;
  updateInfo: UpdateInfo | null;
  loading: boolean;
  error: string | null;
  refreshVersionInfo: () => Promise<void>;
  checkForUpdatesIfEnabled: () => Promise<{
    hasUpdate: boolean;
    latestVersion?: string;
    currentVersion?: string;
    updateUrl?: string;
  } | null>;
  checkForUpdatesManually: () => Promise<{
    hasUpdate: boolean;
    latestVersion?: string;
    currentVersion?: string;
    updateUrl?: string;
  } | null>;
  clearUpdateInfo: () => void;
}

// Helper function for version comparison
const isVersionNewer = (
  newVersion: string,
  currentVersion: string,
): boolean => {
  const parseVersion = (version: string) => {
    return version.split(".").map((v) => parseInt(v) || 0);
  };

  const newV = parseVersion(newVersion);
  const currentV = parseVersion(currentVersion);

  for (let i = 0; i < Math.max(newV.length, currentV.length); i++) {
    const newPart = newV[i] || 0;
    const currentPart = currentV[i] || 0;

    if (newPart > currentPart) return true;
    if (newPart < currentPart) return false;
  }

  return false; // versions are equal
};

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export function VersionProvider({ children }: { children: React.ReactNode }) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastUpdateCheckRef = useRef<number>(0);
  const updateCheckCacheRef = useRef<{
    hasUpdate: boolean;
    latestVersion: string;
    currentVersion: string;
    updateUrl: string;
  } | null>(null);

  // Constants
  const UPDATE_CHECK_COOLDOWN = 1 * 60 * 1000; // 1 minute

  const fetchVersionInfo = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${config.api.baseUrl}/config/version`);
      if (response.ok) {
        const data = await response.json();
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
  }, []);

  const refreshVersionInfo = useCallback(async () => {
    setLoading(true);
    await fetchVersionInfo();
  }, [fetchVersionInfo]);

  const checkForUpdatesIfEnabled = useCallback(async () => {
    if (!versionInfo?.version) {
      console.log("No version info available, skipping update check");
      return null;
    }

    // Rate limiting: Check if we've checked recently
    const now = Date.now();
    if (now - lastUpdateCheckRef.current < UPDATE_CHECK_COOLDOWN) {
      console.log("Rate limited, returning cached result");
      // Return cached result if available
      if (updateCheckCacheRef.current) {
        const cached = updateCheckCacheRef.current;
        // Update global state from cache if there's an update
        if (cached.hasUpdate) {
          setUpdateInfo(cached);
        }
        return cached;
      }
      return null;
    }

    try {
      // First check if AUTO_CHECK_UPDATES is enabled
      const settingsResponse = await fetch(`${config.api.baseUrl}/config`);
      if (!settingsResponse.ok) {
        console.warn("Failed to fetch settings for update check");
        return null;
      }

      const settings = await settingsResponse.json();
      const autoCheckSetting = settings.find(
        (setting: any) => setting.key === "AUTO_CHECK_UPDATES",
      );
      const shouldAutoCheck = autoCheckSetting?.value === "true";

      if (!shouldAutoCheck) {
        return null; // Auto check is disabled
      }

      // Update last check time
      lastUpdateCheckRef.current = now;

      // Fetch latest release from GitHub API
      const response = await fetch(
        "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest",
      );
      if (!response.ok) {
        console.warn("Failed to check for updates:", response.status);
        return null;
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ""); // Remove 'v' prefix if present
      const currentVersion = versionInfo.version;

      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);

      const result = {
        hasUpdate,
        latestVersion,
        currentVersion,
        updateUrl: release.html_url,
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
        });
      }

      return result;
    } catch (error) {
      console.error("Failed to check for updates automatically:", error);
      return null;
    }
  }, [versionInfo?.version, UPDATE_CHECK_COOLDOWN]);

  const checkForUpdatesManually = useCallback(async () => {
    if (!versionInfo?.version) return null;

    try {
      // Manual check bypasses the AUTO_CHECK_UPDATES setting
      const response = await fetch(
        "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest",
      );
      if (!response.ok) {
        console.warn("Failed to check for updates:", response.status);
        return null;
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ""); // Remove 'v' prefix if present
      const currentVersion = versionInfo.version;

      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);

      const result = {
        hasUpdate,
        latestVersion,
        currentVersion,
        updateUrl: release.html_url,
      };

      // Update global state
      if (hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          latestVersion,
          currentVersion,
          updateUrl: release.html_url,
        });
      } else {
        setUpdateInfo(null);
      }

      return result;
    } catch (error) {
      console.error("Failed to check for updates manually:", error);
      return null;
    }
  }, [versionInfo?.version]);

  const clearUpdateInfo = useCallback(() => {
    setUpdateInfo(null);
  }, []);

  useEffect(() => {
    fetchVersionInfo();
  }, [fetchVersionInfo]);

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
