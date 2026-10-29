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
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { ConfigService } from '@/modules/config/services/config.service';

export interface AuthControllersTestbed {
  module: TestingModule;
  authService: Record<string, jest.Mock>;
  authSessions: { logout: jest.Mock; createPlexUserSession: jest.Mock };
  plexOAuthService: Record<string, jest.Mock>;
  configService: { getSetting: jest.Mock };
  passwordResetService: Record<
    'getStatus' | 'requestReset' | 'verify' | 'confirm',
    jest.Mock
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
  const cookie = jest.fn();
  const clearCookie = jest.fn();
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
      hasAdminUsers: jest.fn().mockResolvedValue(false),
      createAdmin: jest
        .fn()
        .mockResolvedValue({ user: { id: 'admin-1' }, session }),
      login: jest.fn().mockResolvedValue({ user: { id: 'admin-1' }, session }),
      updateProfile: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      findAdminByPlexUserId: jest.fn().mockResolvedValue(null),
      createAdminSessionByPlex: jest
        .fn()
        .mockResolvedValue({ user: { id: 'admin-1' }, session }),
    };

    const authSessions = {
      logout: jest.fn().mockResolvedValue(undefined),
      createPlexUserSession: jest.fn().mockResolvedValue({
        token: 'plex-session-token',
        expiresAt: session.expiresAt,
        plexUserId: '9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      }),
    };

    const plexOAuthService = {
      getAdminWithPlexLinked: jest.fn().mockResolvedValue(null),
      generateClientId: jest.fn().mockReturnValue('client-1'),
      createPlexPin: jest.fn().mockResolvedValue({
        pin: {
          id: 42,
          code: 'ABCD',
          clientIdentifier: 'client-1',
          expiresAt: new Date('2026-08-21T12:00:00Z'),
        },
      }),
      checkPlexPin: jest.fn().mockResolvedValue(null),
      cancelPlexPin: jest.fn(),
      getPlexUserFromToken: jest.fn().mockResolvedValue({
        id: 9,
        username: 'guest',
        thumb: 'thumb.png',
      }),
      isPlexUserOnServer: jest.fn().mockResolvedValue(true),
      linkPlexAccountToAdmin: jest.fn().mockResolvedValue({
        plexUserId: '9',
        plexUsername: 'guest',
        plexEmail: 'guest@example.com',
        plexThumb: 'thumb.png',
      }),
      unlinkPlexAccountFromAdmin: jest.fn().mockResolvedValue(undefined),
    };

    const configService = { getSetting: jest.fn().mockResolvedValue(true) };

    const passwordResetService = {
      getStatus: jest.fn().mockResolvedValue({
        enabled: true,
        emailConfigured: true,
        appUrlConfigured: true,
      }),
      requestReset: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
      confirm: jest.fn().mockResolvedValue(undefined),
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
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return {
      module,
      authService,
      authSessions,
      plexOAuthService,
      configService,
      passwordResetService,
    };
  };
