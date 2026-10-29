export const queryKeys = {
  dashboard: ["dashboard"] as const,
  hiddenUsers: ["users", "hidden"] as const,
  timeRules: {
    all: ["timeRules"] as const,
    forUser: (userId: string) => ["timeRules", "user", userId] as const,
    forUsers: (userIds: string[]) => ["timeRules", "users", userIds] as const,
  },
};
