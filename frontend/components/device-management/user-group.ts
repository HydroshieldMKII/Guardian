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
