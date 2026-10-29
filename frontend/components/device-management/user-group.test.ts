import { groupName } from "@/components/device-management/user-group";

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
