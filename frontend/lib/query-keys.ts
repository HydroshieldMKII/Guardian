import type { SessionHistoryFilter } from "@/lib/session-history-api";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  hiddenUsers: ["users", "hidden"] as const,
  sessionHistory: {
    all: ["sessionHistory"] as const,
    forUser: (userId: string, filter: SessionHistoryFilter) =>
      ["sessionHistory", userId, filter] as const,
  },
  timeRules: {
    all: ["timeRules"] as const,
    forUser: (userId: string) => ["timeRules", "user", userId] as const,
    forUsers: (userIds: string[]) => ["timeRules", "users", userIds] as const,
  },
};
