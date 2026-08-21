import { AdminUser } from '../entities/admin-user.entity';

// Admin user session data
type AdminSessionUser = AdminUser & {
  sessionId: string;
  userType: 'admin';
};

// Plex user session data (non-admin)
type PlexUserSession = {
  sessionId: string;
  userType: 'plex_user';
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AdminSessionUser | PlexUserSession;
      sessionId?: string;
    }
  }
}

export {};
