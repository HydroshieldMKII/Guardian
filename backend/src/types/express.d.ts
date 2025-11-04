import { AdminUser } from '../entities/admin-user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: AdminUser & { sessionId?: string };
      sessionId?: string;
    }
  }
}

export {};
