import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminUser } from '@/entities/admin-user.entity';
import { PasswordResetToken } from '@/entities/password-reset-token.entity';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { EmailService } from '@/modules/config/services/email.service';
import {
  PASSWORD_RESET_TTL_MS,
  PasswordResetService,
} from '@/modules/auth/password-reset.service';
import type { Mock } from 'vitest';

const ADMIN = {
  id: 'admin-1',
  username: 'owner',
  email: 'Owner@Example.com',
  passwordHash: 'old-hash',
};

const hashOf = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let adminRepo: {
    find: Mock;
    findOne: Mock;
    save: Mock<
      (...args: [{ passwordHash: string }]) => { passwordHash: string }
    >;
  };
  let tokenRepo: {
    findOne: Mock;
    delete: Mock<(...args: [Record<string, unknown>]) => Promise<void>>;
    save: Mock;
    manager: { transaction: Mock };
  };
  let transactionRepo: {
    delete: Mock;
    save: Mock<
      (...args: [{ tokenHash: string; userId: string }]) => Promise<void>
    >;
  };
  let configService: { getSetting: Mock };
  let emailService: {
    loadSmtpSettings: Mock;
    sendPasswordResetEmail: Mock<
      (...args: [string, string, string, number]) => Promise<void>
    >;
  };
  let authSessions: { clearAllSessions: Mock };

  beforeEach(async () => {
    process.env.APP_URL = 'https://guardian.example.com';

    adminRepo = {
      find: vi.fn().mockResolvedValue([ADMIN]),
      findOne: vi.fn().mockResolvedValue({ ...ADMIN }),
      save: vi
        .fn<(...args: [{ passwordHash: string }]) => { passwordHash: string }>()
        .mockImplementation((entity) => entity),
    };

    transactionRepo = {
      delete: vi.fn().mockResolvedValue(undefined),
      save: vi
        .fn<
          (...args: [{ tokenHash: string; userId: string }]) => Promise<void>
        >()
        .mockResolvedValue(undefined),
    };

    tokenRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      delete: vi
        .fn<(...args: [Record<string, unknown>]) => Promise<void>>()
        .mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      manager: {
        transaction: vi
          .fn()
          .mockImplementation(
            (
              run: (manager: {
                getRepository: () => typeof transactionRepo;
              }) => unknown,
            ) => run({ getRepository: () => transactionRepo }),
          ),
      },
    };

    configService = { getSetting: vi.fn().mockResolvedValue(true) };

    emailService = {
      loadSmtpSettings: vi.fn().mockResolvedValue({
        SMTP_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM_EMAIL: 'guardian@example.com',
      }),
      sendPasswordResetEmail: vi
        .fn<(...args: [string, string, string, number]) => Promise<void>>()
        .mockResolvedValue(undefined),
    };

    authSessions = { clearAllSessions: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: tokenRepo,
        },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: AuthSessionService, useValue: authSessions },
      ],
    }).compile();

    service = module.get(PasswordResetService);
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  describe('getStatus', () => {
    it('is ready when the toggle, SMTP and the app url all line up', async () => {
      await expect(service.getStatus()).resolves.toEqual({
        enabled: true,
        emailConfigured: true,
        appUrlConfigured: true,
        adminEmailConfigured: true,
      });
    });

    it('is not ready while the toggle is off', async () => {
      configService.getSetting.mockResolvedValue(false);

      await expect(service.getStatus()).resolves.toMatchObject({
        enabled: false,
        emailConfigured: true,
      });
    });

    it('is not ready while SMTP is disabled', async () => {
      emailService.loadSmtpSettings.mockResolvedValue({
        SMTP_ENABLED: false,
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM_EMAIL: 'guardian@example.com',
      });

      await expect(service.getStatus()).resolves.toMatchObject({
        enabled: false,
        emailConfigured: false,
      });
    });

    it('is not ready without a from address', async () => {
      emailService.loadSmtpSettings.mockResolvedValue({
        SMTP_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM_EMAIL: '',
      });

      await expect(service.getStatus()).resolves.toMatchObject({
        emailConfigured: false,
      });
    });

    it('is not ready without APP_URL', async () => {
      delete process.env.APP_URL;

      await expect(service.getStatus()).resolves.toEqual({
        enabled: false,
        emailConfigured: true,
        appUrlConfigured: false,
        adminEmailConfigured: true,
      });
    });

    it.each([
      [[]],
      [[{ ...ADMIN, email: '   ' }]],
      [[{ ...ADMIN, email: null }]],
    ])(
      'is not ready while no admin account carries an email address (%j)',
      async (admins) => {
        adminRepo.find.mockResolvedValue(admins);

        await expect(service.getStatus()).resolves.toEqual({
          enabled: false,
          emailConfigured: true,
          appUrlConfigured: true,
          adminEmailConfigured: false,
        });
      },
    );

    it('loads the admins without their password hashes', async () => {
      await service.getStatus();

      expect(adminRepo.find).toHaveBeenCalledWith({
        select: { id: true, username: true, email: true },
      });
    });
  });

  describe('requestReset', () => {
    it('emails a link that carries the generated token', async () => {
      await service.requestReset('owner@example.com');

      const [to, username, url, minutes] =
        emailService.sendPasswordResetEmail.mock.calls[0];

      expect(to).toBe(ADMIN.email);
      expect(username).toBe('owner');
      expect(minutes).toBe(PASSWORD_RESET_TTL_MS / 60000);
      expect(url).toMatch(
        /^https:\/\/guardian\.example\.com\/reset-password\?token=[\w-]+$/,
      );
    });

    it('stores only a hash of the token', async () => {
      await service.requestReset('owner@example.com');

      const url = emailService.sendPasswordResetEmail.mock.calls[0][2];
      const token = decodeURIComponent(url.split('token=')[1]);
      const saved = transactionRepo.save.mock.calls[0][0];

      expect(saved.tokenHash).toBe(hashOf(token));
      expect(saved.tokenHash).not.toBe(token);
      expect(saved.userId).toBe(ADMIN.id);
    });

    it('drops any token still outstanding for that admin', async () => {
      await service.requestReset('owner@example.com');

      expect(transactionRepo.delete).toHaveBeenCalledWith({
        userId: ADMIN.id,
      });
    });

    it('matches the address without regard to case', async () => {
      await service.requestReset('  OWNER@example.com ');

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        ADMIN.email,
        ADMIN.username,
        expect.any(String),
        expect.any(Number),
      );
    });

    it.each(['%', '_wner@example.com', 'owner@example'])(
      'treats %p as a literal address, not a pattern',
      async (address) => {
        await service.requestReset(address);

        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      },
    );

    it('picks the admin whose address matches among several', async () => {
      adminRepo.find.mockResolvedValue([
        { id: 'admin-2', username: 'other', email: 'other@example.com' },
        ADMIN,
      ]);

      await service.requestReset('owner@example.com');

      expect(transactionRepo.save.mock.calls[0][0].userId).toBe(ADMIN.id);
    });

    it('sends nothing for an address that belongs to nobody', async () => {
      await service.requestReset('stranger@example.com');

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(transactionRepo.save).not.toHaveBeenCalled();
    });

    it('sends nothing while the feature is unavailable', async () => {
      configService.getSetting.mockResolvedValue(false);

      await service.requestReset('owner@example.com');

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(adminRepo.find).toHaveBeenCalledTimes(1);
    });

    it('sends nothing while no admin account carries an email address', async () => {
      adminRepo.find.mockResolvedValue([{ ...ADMIN, email: '' }]);

      await service.requestReset('');

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(transactionRepo.save).not.toHaveBeenCalled();
    });

    it('clears tokens that have already expired', async () => {
      await service.requestReset('owner@example.com');

      expect(Object.keys(tokenRepo.delete.mock.calls[0][0])).toEqual([
        'expiresAt',
      ]);
    });
  });

  describe('verify', () => {
    it('accepts a token that is still in date', async () => {
      tokenRepo.findOne.mockResolvedValue({
        id: 't-1',
        userId: ADMIN.id,
        tokenHash: hashOf('good'),
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.verify('good')).resolves.toBe(true);
      expect(tokenRepo.findOne).toHaveBeenCalledWith({
        where: { tokenHash: hashOf('good') },
      });
    });

    it('rejects a token nobody issued', async () => {
      await expect(service.verify('made-up')).resolves.toBe(false);
    });

    it('rejects a token that has run out', async () => {
      tokenRepo.findOne.mockResolvedValue({
        id: 't-1',
        userId: ADMIN.id,
        tokenHash: hashOf('stale'),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verify('stale')).resolves.toBe(false);
    });
  });

  describe('confirm', () => {
    const validToken = () =>
      tokenRepo.findOne.mockResolvedValue({
        id: 't-1',
        userId: ADMIN.id,
        tokenHash: hashOf('good'),
        expiresAt: new Date(Date.now() + 60000),
      });

    it('stores a hash of the new password', async () => {
      validToken();

      await service.confirm({
        token: 'good',
        password: 'BrandNewPass1!',
        confirmPassword: 'BrandNewPass1!',
      });

      const saved = adminRepo.save.mock.calls[0][0];
      expect(saved.passwordHash).not.toBe('BrandNewPass1!');
      await expect(
        bcrypt.compare('BrandNewPass1!', saved.passwordHash),
      ).resolves.toBe(true);
    });

    it('burns the token and signs every session out', async () => {
      validToken();

      await service.confirm({
        token: 'good',
        password: 'BrandNewPass1!',
        confirmPassword: 'BrandNewPass1!',
      });

      expect(tokenRepo.delete).toHaveBeenCalledWith({ id: 't-1' });
      expect(authSessions.clearAllSessions).toHaveBeenCalledWith(ADMIN.id);
    });

    it('refuses a mismatched confirmation', async () => {
      await expect(
        service.confirm({
          token: 'good',
          password: 'BrandNewPass1!',
          confirmPassword: 'SomethingElse1!',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(adminRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a token that is no longer valid', async () => {
      await expect(
        service.confirm({
          token: 'gone',
          password: 'BrandNewPass1!',
          confirmPassword: 'BrandNewPass1!',
        }),
      ).rejects.toThrow(
        'This reset link is no longer valid. Request a new one.',
      );
    });

    it('refuses and cleans up when the admin has since been removed', async () => {
      validToken();
      adminRepo.findOne.mockResolvedValue(null);

      await expect(
        service.confirm({
          token: 'good',
          password: 'BrandNewPass1!',
          confirmPassword: 'BrandNewPass1!',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tokenRepo.delete).toHaveBeenCalledWith({ id: 't-1' });
      expect(authSessions.clearAllSessions).not.toHaveBeenCalled();
    });
  });
});
