import type { UserDevice, UserPreference } from "@/types";

export interface UserDeviceGroup {
  user: {
    userId: string;
    username?: string;
    preference?: UserPreference;
  };
  devices: UserDevice[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  lastSeen?: Date;
}

export const groupName = (group: UserDeviceGroup) =>
  group.user.username || group.user.userId;

export const withPreferenceChanges = (
  groups: UserDeviceGroup[],
  userId: string,
  changes: Partial<UserPreference>,
): UserDeviceGroup[] =>
  groups.map((group) =>
    group.user.userId === userId && group.user.preference
      ? {
          ...group,
          user: {
            ...group.user,
            preference: { ...group.user.preference, ...changes },
          },
        }
      : group,
  );
