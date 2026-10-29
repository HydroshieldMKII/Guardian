import { InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Not } from 'typeorm';
import { Session } from '@/entities/session.entity';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { sessionRepository, storedSession } from '@/modules/auth/auth.fixture';

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let sessionRepo: ReturnType<typeof sessionRepository>;

  beforeEach(async () => {
    sessionRepo = sessionRepository();

    const module = await Test.createTestingModule({
      providers: [
        AuthSessionService,
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
      ],
    }).compile();

    service = module.get(AuthSessionService);
  });

  describe('createAdminSession', () => {
    it('stores an admin session with a fresh 64-character token', async () => {
      const result = await service.createAdminSession('admin-1');

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', userType: 'admin' }),
      );
      expect(result.token).toHaveLength(64);
    });
  });

  describe('createPlexUserSession', () => {
    const plexUser = {
      plexUserId: 'plex-9',
      plexUsername: 'guest',
      plexThumb: 'https://plex.tv/thumb.png',
    };

    it('stores a plex_user session with no admin user id', async () => {
      await service.createPlexUserSession(plexUser);

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          userType: 'plex_user',
          plexUserId: 'plex-9',
        }),
      );
    });

    it('returns the Plex identity alongside the token', async () => {
      const result = await service.createPlexUserSession(plexUser);
      expect(result.plexUsername).toBe('guest');
      expect(result.userType).toBe('plex_user');
      expect(result.token).toHaveLength(64);
    });

    it('normalises a missing thumbnail to undefined', async () => {
      const result = await service.createPlexUserSession({
        plexUserId: 'plex-9',
        plexUsername: 'guest',
      });

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ plexThumb: null }),
      );
      expect(result.plexThumb).toBeUndefined();
    });
  });

  describe('validateSession', () => {
    it('returns the admin user with the session id', async () => {
      const result = await service.validateSession('token-1');
      expect(result).toMatchObject({
        id: 'admin-1',
        sessionId: 'session-1',
        userType: 'admin',
      });
    });

    it('refreshes the last activity timestamp', async () => {
      const before = Date.now();
      await service.validateSession('token-1');

      const [saved] = sessionRepo.save.mock.calls[0] as [
        { lastActivityAt: Date },
      ];
      expect(saved.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('leaves lastActivityAt alone on a burst of requests', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession(),
        lastActivityAt: new Date(),
      });
      sessionRepo.save.mockClear();

      await service.validateSession('token-1');
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('refreshes a session that has never recorded activity', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession(),
        lastActivityAt: null,
      });
      sessionRepo.save.mockClear();

      await service.validateSession('token-1');
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('returns null for an unknown token', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.validateSession('nope')).resolves.toBeNull();
    });

    it('deletes and rejects an expired session', async () => {
      const expired = {
        ...storedSession(),
        expiresAt: new Date(Date.now() - 1000),
      };
      sessionRepo.findOne.mockResolvedValue(expired);

      await expect(service.validateSession('token-1')).resolves.toBeNull();
      expect(sessionRepo.remove).toHaveBeenCalledWith(expired);
    });

    it('returns the Plex identity for a plex_user session', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession(),
        userType: 'plex_user',
        userId: null,
        user: null,
        plexUserId: 'plex-9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      });

      await expect(service.validateSession('token-1')).resolves.toEqual({
        sessionId: 'session-1',
        userType: 'plex_user',
        plexUserId: 'plex-9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      });
    });

    it('leaves out the thumbnail of a Plex user who has none', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession(),
        userType: 'plex_user',
        userId: null,
        user: null,
        plexUserId: 'plex-9',
        plexUsername: 'guest',
        plexThumb: null,
      });

      const result = await service.validateSession('token-1');
      expect(result).toMatchObject({ plexUserId: 'plex-9' });
      expect(result).toHaveProperty('plexThumb', undefined);
    });

    it('rejects a plex_user session missing its identity', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession(),
        userType: 'plex_user',
        plexUserId: null,
        plexUsername: null,
      });

      await expect(service.validateSession('token-1')).resolves.toBeNull();
    });

    it('rejects an admin session whose user row has gone', async () => {
      sessionRepo.findOne.mockResolvedValue({ ...storedSession(), user: null });
      await expect(service.validateSession('token-1')).resolves.toBeNull();
    });

    it('returns null rather than throwing when the lookup fails', async () => {
      sessionRepo.findOne.mockRejectedValue(new Error('db down'));
      await expect(service.validateSession('token-1')).resolves.toBeNull();
    });
  });

  describe('session cleanup', () => {
    it('deletes the session on logout', async () => {
      await service.logout('token-1');
      expect(sessionRepo.delete).toHaveBeenCalledWith({ token: 'token-1' });
    });

    it('reports how many expired sessions were purged', async () => {
      await expect(service.cleanupExpiredSessions()).resolves.toBe(3);
    });

    it('reports zero when the purge affected nothing', async () => {
      sessionRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.cleanupExpiredSessions()).resolves.toBe(0);
    });

    it('reports zero when the driver omits the affected count', async () => {
      sessionRepo.delete.mockResolvedValue({});
      await expect(service.cleanupExpiredSessions()).resolves.toBe(0);
    });
  });

  describe('clearAllSessions', () => {
    it('spares the current session when one is given', async () => {
      await service.clearAllSessions('admin-1', 'session-1');

      expect(sessionRepo.delete).toHaveBeenCalledTimes(1);
      expect(sessionRepo.delete).toHaveBeenCalledWith({
        userId: 'admin-1',
        id: Not('session-1'),
      });
    });

    it('deletes every session when no current one is given', async () => {
      await service.clearAllSessions('admin-1');
      expect(sessionRepo.delete).toHaveBeenCalledWith({ userId: 'admin-1' });
    });

    it('reports a failure as a 500', async () => {
      sessionRepo.delete.mockRejectedValue(new Error('db down'));
      await expect(service.clearAllSessions('admin-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  it('expires new sessions seven days out', async () => {
    const result = await service.createAdminSession('admin-1');

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const drift = Math.abs(
      result.expiresAt.getTime() - (Date.now() + sevenDays),
    );
    expect(drift).toBeLessThan(5000);
  });
});
