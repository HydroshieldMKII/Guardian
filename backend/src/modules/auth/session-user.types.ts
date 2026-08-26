import { AdminUser } from '@/entities/admin-user.entity';

export type AdminSessionUser = AdminUser & {
  sessionId: string;
  userType: 'admin';
};

export type PlexUserSession = {
  sessionId: string;
  userType: 'plex_user';
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
};

export type SessionUser = AdminSessionUser | PlexUserSession;
