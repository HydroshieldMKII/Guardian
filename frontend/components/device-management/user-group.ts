import type { UserSort } from "@/components/device-management/UserList";
import { isPlexampDevice, isWaitingDevice } from "@/lib/device-policies";
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

const STATUS_ORDER: Record<UserDevice["status"], number> = {
  pending: 0,
  rejected: 1,
  approved: 2,
};

const lastSeenTime = (device: UserDevice) =>
  new Date(device.lastSeen).getTime();

const emptyGroup = (
  userId: string,
  username: string | undefined,
  preference: UserPreference | undefined,
): UserDeviceGroup => ({
  user: { userId, username, preference },
  devices: [],
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
});

export const compareDevices = (a: UserDevice, b: UserDevice): number => {
  const aIsPlexamp = isPlexampDevice(a);
  const bIsPlexamp = isPlexampDevice(b);
  if (aIsPlexamp !== bIsPlexamp) return aIsPlexamp ? 1 : -1;
  if (!aIsPlexamp && a.status !== b.status) {
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  }
  return lastSeenTime(b) - lastSeenTime(a);
};

const countDevice = (group: UserDeviceGroup, device: UserDevice) => {
  if (device.status === "pending") {
    if (!isPlexampDevice(device)) group.pendingCount++;
  } else if (device.status === "approved") {
    group.approvedCount++;
  } else {
    group.rejectedCount++;
  }
};

export const groupDevicesByUser = (
  devices: UserDevice[],
  users: UserPreference[],
): UserDeviceGroup[] => {
  const groups = new Map<string, UserDeviceGroup>();

  for (const device of devices) {
    let group = groups.get(device.userId);
    if (!group) {
      group = emptyGroup(
        device.userId,
        device.username,
        users.find((user) => user.userId === device.userId),
      );
      groups.set(device.userId, group);
    }

    group.devices.push(device);
    countDevice(group, device);

    if (!group.user.username && device.username) {
      group.user.username = device.username;
    }

    if (device.lastSeen) {
      const seen = new Date(device.lastSeen);
      if (!group.lastSeen || seen > group.lastSeen) group.lastSeen = seen;
    }
  }

  for (const user of users) {
    if (!groups.has(user.userId)) {
      groups.set(user.userId, emptyGroup(user.userId, user.username, user));
    }
  }

  return Array.from(groups.values())
    .filter((group) => !group.user.preference?.hidden)
    .map((group) => ({
      ...group,
      devices: [...group.devices].sort(compareDevices),
    }));
};

const searchableText = (device: UserDevice) => [
  device.deviceName || device.deviceIdentifier || "",
  device.devicePlatform || "",
  device.deviceProduct || "",
];

export const matchesSearch = (
  group: UserDeviceGroup,
  searchTerm: string,
): boolean => {
  if (!searchTerm.trim()) return true;
  const needle = searchTerm.toLowerCase();
  return (
    groupName(group).toLowerCase().includes(needle) ||
    group.devices.some((device) =>
      searchableText(device).some((text) =>
        text.toLowerCase().includes(needle),
      ),
    )
  );
};

const totalStreams = (group: UserDeviceGroup) =>
  group.devices.reduce(
    (total, device) => total + (device.sessionCount || 0),
    0,
  );

const SORT_VALUE: Record<
  UserSort,
  (group: UserDeviceGroup) => string | number
> = {
  username: (group) => groupName(group).toLowerCase(),
  deviceCount: (group) => group.devices.length,
  pendingCount: (group) => group.pendingCount,
  lastSeen: (group) => group.lastSeen?.getTime() ?? 0,
  streamCount: totalStreams,
};

export const sortGroups = (
  groups: UserDeviceGroup[],
  sortBy: UserSort,
  sortOrder: "asc" | "desc",
): UserDeviceGroup[] => {
  const valueOf = SORT_VALUE[sortBy] ?? SORT_VALUE.username;
  const direction = sortOrder === "asc" ? 1 : -1;
  return [...groups].sort((a, b) => {
    const valueA = valueOf(a);
    const valueB = valueOf(b);
    const comparison =
      typeof valueA === "number" && typeof valueB === "number"
        ? valueA - valueB
        : String(valueA).localeCompare(String(valueB));
    return comparison * direction;
  });
};

export const waitingQueue = (groups: UserDeviceGroup[]) =>
  groups
    .flatMap((group) =>
      group.devices
        .filter(isWaitingDevice)
        .map((device) => ({ device, group })),
    )
    .sort((a, b) => lastSeenTime(b.device) - lastSeenTime(a.device));
