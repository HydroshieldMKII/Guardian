export interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  plexUserId?: string;
  plexUsername?: string;
  plexEmail?: string;
  plexThumb?: string;
}

export interface PlexUser {
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
}

export type User = AdminUser | PlexUser;

export type UserType = "admin" | "plex_user";

export interface Session {
  user: User | null;
  userType: UserType | null;
}

export const SIGNED_OUT: Session = { user: null, userType: null };

export function isAdminUser(user: User | null): user is AdminUser {
  return user !== null && "id" in user && "username" in user;
}

export function isPlexUser(user: User | null): user is PlexUser {
  return user !== null && "plexUserId" in user && !("id" in user);
}
