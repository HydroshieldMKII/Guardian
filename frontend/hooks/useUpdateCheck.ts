"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/hooks/useSettings";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { queryKeys } from "@/lib/query-keys";
import { updateInfoFor } from "@/lib/version";
import { versionApi } from "@/lib/version-api";

export const UPDATE_CHECK_COOLDOWN_MS = 60 * 1000;
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function useUpdateCheck() {
  const { versionInfo } = useVersionInfo();
  const { getSetting } = useSettings();
  const queryClient = useQueryClient();
  const installedVersion = versionInfo?.version;

  const { data: release } = useQuery({
    queryKey: queryKeys.version.latestRelease,
    queryFn: versionApi.latestRelease,
    enabled:
      Boolean(installedVersion) && getSetting("AUTO_CHECK_UPDATES") === "true",
    staleTime: UPDATE_CHECK_COOLDOWN_MS,
    refetchInterval: UPDATE_CHECK_INTERVAL_MS,
  });

  const checkForUpdatesManually = useCallback(async () => {
    if (!installedVersion) return null;
    try {
      const latest = await queryClient.fetchQuery({
        queryKey: queryKeys.version.latestRelease,
        queryFn: versionApi.latestRelease,
        staleTime: 0,
      });
      return updateInfoFor(latest, installedVersion);
    } catch {
      return null;
    }
  }, [installedVersion, queryClient]);

  return {
    updateInfo:
      release && installedVersion
        ? updateInfoFor(release, installedVersion)
        : null,
    checkForUpdatesManually,
  };
}
