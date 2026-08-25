import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '@/entities/admin-user.entity';
import { Session } from '@/entities/session.entity';
import { AppSettings } from '@/entities/app-settings.entity';
import { AuthService } from '@/modules/auth/auth.service';

jest.mock('bcrypt');

const hash = jest.mocked(bcrypt.hash);
const compare = jest.mocked(bcrypt.compare);

describe('AuthService', () => {
  let service: AuthService;
  let adminRepo: {
    count: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let sessionRepo: Record<string, jest.Mock>;
  let settingsRepo: { findOne: jest.Mock };
  let deleteQueryBuilder: Record<string, jest.Mock>;

  const admin = {
    id: 'admin-1',
    username: 'vincent',
    email: 'v@example.com',
    avatarUrl: undefined,
    passwordHash: 'stored-hash',
  };

  const storedSession = {
    id: 'session-1',
    userId: 'admin-1',
    token: 'token-1',
    userType: 'admin' as const,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    lastActivityAt: new Date('2026-01-01T00:00:00Z'),
    plexUserId: null,
    plexUsername: null,
    plexThumb: null,
    user: admin,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    hash.mockImplementation(async () => 'new-hash');
    compare.mockImplementation(async () => true);

    deleteQueryBuilder = {
      delete: jest.fn(),
      where: jest.fn(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    deleteQueryBuilder.delete.mockReturnValue(deleteQueryBuilder);
    deleteQueryBuilder.where.mockReturnValue(deleteQueryBuilder);

    adminRepo = {
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation(async (entity) => ({
        id: 'admin-1',
        ...entity,
      })),
      findOne: jest.fn().mockResolvedValue({ ...admin }),
      manager: {
        transaction: jest.fn(
          async (run: (manager: { getRepository: () => unknown }) => unknown) =>
            run({ getRepository: () => adminRepo }),
        ),
      },
    };

    sessionRepo = {
      save: jest.fn().mockImplementation(async (entity) => ({
        ...storedSession,
        ...entity,
      })),
      findOne: jest.fn().mockResolvedValue({ ...storedSession }),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
      createQueryBuilder: jest.fn().mockReturnValue(deleteQueryBuilder),
    };

    settingsRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: getRepositoryToken(AppSettings), useValue: settingsRepo },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('hasAdminUsers', () => {
    it('is false on a fresh install', async () => {
      await expect(service.hasAdminUsers()).resolves.toBe(false);
    });

    it('is true once an admin exists', async () => {
      adminRepo.count.mockResolvedValue(1);
      await expect(service.hasAdminUsers()).resolves.toBe(true);
    });
  });

  describe('createAdmin', () => {
    const dto = {
      username: 'vincent',
      email: 'v@example.com',
      password: 'hunter2hunter2',
      confirmPassword: 'hunter2hunter2',
    };

    it('hashes the password at cost 12 and returns a session', async () => {
      const result = await service.createAdmin(dto);

      expect(hash).toHaveBeenCalledWith('hunter2hunter2', 12);
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'new-hash' }),
      );
      expect(result.user.username).toBe('vincent');
      expect(result.session.token).toHaveLength(64);
    });

    it('never returns the password hash to the caller', async () => {
      const result = await service.createAdmin(dto);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('refuses a second admin', async () => {
      adminRepo.count.mockResolvedValue(1);
      await expect(service.createAdmin(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('re-checks for an existing admin inside the transaction', async () => {
      adminRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await expect(service.createAdmin(dto)).rejects.toThrow(
        'Admin user already exists',
      );
      expect(adminRepo.save).not.toHaveBeenCalled();
    });

    it('refuses mismatched passwords', async () => {
      await expect(
        service.createAdmin({ ...dto, confirmPassword: 'different' }),
      ).rejects.toThrow('Passwords do not match');
    });

    it('translates a unique-constraint violation into a 400', async () => {
      adminRepo.save.mockRejectedValue({ code: 'SQLITE_CONSTRAINT' });
      await expect(service.createAdmin(dto)).rejects.toThrow(
        'Username or email already exists',
      );
    });

    it('translates any other database failure into a 500', async () => {
      adminRepo.save.mockRejectedValue(new Error('disk full'));
      await expect(service.createAdmin(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('login', () => {
    const dto = { username: 'vincent', password: 'hunter2hunter2' };

    it('matches on either username or email', async () => {
      await service.login(dto);
      expect(adminRepo.findOne).toHaveBeenCalledWith({
        where: [{ username: 'vincent' }, { email: 'vincent' }],
      });
    });

    it('issues a session on success', async () => {
      const result = await service.login(dto);
      expect(result.user.id).toBe('admin-1');
      expect(result.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('gives the same message for an unknown user as for a bad password', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');

      adminRepo.findOne.mockResolvedValue({ ...admin });
      compare.mockImplementation(async () => false);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('compares against the stored hash', async () => {
      await service.login(dto);
      expect(compare).toHaveBeenCalledWith('hunter2hunter2', 'stored-hash');
    });

    describe('with Turnstile configured', () => {
      const fetchMock = jest.fn();

      beforeEach(() => {
        settingsRepo.findOne.mockResolvedValue({
          key: 'CLOUDFLARE_TURNSTILE_SECRET_KEY',
          value: '  secret  ',
        });
        globalThis.fetch = fetchMock;
        fetchMock.mockImplementation(async () => ({
          json: async () => ({ success: true }),
        }));
      });

      it('verifies the token against Cloudflare with the trimmed secret', async () => {
        await service.login({ ...dto, captchaToken: 'captcha-token' });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        );
        expect(JSON.parse(init.body)).toEqual({
          secret: 'secret',
          response: 'captcha-token',
        });
      });

      it('refuses a login with no captcha token', async () => {
        await expect(service.login(dto)).rejects.toThrow(
          'Captcha validation required',
        );
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('refuses a login whose captcha Cloudflare rejects', async () => {
        fetchMock.mockImplementation(async () => ({
          json: async () => ({ success: false }),
        }));
        await expect(
          service.login({ ...dto, captchaToken: 'bad' }),
        ).rejects.toThrow('Captcha validation failed');
      });

      it('refuses a login when Cloudflare is unreachable', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));
        await expect(
          service.login({ ...dto, captchaToken: 'token' }),
        ).rejects.toThrow('Failed to verify captcha');
      });

      it('skips verification when the configured secret is blank', async () => {
        settingsRepo.findOne.mockResolvedValue({ value: '   ' });
        await expect(service.login(dto)).resolves.toBeDefined();
        expect(fetchMock).not.toHaveBeenCalled();
      });
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

      const saved = sessionRepo.save.mock.calls[0][0];
      expect(saved.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('leaves lastActivityAt alone on a burst of requests', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession,
        lastActivityAt: new Date(),
      });
      sessionRepo.save.mockClear();

      await service.validateSession('token-1');
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('refreshes a session that has never recorded activity', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession,
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
        ...storedSession,
        expiresAt: new Date(Date.now() - 1000),
      };
      sessionRepo.findOne.mockResolvedValue(expired);

      await expect(service.validateSession('token-1')).resolves.toBeNull();
      expect(sessionRepo.remove).toHaveBeenCalledWith(expired);
    });

    it('returns the Plex identity for a plex_user session', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession,
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

    it('rejects a plex_user session missing its identity', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...storedSession,
        userType: 'plex_user',
        plexUserId: null,
        plexUsername: null,
      });

      await expect(service.validateSession('token-1')).resolves.toBeNull();
    });

    it('rejects an admin session whose user row has gone', async () => {
      sessionRepo.findOne.mockResolvedValue({ ...storedSession, user: null });
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

    it('revokes every Plex user session', async () => {
      await expect(service.revokeAllPlexUserSessions()).resolves.toBe(3);
      expect(sessionRepo.delete).toHaveBeenCalledWith({
        userType: 'plex_user',
      });
    });

    it('clears one Plex user’s sessions', async () => {
      await service.clearPlexUserSessions('plex-9');
      expect(sessionRepo.delete).toHaveBeenCalledWith({
        userType: 'plex_user',
        plexUserId: 'plex-9',
      });
    });

    it('reports a failure clearing Plex user sessions as a 500', async () => {
      sessionRepo.delete.mockRejectedValue(new Error('db down'));
      await expect(service.clearPlexUserSessions('plex-9')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('clearAllSessions', () => {
    it('spares the current session when one is given', async () => {
      await service.clearAllSessions('admin-1', 'session-1');

      expect(deleteQueryBuilder.where).toHaveBeenCalledWith(
        'userId = :userId AND id != :currentSessionId',
        { userId: 'admin-1', currentSessionId: 'session-1' },
      );
      expect(sessionRepo.delete).not.toHaveBeenCalled();
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

  describe('updateProfile', () => {
    it('applies the new username and email', async () => {
      adminRepo.findOne
        .mockResolvedValueOnce({ ...admin })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.updateProfile('admin-1', {
        username: 'newname',
        email: 'new@example.com',
      });

      expect(result.username).toBe('newname');
      expect(result.email).toBe('new@example.com');
    });

    it('skips the uniqueness checks when nothing changed', async () => {
      await service.updateProfile('admin-1', {
        username: admin.username,
        email: admin.email,
      });

      expect(adminRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('rejects a username already in use', async () => {
      adminRepo.findOne
        .mockResolvedValueOnce({ ...admin })
        .mockResolvedValueOnce({ id: 'other' });

      await expect(
        service.updateProfile('admin-1', { username: 'taken' }),
      ).rejects.toThrow('Username already exists');
    });

    it('rejects an email already in use', async () => {
      adminRepo.findOne
        .mockResolvedValueOnce({ ...admin })
        .mockResolvedValueOnce({ id: 'other' });

      await expect(
        service.updateProfile('admin-1', { email: 'taken@example.com' }),
      ).rejects.toThrow('Email already exists');
    });

    it('lets the avatar be cleared', async () => {
      const result = await service.updateProfile('admin-1', { avatarUrl: '' });
      expect(result.avatarUrl).toBe('');
    });

    it('rejects an unknown user', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateProfile('ghost', { username: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reports a save failure as a 500', async () => {
      adminRepo.save.mockRejectedValue(new Error('db down'));
      await expect(
        service.updateProfile('admin-1', { avatarUrl: 'x' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updatePassword', () => {
    const dto = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    };

    it('stores a freshly hashed password', async () => {
      await service.updatePassword('admin-1', dto);

      expect(hash).toHaveBeenCalledWith('new-password', 12);
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'new-hash' }),
      );
    });

    it('rejects an unknown user', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePassword('ghost', dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong current password', async () => {
      compare.mockImplementation(async () => false);
      await expect(service.updatePassword('admin-1', dto)).rejects.toThrow(
        'Current password is incorrect',
      );
    });

    it('rejects a mismatched confirmation', async () => {
      await expect(
        service.updatePassword('admin-1', {
          ...dto,
          confirmPassword: 'typo',
        }),
      ).rejects.toThrow('New passwords do not match');
    });

    it('leaves other sessions alone by default', async () => {
      await service.updatePassword('admin-1', dto);
      expect(sessionRepo.delete).not.toHaveBeenCalled();
      expect(sessionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('clears the other sessions when asked, keeping the current one', async () => {
      await service.updatePassword(
        'admin-1',
        { ...dto, clearSessions: true },
        'session-1',
      );

      expect(deleteQueryBuilder.execute).toHaveBeenCalled();
    });

    it('reports a save failure as a 500', async () => {
      adminRepo.save.mockRejectedValue(new Error('db down'));
      await expect(service.updatePassword('admin-1', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('validatePassword', () => {
    it('accepts the right password', async () => {
      await expect(
        service.validatePassword('admin-1', 'hunter2'),
      ).resolves.toBe(true);
    });

    it('rejects the wrong password', async () => {
      compare.mockImplementation(async () => false);
      await expect(service.validatePassword('admin-1', 'wrong')).resolves.toBe(
        false,
      );
    });

    it('rejects an unknown user', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      await expect(service.validatePassword('ghost', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Plex-linked admin accounts', () => {
    it('finds an admin by their linked Plex id', async () => {
      await service.findAdminByPlexUserId('plex-9');
      expect(adminRepo.findOne).toHaveBeenCalledWith({
        where: { plexUserId: 'plex-9' },
      });
    });

    it('issues an admin session for a linked account', async () => {
      const result = await service.createAdminSessionByPlex('admin-1');
      expect(result.user.username).toBe('vincent');
      expect(result.session.token).toHaveLength(64);
    });

    it('refuses when the linked admin no longer exists', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      await expect(service.createAdminSessionByPlex('ghost')).rejects.toThrow(
        'Admin not found',
      );
    });
  });

  it('expires new sessions seven days out', async () => {
    const result = await service.login({
      username: 'vincent',
      password: 'hunter2hunter2',
    });

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const drift = Math.abs(
      result.session.expiresAt.getTime() - (Date.now() + sevenDays),
    );
    expect(drift).toBeLessThan(5000);
  });
});
