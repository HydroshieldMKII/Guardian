import { isAdminUser, isPlexUser, type User } from "@/contexts/auth-context";

export interface UserIdentity {
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
}

const initialsOf = (name: string) =>
  name
    ? name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "?";

export function userIdentity(user: User | null): UserIdentity {
  if (isAdminUser(user)) {
    return {
      name: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      initials: initialsOf(user.username),
    };
  }
  if (isPlexUser(user)) {
    return {
      name: user.plexUsername,
      email: "",
      avatarUrl: user.plexThumb,
      initials: initialsOf(user.plexUsername),
    };
  }
  return { name: "", email: "", initials: "?" };
}
