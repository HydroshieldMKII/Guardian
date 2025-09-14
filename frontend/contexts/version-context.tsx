"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { config } from '@/lib/config';

interface VersionInfo {
  version: string;
  name: string;
  databaseVersion: string;
  codeVersion: string;
  isVersionMismatch: boolean;
}

interface VersionContextType {
  versionInfo: VersionInfo | null;
  loading: boolean;
  error: string | null;
  refreshVersionInfo: () => Promise<void>;
  checkForUpdatesIfEnabled: () => Promise<{
    hasUpdate: boolean;
    latestVersion?: string;
    currentVersion?: string;
    updateUrl?: string;
  } | null>;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export function VersionProvider({ children }: { children: React.ReactNode }) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersionInfo = async () => {
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
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refreshVersionInfo = async () => {
    setLoading(true);
    await fetchVersionInfo();
  };

  const checkForUpdatesIfEnabled = async () => {
    if (!versionInfo?.version) return null;
    
    try {
      // First check if AUTO_CHECK_UPDATES is enabled
      const settingsResponse = await fetch(`${config.api.baseUrl}/config`);
      if (!settingsResponse.ok) {
        console.warn('Failed to fetch settings for update check');
        return null;
      }
      
      const settings = await settingsResponse.json();
      const autoCheckSetting = settings.find((setting: any) => setting.key === 'AUTO_CHECK_UPDATES');
      const shouldAutoCheck = autoCheckSetting?.value === 'true';
      
      if (!shouldAutoCheck) {
        return null; // Auto check is disabled
      }
      
      // Fetch latest release from GitHub API
      const response = await fetch('https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest');
      if (!response.ok) {
        console.warn('Failed to check for updates:', response.status);
        return null;
      }
      
      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      const currentVersion = versionInfo.version;
      
      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);
      
      return {
        hasUpdate,
        latestVersion,
        currentVersion,
        updateUrl: release.html_url,
      };
    } catch (error) {
      console.error('Failed to check for updates automatically:', error);
      return null;
    }
  };

  const isVersionNewer = (newVersion: string, currentVersion: string): boolean => {
    const parseVersion = (version: string) => {
      return version.split('.').map(v => parseInt(v) || 0);
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

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  return (
    <VersionContext.Provider value={{
      versionInfo,
      loading,
      error,
      refreshVersionInfo,
      checkForUpdatesIfEnabled
    }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  const context = useContext(VersionContext);
  if (context === undefined) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
}