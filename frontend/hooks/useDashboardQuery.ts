"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";
import { queryKeys } from "@/lib/query-keys";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import type { UnifiedDashboardData } from "@/types";

export function useDashboardQuery(enabled: boolean) {
  const queryClient = useQueryClient();

  const applyLiveDashboard = useCallback(
    (payload: UnifiedDashboardData) => {
      queryClient.setQueryData(queryKeys.dashboard, payload);
    },
    [queryClient],
  );

  const { connected } = useLiveDashboard<UnifiedDashboardData>(
    applyLiveDashboard,
    enabled,
  );

  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiClient.getDashboardData<UnifiedDashboardData>(),
    enabled,
    refetchInterval: connected ? false : config.app.refreshInterval,
  });
}
