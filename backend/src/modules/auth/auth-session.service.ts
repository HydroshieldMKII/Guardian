import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import * as crypto from 'crypto';
import { Session, SessionUserType } from '@/entities/session.entity';
import { SessionDto } from '@/modules/auth/dto/session.dto';
import { SESSION_DURATION_MS } from '@/modules/auth/session-cookie';
import { SessionUser } from '@/modules/auth/session-user.types';

const ACTIVITY_REFRESH_MS = 5 * 60 * 1000;

const newSessionCredentials = () => ({
  token: crypto.randomBytes(32).toString('hex'),
  expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  lastActivityAt: new Date(),
});

export interface PlexUserSessionInfo {
  token: string;
  expiresAt: Date;
  userType: SessionUserType;
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
}

@Injectable()
export class AuthSessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
  ) {}

  async createAdminSession(userId: string): Promise<SessionDto> {
    const session = await this.sessionRepository.save({
      ...newSessionCredentials(),
      userId,
      userType: 'admin',
    });

    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  async createPlexUserSession(plexUserInfo: {
    plexUserId: string;
    plexUsername: string;
    plexThumb?: string;
  }): Promise<PlexUserSessionInfo> {
    const session = await this.sessionRepository.save({
      ...newSessionCredentials(),
      userId: null,
      userType: 'plex_user',
      plexUserId: plexUserInfo.plexUserId,
      plexUsername: plexUserInfo.plexUsername,
      plexThumb: plexUserInfo.plexThumb || null,
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      userType: session.userType,
      plexUserId: session.plexUserId,
      plexUsername: session.plexUsername,
      plexThumb: session.plexThumb || undefined,
    };
  }

  async validateSession(token: string): Promise<SessionUser | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { token },
        relations: ['user'],
      });

      if (!session) {
        return null;
      }

      if (new Date() > session.expiresAt) {
        await this.sessionRepository.remove(session);
        return null;
      }

      await this.refreshActivity(session);

      if (session.userType === 'plex_user') {
        if (!session.plexUserId || !session.plexUsername) {
          return null;
        }
        return {
          sessionId: session.id,
          userType: 'plex_user',
          plexUserId: session.plexUserId,
          plexUsername: session.plexUsername,
          plexThumb: session.plexThumb || undefined,
        };
      }

      if (!session.user) {
        return null;
      }

      return {
        ...session.user,
        sessionId: session.id,
        userType: 'admin',
      };
    } catch {
      return null;
    }
  }

  private async refreshActivity(session: Session): Promise<void> {
    const now = new Date();
    const lastActivity = session.lastActivityAt?.getTime() ?? 0;
    if (now.getTime() - lastActivity > ACTIVITY_REFRESH_MS) {
      session.lastActivityAt = now;
      await this.sessionRepository.save(session);
    }
  }

  async logout(token: string): Promise<void> {
    await this.sessionRepository.delete({ token });
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  async clearAllSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<void> {
    try {
      if (currentSessionId) {
        await this.sessionRepository.delete({
          userId,
          id: Not(currentSessionId),
        });
      } else {
        await this.sessionRepository.delete({ userId });
      }
    } catch {
      throw new InternalServerErrorException('Failed to clear sessions');
    }
  }
}
