import {
  compareDevices,
  groupDevicesByUser,
  groupName,
  matchesSearch,
  sortGroups,
  waitingQueue,
  withPreferenceChanges,
  type UserDeviceGroup,
} from "@/components/device-management/user-group";
import type { UserSort } from "@/components/device-management/UserList";
import type { UserDevice, UserPreference } from "@/types";

const group = (user: { userId: string; username?: string }) => ({
  user,
  devices: [],
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
});

describe("groupName", () => {
  it("prefers the username", () => {
    expect(groupName(group({ userId: "u-1", username: "alex" }))).toBe("alex");
  });

  it.each([undefined, ""])("falls back to the user id for %p", (username) => {
    expect(groupName(group({ userId: "u-1", username }))).toBe("u-1");
  });
});

describe("withPreferenceChanges", () => {
  const preference: UserPreference = {
    id: 1,
    userId: "u-1",
    defaultBlock: null,
    hidden: false,
    networkPolicy: "both",
    ipAccessPolicy: "all",
    concurrentStreamLimit: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("merges the changes into the matching user's preference", () => {
    const [updated] = withPreferenceChanges(
      [{ ...group({ userId: "u-1" }), user: { userId: "u-1", preference } }],
      "u-1",
      { concurrentStreamLimit: 3 },
    );

    expect(updated.user.preference).toEqual({
      ...preference,
      concurrentStreamLimit: 3,
    });
  });

  it("leaves other users untouched", () => {
    const other = {
      ...group({ userId: "u-2" }),
      user: { userId: "u-2", preference },
    };

    expect(
      withPreferenceChanges([other], "u-1", { concurrentStreamLimit: 3 })[0],
    ).toBe(other);
  });

  it("leaves a user without a stored preference for the refresh to fill", () => {
    const bare = group({ userId: "u-1" });

    expect(
      withPreferenceChanges([bare], "u-1", { concurrentStreamLimit: 3 })[0],
    ).toBe(bare);
  });
});

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  username: "alex",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  deviceProduct: "Plex for Roku",
  devicePlatform: "Roku",
  approved: true,
  status: "approved",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 0,
  ...overrides,
});

const userPreference = (
  overrides: Partial<UserPreference> = {},
): UserPreference => ({
  id: 1,
  userId: "u-1",
  defaultBlock: null,
  hidden: false,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("compareDevices", () => {
  const ids = (devices: UserDevice[]) =>
    [...devices].sort(compareDevices).map((d) => d.id);

  it("puts Plexamp last, newest first among them", () => {
    expect(
      ids([
        device({ id: 1, deviceProduct: "Plexamp", lastSeen: "2026-01-01" }),
        device({ id: 2, deviceProduct: "Plexamp", lastSeen: "2026-01-03" }),
        device({ id: 3, status: "approved" }),
      ]),
    ).toEqual([3, 2, 1]);
  });

  it("orders pending, then rejected, then approved, then by last seen", () => {
    expect(
      ids([
        device({ id: 1, status: "approved" }),
        device({ id: 2, status: "rejected" }),
        device({ id: 3, status: "pending", lastSeen: "2026-01-01" }),
        device({ id: 4, status: "pending", lastSeen: "2026-01-02" }),
      ]),
    ).toEqual([4, 3, 2, 1]);
  });
});

describe("groupDevicesByUser", () => {
  it("groups devices under their user and counts them", () => {
    const [group] = groupDevicesByUser(
      [
        device({ id: 1, status: "pending", lastSeen: "2026-01-02T00:00:00Z" }),
        device({ id: 2, status: "pending", deviceProduct: "Plexamp" }),
        device({ id: 3, status: "approved" }),
        device({ id: 4, status: "rejected", lastSeen: "2026-01-05T00:00:00Z" }),
      ],
      [userPreference()],
    );

    expect(group).toMatchObject({
      user: { userId: "u-1", username: "alex" },
      pendingCount: 1,
      approvedCount: 1,
      rejectedCount: 1,
      lastSeen: new Date("2026-01-05T00:00:00Z"),
    });
    expect(group.user.preference?.id).toBe(1);
    expect(group.devices.map((d) => d.id)).toEqual([1, 4, 3, 2]);
  });

  it("takes the username from a later device when the first has none", () => {
    const [group] = groupDevicesByUser(
      [device({ id: 1, username: undefined }), device({ id: 2 })],
      [],
    );

    expect(group.user.username).toBe("alex");
  });

  it("keeps a user who has no devices yet", () => {
    const groups = groupDevicesByUser(
      [],
      [userPreference({ userId: "u-2", username: "sam" })],
    );

    expect(groups).toEqual([
      {
        user: {
          userId: "u-2",
          username: "sam",
          preference: expect.objectContaining({ userId: "u-2" }) as unknown,
        },
        devices: [],
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      },
    ]);
  });

  it("leaves hidden users out", () => {
    expect(
      groupDevicesByUser([device()], [userPreference({ hidden: true })]),
    ).toEqual([]);
  });

  it("does not reorder the devices it was given", () => {
    const devices = [
      device({ id: 1, status: "approved" }),
      device({ id: 2, status: "pending" }),
    ];

    groupDevicesByUser(devices, []);

    expect(devices.map((d) => d.id)).toEqual([1, 2]);
  });
});

describe("matchesSearch", () => {
  const target: UserDeviceGroup = {
    ...group({ userId: "u-1", username: "Alex" }),
    devices: [device({ deviceName: "", deviceIdentifier: "Bedroom-Stick" })],
  };

  it.each(["", "   ", "alex", "BEDROOM", "roku", "plex for"])(
    "matches %p",
    (term) => {
      expect(matchesSearch(target, term)).toBe(true);
    },
  );

  it("misses a term found nowhere", () => {
    expect(matchesSearch(target, "kitchen")).toBe(false);
  });

  it("searches a device with no details at all", () => {
    const bare = {
      ...group({ userId: "u-2" }),
      devices: [
        device({
          deviceName: undefined,
          deviceIdentifier: "",
          devicePlatform: undefined,
          deviceProduct: undefined,
        }),
      ],
    };

    expect(matchesSearch(bare, "u-2")).toBe(true);
    expect(matchesSearch(bare, "roku")).toBe(false);
  });
});

describe("sortGroups", () => {
  const groups: UserDeviceGroup[] = [
    {
      ...group({ userId: "u-1", username: "bea" }),
      devices: [device({ sessionCount: 5 })],
      pendingCount: 2,
      lastSeen: new Date("2026-01-02"),
    },
    {
      ...group({ userId: "u-2", username: "Alex" }),
      devices: [device(), device({ sessionCount: 1 })],
      pendingCount: 0,
    },
    {
      ...group({ userId: "u-3", username: "cy" }),
      devices: [],
      pendingCount: 1,
      lastSeen: new Date("2026-01-03"),
    },
  ];
  const order = (sortBy: UserSort, sortOrder: "asc" | "desc") =>
    sortGroups(groups, sortBy, sortOrder).map((g) => g.user.userId);

  it.each([
    ["username", "asc", ["u-2", "u-1", "u-3"]],
    ["username", "desc", ["u-3", "u-1", "u-2"]],
    ["deviceCount", "desc", ["u-2", "u-1", "u-3"]],
    ["pendingCount", "asc", ["u-2", "u-3", "u-1"]],
    ["lastSeen", "desc", ["u-3", "u-1", "u-2"]],
    ["streamCount", "desc", ["u-1", "u-2", "u-3"]],
  ] as const)("sorts by %s %s", (sortBy, sortOrder, expected) => {
    expect(order(sortBy, sortOrder)).toEqual(expected);
  });

  it("falls back to the username for a stored sort it does not know", () => {
    expect(order("retired" as UserSort, "asc")).toEqual(["u-2", "u-1", "u-3"]);
  });

  it("does not reorder the list it was given", () => {
    order("username", "desc");
    expect(groups.map((g) => g.user.userId)).toEqual(["u-1", "u-2", "u-3"]);
  });
});

describe("waitingQueue", () => {
  it("lists waiting devices across users, newest first", () => {
    const first = {
      ...group({ userId: "u-1" }),
      devices: [
        device({ id: 1, status: "pending", lastSeen: "2026-01-01" }),
        device({ id: 2, status: "approved" }),
        device({ id: 3, status: "pending", deviceProduct: "Plexamp" }),
      ],
    };
    const second = {
      ...group({ userId: "u-2" }),
      devices: [device({ id: 4, status: "pending", lastSeen: "2026-01-04" })],
    };

    const queue = waitingQueue([first, second]);

    expect(queue.map((item) => item.device.id)).toEqual([4, 1]);
    expect(queue[0].group).toBe(second);
  });
});
