import { apiClient } from "@/lib/api";
import type {
  CreateTimeRuleDto,
  UpdateTimeRuleDto,
  UserTimeRule,
} from "@/types";

export type TimeRulePreset = "weekdays-only" | "weekends-only";
export type TimeRulesByUser = Record<string, UserTimeRule[]>;

const rulesPath = (userId: string) =>
  `/users/${encodeURIComponent(userId)}/rules`;

export const timeRulesApi = {
  forUser: (userId: string) =>
    apiClient.get<UserTimeRule[]>(`${rulesPath(userId)}/all`),
  forUsers: (userIds: string[]) =>
    apiClient.post<TimeRulesByUser>("/rules/batch", { userIds }),
  create: (userId: string, rule: CreateTimeRuleDto) =>
    apiClient.post<UserTimeRule>(rulesPath(userId), rule),
  update: (userId: string, ruleId: number, updates: UpdateTimeRuleDto) =>
    apiClient.put<UserTimeRule>(`${rulesPath(userId)}/${ruleId}`, updates),
  remove: (userId: string, ruleId: number) =>
    apiClient.delete<void>(`${rulesPath(userId)}/${ruleId}`),
  applyPreset: (
    userId: string,
    presetType: TimeRulePreset,
    deviceIdentifier?: string,
  ) =>
    apiClient.post<UserTimeRule[]>(`${rulesPath(userId)}/preset`, {
      presetType,
      deviceIdentifier: deviceIdentifier || undefined,
    }),
};
