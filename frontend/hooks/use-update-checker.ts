"use client";

import { useState, useCallback } from 'react';
import { useVersion } from '@/contexts/version-context';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  updateUrl: string;
}

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const { checkForUpdatesIfEnabled } = useVersion();

  const checkForUpdatesAutomatically = useCallback(async () => {
    setCheckingUpdates(true);
    try {
      const result = await checkForUpdatesIfEnabled();
      if (result && result.hasUpdate) {
        setUpdateInfo({
          hasUpdate: result.hasUpdate,
          latestVersion: result.latestVersion!,
          currentVersion: result.currentVersion!,
          updateUrl: result.updateUrl!,
        });
      } else {
        setUpdateInfo(null);
      }
    } catch (error) {
      console.error('Auto update check failed:', error);
    } finally {
      setCheckingUpdates(false);
    }
  }, [checkForUpdatesIfEnabled]);

  const clearUpdateInfo = useCallback(() => {
    setUpdateInfo(null);
  }, []);

  return {
    updateInfo,
    checkingUpdates,
    checkForUpdatesAutomatically,
    clearUpdateInfo,
  };
}