import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { portalApi } from "@/lib/portal-api";
import { queryKeys } from "@/lib/query-keys";
import type { PortalDevice } from "@/types";

const NO_DEVICES: PortalDevice[] = [];

export function usePortalData(enabled: boolean) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const devices = useQuery({
    queryKey: queryKeys.portal.devices,
    queryFn: portalApi.devices,
    enabled,
  });
  const settings = useQuery({
    queryKey: queryKeys.portal.settings,
    queryFn: portalApi.settings,
    enabled,
  });
  const showRules = settings.data?.showRules === true;
  const rules = useQuery({
    queryKey: queryKeys.portal.rules,
    queryFn: portalApi.rules,
    enabled: enabled && showRules,
  });

  const lastFailure = Math.max(
    devices.errorUpdatedAt,
    settings.errorUpdatedAt,
    rules.errorUpdatedAt,
  );
  useEffect(() => {
    if (!lastFailure) return;
    toast({
      title: "Error",
      description: "Failed to load your data",
      variant: "destructive",
    });
  }, [lastFailure, toast]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal.all });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return {
    devices: devices.data ?? NO_DEVICES,
    settings: settings.data ?? null,
    userRules: showRules ? (rules.data ?? null) : null,
    loading:
      devices.isPending || settings.isPending || (showRules && rules.isPending),
    refreshing,
    refresh,
  };
}

export function useSendPortalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      description,
    }: {
      deviceId: number;
      description: string;
    }) => portalApi.sendNote(deviceId, description),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portal.all });
    },
  });
}
