"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { endsAfterStart, sortTimeRules } from "@/lib/time-rules";
import { timeRulesApi, type TimeRulePreset } from "@/lib/time-rules-api";
import type {
  CreateTimeRuleDto,
  UpdateTimeRuleDto,
  UserTimeRule,
} from "@/types";

const INVALID_RANGE = "End time must be greater than start time";

const appliesTo =
  (deviceIdentifier?: string) =>
  (rule: UserTimeRule): boolean =>
    deviceIdentifier
      ? rule.deviceIdentifier === deviceIdentifier
      : !rule.deviceIdentifier;

export function useTimeRulesForUsers(userIds: string[]) {
  const ids = [...new Set(userIds)].sort();

  return useQuery({
    queryKey: queryKeys.timeRules.forUsers(ids),
    queryFn: () => timeRulesApi.forUsers(ids),
    enabled: ids.length > 0,
  });
}

export function useTimeRules(
  userId: string,
  deviceIdentifier?: string,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.timeRules.forUser(userId),
    queryFn: () => timeRulesApi.forUser(userId),
    enabled: enabled && userId !== "",
  });

  const rules = useMemo(
    () => sortTimeRules((query.data ?? []).filter(appliesTo(deviceIdentifier))),
    [query.data, deviceIdentifier],
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.timeRules.all }),
    [queryClient],
  );

  const createTimeRule = async (rule: CreateTimeRuleDto) => {
    if (!endsAfterStart(rule.startTime, rule.endTime)) {
      throw new Error(INVALID_RANGE);
    }
    const created = await timeRulesApi.create(userId, rule);
    await refresh();
    return created;
  };

  const updateTimeRule = async (ruleId: number, updates: UpdateTimeRuleDto) => {
    const existing = query.data?.find((rule) => rule.id === ruleId);
    if (
      (updates.startTime || updates.endTime) &&
      existing &&
      !endsAfterStart(
        updates.startTime || existing.startTime,
        updates.endTime || existing.endTime,
      )
    ) {
      throw new Error(INVALID_RANGE);
    }
    const updated = await timeRulesApi.update(userId, ruleId, updates);
    await refresh();
    return updated;
  };

  const deleteTimeRules = async (ruleIds: number[]) => {
    try {
      await Promise.all(
        ruleIds.map((ruleId) => timeRulesApi.remove(userId, ruleId)),
      );
    } finally {
      await refresh();
    }
  };

  const applyPreset = async (presetType: TimeRulePreset) => {
    const created = await timeRulesApi.applyPreset(
      userId,
      presetType,
      deviceIdentifier,
    );
    await refresh();
    return created;
  };

  return {
    rules,
    isLoading: query.isLoading,
    isError: query.isError,
    createTimeRule,
    updateTimeRule,
    deleteTimeRule: (ruleId: number) => deleteTimeRules([ruleId]),
    deleteTimeRules,
    applyPreset,
  };
}
