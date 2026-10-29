import type { AdminUser, PlexUser } from "@/contexts/auth-context";
import { userIdentity } from "./user-identity";

const admin: AdminUser = {
  id: "1",
  username: "site admin",
  email: "admin@example.com",
  avatarUrl: "/admin.png",
};

const plexUser: PlexUser = {
  plexUserId: "42",
  plexUsername: "viewer",
  plexThumb: "/viewer.png",
};

describe("userIdentity", () => {
  it("describes an admin by username and email", () => {
    expect(userIdentity(admin)).toEqual({
      name: "site admin",
      email: "admin@example.com",
      avatarUrl: "/admin.png",
      initials: "SA",
    });
  });

  it("describes a Plex user without an email", () => {
    expect(userIdentity(plexUser)).toEqual({
      name: "viewer",
      email: "",
      avatarUrl: "/viewer.png",
      initials: "V",
    });
  });

  it("keeps at most two initials", () => {
    expect(userIdentity({ ...admin, username: "one two three" }).initials).toBe(
      "OT",
    );
  });

  it("falls back to a question mark without a name", () => {
    expect(userIdentity({ ...admin, username: "" }).initials).toBe("?");
    expect(userIdentity(null)).toEqual({ name: "", email: "", initials: "?" });
  });
});
