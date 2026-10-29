import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AdminUser } from '@/entities/admin-user.entity';
import { AdminSessionUser } from '@/modules/auth/session-user.types';
import { AuthController } from '@/modules/auth/auth.controller';
import { PasswordResetController } from '@/modules/auth/password-reset.controller';
import { PlexAuthController } from '@/modules/auth/plex-auth.controller';
import { PlexLoginService } from '@/modules/auth/plex-login.service';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { PlexAccountService } from '@/modules/auth/plex-account.service';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { ConfigService } from '@/modules/config/services/config.service';
import type { Mock } from 'vitest';

export interface AuthControllersTestbed {
  module: TestingModule;
  authService: Record<string, Mock>;
  authSessions: { logout: Mock; createPlexUserSession: Mock };
  plexOAuthService: Record<string, Mock>;
  plexAccounts: Record<string, Mock>;
  configService: { getSetting: Mock };
  passwordResetService: Record<
    'getStatus' | 'requestReset' | 'verify' | 'confirm',
    Mock
  >;
}

export const adminSession = (
  overrides: Partial<AdminSessionUser> = {},
): AdminSessionUser =>
  Object.assign(new AdminUser(), {
    id: 'admin-1',
    username: 'testuser',
    email: 'v@example.com',
    passwordHash: 'hash',
    sessionId: 'session-1',
    userType: 'admin' as const,
    ...overrides,
  });

export const session = {
  token: 'session-token',
  expiresAt: new Date('2026-09-01T00:00:00Z'),
};

export const responseStub = () => {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const stub: Pick<Response, 'cookie' | 'clearCookie'> = {
    cookie,
    clearCookie,
  };
  return { res: stub as Response, cookie, clearCookie };
};

export const requestStub = (
  overrides: Partial<Pick<Request, 'cookies' | 'secure' | 'headers'>> = {},
) => {
  const stub: Pick<Request, 'cookies' | 'secure' | 'headers'> = {
    cookies: {},
    secure: false,
    headers: {},
    ...overrides,
  };
  return stub as Request;
};

export const createAuthControllersTestbed =
  async (): Promise<AuthControllersTestbed> => {
    const authService = {
      hasAdminUsers: vi.fn().mockResolvedValue(false),
      createAdmin: vi
        .fn()
        .mockResolvedValue({ user: { id: 'admin-1' }, session }),
      login: vi.fn().mockResolvedValue({ user: { id: 'admin-1' }, session }),
      updateProfile: vi.fn().mockResolvedValue({ id: 'admin-1' }),
      updatePassword: vi.fn().mockResolvedValue(undefined),
      findAdminByPlexUserId: vi.fn().mockResolvedValue(null),
      createAdminSessionByPlex: vi
        .fn()
        .mockResolvedValue({ user: { id: 'admin-1' }, session }),
    };

    const authSessions = {
      logout: vi.fn().mockResolvedValue(undefined),
      createPlexUserSession: vi.fn().mockResolvedValue({
        token: 'plex-session-token',
        expiresAt: session.expiresAt,
        plexUserId: '9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      }),
    };

    const plexOAuthService = {
      generateClientId: vi.fn().mockReturnValue('client-1'),
      createPlexPin: vi.fn().mockResolvedValue({
        pin: {
          id: 42,
          code: 'ABCD',
          clientIdentifier: 'client-1',
          expiresAt: new Date('2026-08-21T12:00:00Z'),
        },
      }),
      checkPlexPin: vi.fn().mockResolvedValue(false),
      cancelPlexPin: vi.fn(),
      claimPlexUser: vi.fn().mockReturnValue({
        id: 9,
        username: 'guest',
        thumb: 'thumb.png',
      }),
    };

    const plexAccounts = {
      getAdminWithPlexLinked: vi.fn().mockResolvedValue(null),
      isPlexUserOnServer: vi.fn().mockResolvedValue(true),
      linkPlexAccountToAdmin: vi.fn().mockResolvedValue({
        plexUserId: '9',
        plexUsername: 'guest',
        plexEmail: 'guest@example.com',
        plexThumb: 'thumb.png',
      }),
      unlinkPlexAccountFromAdmin: vi.fn().mockResolvedValue(undefined),
    };

    const configService = { getSetting: vi.fn().mockResolvedValue(true) };

    const passwordResetService = {
      getStatus: vi.fn().mockResolvedValue({
        enabled: true,
        emailConfigured: true,
        appUrlConfigured: true,
      }),
      requestReset: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockResolvedValue(true),
      confirm: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        PasswordResetController,
        PlexAuthController,
      ],
      providers: [
        PlexLoginService,
        { provide: AuthService, useValue: authService },
        { provide: AuthSessionService, useValue: authSessions },
        { provide: PlexOAuthService, useValue: plexOAuthService },
        { provide: PlexAccountService, useValue: plexAccounts },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return {
      module,
      authService,
      authSessions,
      plexOAuthService,
      plexAccounts,
      configService,
      passwordResetService,
    };
  };
