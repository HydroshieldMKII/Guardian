import {
  AdminSessionUser,
  PlexUserSession,
} from '@/modules/auth/session-user.types';

declare global {
  namespace Express {
    interface Request {
      user?: AdminSessionUser | PlexUserSession;
      sessionId?: string;
    }
  }
}

export {};
