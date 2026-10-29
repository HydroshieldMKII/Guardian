"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/query-keys";
import { versionApi } from "@/lib/version-api";

export function useVersionInfo() {
  const {
    setupRequired,
    isLoading: authLoading,
    isAuthenticated,
    user,
  } = useAuth();
  const queryClient = useQueryClient();

  const { data: versionInfo = null } = useQuery({
    queryKey: queryKeys.version.info,
    queryFn: versionApi.info,
    enabled:
      !setupRequired && !authLoading && isAuthenticated && isAdminUser(user),
    staleTime: Infinity,
  });

  const refreshVersionInfo = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.version.info }),
    [queryClient],
  );

  return { versionInfo, refreshVersionInfo };
}
