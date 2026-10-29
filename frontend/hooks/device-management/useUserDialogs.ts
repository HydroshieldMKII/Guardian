import { useState } from "react";
import type { UserDeviceGroup } from "@/components/device-management/user-group";

export interface DialogUser {
  userId: string;
  username?: string;
}

export interface TimeRuleTarget extends DialogUser {
  deviceIdentifier?: string;
}

export function useUserDialogs(userGroups: UserDeviceGroup[]) {
  const [historyUser, setHistoryUser] = useState<DialogUser | null>(null);
  const [timeRuleUser, setTimeRuleUser] = useState<TimeRuleTarget | null>(null);
  const [temporaryAccessUser, setTemporaryAccessUser] =
    useState<DialogUser | null>(null);

  const findGroup = (userId: string) =>
    userGroups.find((group) => group.user.userId === userId);

  const showHistory = (userId: string) => {
    const user = findGroup(userId)?.user;
    setHistoryUser({
      userId,
      username: user?.username || user?.preference?.username,
    });
  };

  const showTimeRules = (userId: string, deviceIdentifier?: string) => {
    const group = findGroup(userId);
    if (!group) return;
    setTimeRuleUser({
      userId: group.user.userId,
      username: group.user.username,
      deviceIdentifier,
    });
  };

  const showTemporaryAccess = (userId: string) => {
    const group = findGroup(userId);
    if (!group) return;
    setTemporaryAccessUser({
      userId: group.user.userId,
      username: group.user.username,
    });
  };

  return {
    historyUser,
    showHistory,
    closeHistory: () => setHistoryUser(null),
    timeRuleUser,
    showTimeRules,
    closeTimeRules: () => setTimeRuleUser(null),
    temporaryAccessUser,
    temporaryAccessDevices: temporaryAccessUser
      ? (findGroup(temporaryAccessUser.userId)?.devices ?? [])
      : [],
    showTemporaryAccess,
    closeTemporaryAccess: () => setTemporaryAccessUser(null),
  };
}
