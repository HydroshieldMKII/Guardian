import {
  groupName,
  withPreferenceChanges,
} from "@/components/device-management/user-group";
import type { UserPreference } from "@/types";

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
