import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Not } from 'typeorm';
import { AdminUser } from '@/entities/admin-user.entity';
import { Session } from '@/entities/session.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { adminAccount, sessionRepository } from '@/modules/auth/auth.fixture';
import type { Mock } from 'vitest';

const mockHash = vi.fn<(...args: [string, number]) => Promise<string>>();
const mockCompare = vi.fn<(...args: [string, string]) => Promise<boolean>>();

vi.mock('bcrypt', () => ({
  hash: (data: string, rounds: number) => mockHash(data, rounds),
  compare: (data: string, encrypted: string) => mockCompare(data, encrypted),
}));

const hash = mockHash;
const compare = mockCompare;

describe('AuthService', () => {
  let service: AuthService;
  let adminRepo: {
    count: Mock;
    save: Mock;
    findOne: Mock;
    manager: { transaction: Mock };
  };
  let sessionRepo: ReturnType<typeof sessionRepository>;
  let configService: { getSetting: Mock };

  const admin = adminAccount();

  beforeEach(async () => {
    vi.clearAllMocks();
    hash.mockResolvedValue('new-hash');
    compare.mockResolvedValue(true);

    adminRepo = {
      count: vi.fn().mockResolvedValue(0),
      save: vi.fn().mockImplementation((entity: Record<string, unknown>) =>
        Promise.resolve({
          id: 'admin-1',
          ...entity,
        }),
      ),
      findOne: vi.fn().mockResolvedValue({ ...admin }),
      manager: {
        transaction: vi.fn(
          async (run: (manager: { getRepository: () => unknown }) => unknown) =>
            run({ getRepository: () => adminRepo }),
        ),
      },
    };

    sessionRepo = sessionRepository();
    configService = { getSetting: vi.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthSessionService,
        CaptchaService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: ConfigService, useValue: configService },
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
      username: 'testuser',
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
      expect(result.user.username).toBe('testuser');
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

    it.each([undefined, null])(
      'stores an empty email when it is %p',
      async (email) => {
        await service.createAdmin({ ...dto, email });
        expect(adminRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ email: '' }),
        );
      },
    );
  });

  describe('login', () => {
    const dto = { username: 'testuser', password: 'hunter2hunter2' };

    it('matches on either username or email', async () => {
      await service.login(dto);
      expect(adminRepo.findOne).toHaveBeenCalledWith({
        where: [{ username: 'testuser' }, { email: 'testuser' }],
      });
    });

    it('matches the email whatever its case', async () => {
      await service.login({ ...dto, username: ' Admin@Example.COM ' });
      expect(adminRepo.findOne).toHaveBeenCalledWith({
        where: [
          { username: ' Admin@Example.COM ' },
          { email: 'admin@example.com' },
        ],
      });
    });

    it('never matches an admin without an email on a blank name', async () => {
      await service.login({ ...dto, username: '   ' }).catch(() => undefined);
      expect(adminRepo.findOne).toHaveBeenCalledWith({
        where: [{ username: '   ' }],
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
      compare.mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('still runs a password comparison for an unknown user', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
      expect(compare).toHaveBeenCalledWith(
        'hunter2hunter2',
        expect.stringMatching(/^\$2b\$12\$/),
      );
    });

    it('compares against the stored hash', async () => {
      await service.login(dto);
      expect(compare).toHaveBeenCalledWith('hunter2hunter2', 'stored-hash');
    });

    it('checks the captcha before looking up the admin', async () => {
      configService.getSetting.mockResolvedValue('secret');

      await expect(service.login(dto)).rejects.toThrow(
        'Captcha validation required',
      );
      expect(adminRepo.findOne).not.toHaveBeenCalled();
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

    it('stores an empty email when it is cleared with null', async () => {
      const result = await service.updateProfile('admin-1', { email: null });
      expect(result.email).toBe('');
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
      compare.mockResolvedValue(false);
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

    it('rejects a new password equal to the current one', async () => {
      await expect(
        service.updatePassword('admin-1', {
          ...dto,
          currentPassword: dto.newPassword,
        }),
      ).rejects.toThrow(
        'New password must be different from the current password',
      );
      expect(adminRepo.save).not.toHaveBeenCalled();
    });

    it('leaves other sessions alone by default', async () => {
      await service.updatePassword('admin-1', dto);
      expect(sessionRepo.delete).not.toHaveBeenCalled();
    });

    it('clears the other sessions when asked, keeping the current one', async () => {
      await service.updatePassword(
        'admin-1',
        { ...dto, clearSessions: true },
        'session-1',
      );

      expect(sessionRepo.delete).toHaveBeenCalledWith({
        userId: 'admin-1',
        id: Not('session-1'),
      });
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
      compare.mockResolvedValue(false);
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
      expect(result.user.username).toBe('testuser');
      expect(result.session.token).toHaveLength(64);
    });

    it('refuses when the linked admin no longer exists', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      await expect(service.createAdminSessionByPlex('ghost')).rejects.toThrow(
        'Admin not found',
      );
    });
  });
});
