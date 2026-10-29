"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/query-keys";
import { settingsApi } from "@/lib/settings-api";
import type { AppSetting } from "@/types";

export interface SettingUpdate {
  key: string;
  value: unknown;
}

const NO_SETTINGS: AppSetting[] = [];

const applyUpdates = (settings: AppSetting[], updates: SettingUpdate[]) => {
  const values = new Map(updates.map(({ key, value }) => [key, String(value)]));
  return settings.map((setting) => {
    const value = values.get(setting.key);
    return value === undefined ? setting : { ...setting, value };
  });
};

export function useSettings() {
  const {
    setupRequired,
    isLoading: authLoading,
    isAuthenticated,
    user,
  } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings = NO_SETTINGS, isPending } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.list,
    enabled:
      !setupRequired && !authLoading && isAuthenticated && isAdminUser(user),
    staleTime: Infinity,
  });

  const refreshSettings = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
    [queryClient],
  );

  const updateSettings = useCallback(
    (updates: SettingUpdate[]) => {
      queryClient.setQueryData<AppSetting[]>(
        queryKeys.settings,
        (prev) => prev && applyUpdates(prev, updates),
      );
    },
    [queryClient],
  );

  const getSetting = (key: string) =>
    settings.find((setting) => setting.key === key)?.value ?? null;

  const getGlobalDefaultBlock = () => {
    const value = getSetting("PLEX_GUARD_DEFAULT_BLOCK");
    return value === null || value === "true";
  };

  return {
    settings,
    loading: isPending,
    refreshSettings,
    updateSettings,
    getSetting,
    getGlobalDefaultBlock,
  };
}
