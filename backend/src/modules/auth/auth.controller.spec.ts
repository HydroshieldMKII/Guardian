import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AdminUser } from '@/entities/admin-user.entity';
import { AdminSessionUser } from '@/modules/auth/session-user.types';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { ConfigService } from '@/modules/config/services/config.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;
  let plexOAuthService: Record<string, jest.Mock>;
  let configService: { getSetting: jest.Mock };
  let passwordResetService: {
    getStatus: jest.Mock;
    requestReset: jest.Mock;
    verify: jest.Mock;
    confirm: jest.Mock;
  };

  const adminSession = (
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

  const adminUser = adminSession();

  const session = {
    token: 'session-token',
    expiresAt: new Date('2026-09-01T00:00:00Z'),
  };

  const responseStub = () => {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const stub: Pick<Response, 'cookie' | 'clearCookie'> = {
      cookie,
      clearCookie,
    };
    return { res: stub as Response, cookie, clearCookie };
  };

  const requestStub = (
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

  const requestWithCookies = (cookies: Record<string, string>) =>
    requestStub({ cookies });

  beforeEach(async () => {
    authService = {
      hasAdminUsers: jest.fn().mockResolvedValue(false),
      createAdmin: jest
        .fn()
        .mockResolvedValue({ user: { id: 'admin-1' }, session }),
      login: jest.fn().mockResolvedValue({ user: { id: 'admin-1' }, session }),
      logout: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      findAdminByPlexUserId: jest.fn().mockResolvedValue(null),
      createAdminSessionByPlex: jest
        .fn()
        .mockResolvedValue({ user: { id: 'admin-1' }, session }),
      createPlexUserSession: jest.fn().mockResolvedValue({
        token: 'plex-session-token',
        expiresAt: session.expiresAt,
        plexUserId: '9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      }),
    };

    plexOAuthService = {
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

    configService = { getSetting: jest.fn().mockResolvedValue(true) };

    passwordResetService = {
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
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PlexOAuthService, useValue: plexOAuthService },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('checkSetup', () => {
    it('asks for setup on a fresh install', async () => {
      await expect(controller.checkSetup()).resolves.toEqual({
        setupRequired: true,
      });
    });

    it('does not ask for setup once an admin exists', async () => {
      authService.hasAdminUsers.mockResolvedValue(true);
      await expect(controller.checkSetup()).resolves.toEqual({
        setupRequired: false,
      });
    });
  });

  describe('getTurnstileKey', () => {
    it('returns the configured site key', async () => {
      configService.getSetting.mockResolvedValue('site-key');
      await expect(controller.getTurnstileKey()).resolves.toEqual({
        siteKey: 'site-key',
      });
    });

    it('returns an empty string when unset', async () => {
      configService.getSetting.mockResolvedValue(null);
      await expect(controller.getTurnstileKey()).resolves.toEqual({
        siteKey: '',
      });
    });
  });

  describe('createAdmin', () => {
    const dto = {
      username: 'testuser',
      email: 'v@example.com',
      password: 'hunter2hunter2',
      confirmPassword: 'hunter2hunter2',
    };

    it('sets an httpOnly session cookie', async () => {
      const { res, cookie } = responseStub();
      await controller.createAdmin(dto, requestStub(), res);

      expect(cookie).toHaveBeenCalledWith(
        'session_token',
        'session-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('never returns the raw token in the body', async () => {
      const { res } = responseStub();
      const result = await controller.createAdmin(dto, requestStub(), res);

      expect(result.session).toEqual({ expiresAt: session.expiresAt });
      expect(JSON.stringify(result)).not.toContain('session-token');
    });

    it('propagates the service refusing a second admin', async () => {
      authService.createAdmin.mockRejectedValue(
        new BadRequestException('Admin user already exists'),
      );
      await expect(
        controller.createAdmin(dto, requestStub(), responseStub().res),
      ).rejects.toThrow('Admin user already exists');
    });

    it('marks the cookie secure behind an https proxy', async () => {
      const { res, cookie } = responseStub();
      await controller.createAdmin(
        dto,
        requestStub({ headers: { 'x-forwarded-proto': 'https' } }),
        res,
      );

      expect(cookie).toHaveBeenCalledWith(
        'session_token',
        'session-token',
        expect.objectContaining({ secure: true }),
      );
    });
  });

  describe('login', () => {
    it('sets the session cookie and returns the user', async () => {
      const { res, cookie } = responseStub();
      const result = await controller.login(
        { username: 'testuser', password: 'hunter2hunter2' },
        requestStub(),
        res,
      );

      expect(cookie).toHaveBeenCalledWith(
        'session_token',
        'session-token',
        expect.any(Object),
      );
      expect(result.user).toEqual({ id: 'admin-1' });
    });

    it('propagates a rejected login', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );
      await expect(
        controller.login(
          { username: 'testuser', password: 'wrong' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the session behind the cookie and clears it', async () => {
      const { res, clearCookie } = responseStub();
      const result = await controller.logout(
        requestWithCookies({ session_token: 'session-token' }),
        res,
      );

      expect(authService.logout).toHaveBeenCalledWith('session-token');
      expect(clearCookie).toHaveBeenCalledWith(
        'session_token',
        expect.any(Object),
      );
      expect(result).toEqual({ success: true });
    });

    it('still clears the cookie when no session cookie was sent', async () => {
      const { res, clearCookie } = responseStub();
      await controller.logout(requestWithCookies({}), res);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns the admin profile', () => {
      const result = controller.getCurrentUser(
        adminSession({ plexUsername: 'guest' }),
      );

      expect(result).toMatchObject({
        id: 'admin-1',
        username: 'testuser',
        plexUsername: 'guest',
      });
    });

    it('returns only the Plex identity for a portal user', () => {
      const result = controller.getCurrentUser({
        sessionId: 'session-2',
        userType: 'plex_user',
        plexUserId: '9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      });

      expect(result).toEqual({
        plexUserId: '9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      });
    });

    it('refuses an unauthenticated request', () => {
      expect(() => controller.getCurrentUser(undefined)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates the caller’s own profile', async () => {
      await controller.updateProfile(adminUser, { username: 'newname' });
      expect(authService.updateProfile).toHaveBeenCalledWith('admin-1', {
        username: 'newname',
      });
    });

    it('refuses an unauthenticated request', async () => {
      await expect(controller.updateProfile(undefined, {})).rejects.toThrow(
        'Not authenticated',
      );
    });
  });

  describe('password reset', () => {
    it('reports what the login page needs to know', async () => {
      await expect(controller.passwordResetStatus()).resolves.toEqual({
        enabled: true,
        emailConfigured: true,
        appUrlConfigured: true,
      });
    });

    it('hands the address to the service', async () => {
      await controller.requestPasswordReset({ email: 'owner@example.com' });

      expect(passwordResetService.requestReset).toHaveBeenCalledWith(
        'owner@example.com',
      );
    });

    it('reports success for an address nobody owns', async () => {
      passwordResetService.requestReset.mockResolvedValue(undefined);

      await expect(
        controller.requestPasswordReset({ email: 'stranger@example.com' }),
      ).resolves.toEqual({ success: true });
    });

    it('reports whether a link is still usable', async () => {
      await expect(
        controller.verifyPasswordReset({ token: 'abc' }),
      ).resolves.toEqual({ valid: true });

      passwordResetService.verify.mockResolvedValue(false);
      await expect(
        controller.verifyPasswordReset({ token: 'abc' }),
      ).resolves.toEqual({ valid: false });
    });

    it('passes the new password through to the service', async () => {
      const dto = {
        token: 'abc',
        password: 'BrandNewPass1!',
        confirmPassword: 'BrandNewPass1!',
      };

      await expect(controller.confirmPasswordReset(dto)).resolves.toEqual({
        success: true,
      });
      expect(passwordResetService.confirm).toHaveBeenCalledWith(dto);
    });

    it('surfaces a rejected link', async () => {
      passwordResetService.confirm.mockRejectedValue(
        new BadRequestException('This reset link is no longer valid.'),
      );

      await expect(
        controller.confirmPasswordReset({
          token: 'abc',
          password: 'BrandNewPass1!',
          confirmPassword: 'BrandNewPass1!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePassword', () => {
    const dto = {
      currentPassword: 'old',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    };

    it('passes the current session id so it survives a session purge', async () => {
      await controller.updatePassword(adminSession(), dto);

      expect(authService.updatePassword).toHaveBeenCalledWith(
        'admin-1',
        dto,
        'session-1',
      );
    });

    it('refuses an unauthenticated request', async () => {
      await expect(controller.updatePassword(undefined, dto)).rejects.toThrow(
        'Not authenticated',
      );
    });
  });

  describe('checkPlexOAuthEnabled', () => {
    it('is enabled when an admin has linked Plex', async () => {
      plexOAuthService.getAdminWithPlexLinked.mockResolvedValue(adminUser);
      await expect(controller.checkPlexOAuthEnabled()).resolves.toEqual({
        enabled: true,
      });
      expect(configService.getSetting).not.toHaveBeenCalled();
    });

    it('is enabled when the user portal is on', async () => {
      await expect(controller.checkPlexOAuthEnabled()).resolves.toEqual({
        enabled: true,
      });
    });

    it('is disabled when neither applies', async () => {
      configService.getSetting.mockResolvedValue(false);
      await expect(controller.checkPlexOAuthEnabled()).resolves.toEqual({
        enabled: false,
      });
    });

    it('treats a truthy non-boolean portal setting as disabled', async () => {
      configService.getSetting.mockResolvedValue('true');
      await expect(controller.checkPlexOAuthEnabled()).resolves.toEqual({
        enabled: false,
      });
    });
  });

  describe('createPlexPin', () => {
    it('returns the pin with an ISO expiry', async () => {
      await expect(controller.createPlexPin()).resolves.toEqual({
        id: 42,
        code: 'ABCD',
        clientId: 'client-1',
        expiresAt: '2026-08-21T12:00:00.000Z',
      });
    });

    it('maps a Plex failure to a 400 carrying the message', async () => {
      plexOAuthService.createPlexPin.mockRejectedValue(
        new Error('plex.tv unreachable'),
      );
      await expect(controller.createPlexPin()).rejects.toThrow(
        'plex.tv unreachable',
      );
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexOAuthService.createPlexPin.mockRejectedValue('boom');
      await expect(controller.createPlexPin()).rejects.toThrow(
        'Failed to create Plex PIN',
      );
    });
  });

  describe('cancelPlexPin', () => {
    it('drops the pending pin', () => {
      expect(controller.cancelPlexPin('client-1')).toEqual({ cancelled: true });
      expect(plexOAuthService.cancelPlexPin).toHaveBeenCalledWith('client-1');
    });
  });

  describe('checkPlexPin', () => {
    it('reports a pending pin', async () => {
      await expect(controller.checkPlexPin('client-1')).resolves.toEqual({
        authenticated: false,
      });
    });

    it('returns the auth token once claimed', async () => {
      plexOAuthService.checkPlexPin.mockResolvedValue({
        authToken: 'plex-token',
      });
      await expect(controller.checkPlexPin('client-1')).resolves.toEqual({
        authenticated: true,
        authToken: 'plex-token',
      });
    });

    it('maps a failure to a 400', async () => {
      plexOAuthService.checkPlexPin.mockRejectedValue(new Error('expired pin'));
      await expect(controller.checkPlexPin('client-1')).rejects.toThrow(
        'expired pin',
      );
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexOAuthService.checkPlexPin.mockRejectedValue('boom');
      await expect(controller.checkPlexPin('client-1')).rejects.toThrow(
        'Failed to check Plex PIN',
      );
    });
  });

  describe('plexLogin', () => {
    it('requires an auth token', async () => {
      await expect(
        controller.plexLogin(
          { authToken: '' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('Auth token is required');
    });

    it('issues an admin session for a linked Plex account', async () => {
      authService.findAdminByPlexUserId.mockResolvedValue({ id: 'admin-1' });
      const { res, cookie } = responseStub();

      const result = await controller.plexLogin(
        { authToken: 'tok' },
        requestStub(),
        res,
      );

      expect(authService.findAdminByPlexUserId).toHaveBeenCalledWith('9');
      expect(result.userType).toBe('admin');
      expect(cookie).toHaveBeenCalledWith(
        'session_token',
        'session-token',
        expect.any(Object),
      );
    });

    it('issues a scoped portal session for a server user', async () => {
      const { res, cookie } = responseStub();
      const result = await controller.plexLogin(
        { authToken: 'tok' },
        requestStub(),
        res,
      );

      expect(result.userType).toBe('plex_user');
      expect(result.user).toEqual({
        plexUserId: '9',
        plexUsername: 'guest',
        plexThumb: 'thumb.png',
      });
      expect(cookie).toHaveBeenCalledWith(
        'session_token',
        'plex-session-token',
        expect.any(Object),
      );
    });

    it('refuses a Plex user with no access to the server', async () => {
      plexOAuthService.isPlexUserOnServer.mockResolvedValue(false);
      await expect(
        controller.plexLogin(
          { authToken: 'tok' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow(
        'Your Plex account does not have access to this server.',
      );
    });

    it('refuses a non-admin when the portal is disabled', async () => {
      configService.getSetting.mockResolvedValue(false);
      await expect(
        controller.plexLogin(
          { authToken: 'tok' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('The user portal is currently disabled.');
    });

    it('still admits a linked admin when the portal is disabled', async () => {
      configService.getSetting.mockResolvedValue(false);
      authService.findAdminByPlexUserId.mockResolvedValue({ id: 'admin-1' });

      const result = await controller.plexLogin(
        { authToken: 'tok' },
        requestStub(),
        responseStub().res,
      );
      expect(result.userType).toBe('admin');
    });

    it('maps a Plex lookup failure to a 400', async () => {
      plexOAuthService.getPlexUserFromToken.mockRejectedValue(
        new Error('invalid token'),
      );
      await expect(
        controller.plexLogin(
          { authToken: 'tok' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('invalid token');
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexOAuthService.getPlexUserFromToken.mockRejectedValue('boom');
      await expect(
        controller.plexLogin(
          { authToken: 'tok' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('Failed to complete Plex login');
    });
  });

  describe('linkPlexAccount', () => {
    it('requires an auth token', async () => {
      await expect(
        controller.linkPlexAccount(adminUser, { authToken: '' }),
      ).rejects.toThrow('Plex auth token is required');
    });

    it('links the resolved Plex user to the caller', async () => {
      const result = await controller.linkPlexAccount(adminUser, {
        authToken: 'tok',
      });

      expect(plexOAuthService.linkPlexAccountToAdmin).toHaveBeenCalledWith(
        'admin-1',
        expect.objectContaining({ id: 9 }),
      );
      expect(result.plexUsername).toBe('guest');
    });

    it('maps a link failure to a 400', async () => {
      plexOAuthService.linkPlexAccountToAdmin.mockRejectedValue(
        new Error('already linked'),
      );
      await expect(
        controller.linkPlexAccount(adminUser, { authToken: 'tok' }),
      ).rejects.toThrow('already linked');
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexOAuthService.getPlexUserFromToken.mockRejectedValue('boom');
      await expect(
        controller.linkPlexAccount(adminUser, { authToken: 'tok' }),
      ).rejects.toThrow('Failed to link Plex account');
    });
  });

  describe('unlinkPlexAccount', () => {
    it('unlinks the caller’s account', async () => {
      await expect(controller.unlinkPlexAccount(adminUser)).resolves.toEqual({
        success: true,
      });
      expect(plexOAuthService.unlinkPlexAccountFromAdmin).toHaveBeenCalledWith(
        'admin-1',
      );
    });

    it('maps a failure to a 400', async () => {
      plexOAuthService.unlinkPlexAccountFromAdmin.mockRejectedValue(
        new Error('not linked'),
      );
      await expect(controller.unlinkPlexAccount(adminUser)).rejects.toThrow(
        'not linked',
      );
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexOAuthService.unlinkPlexAccountFromAdmin.mockRejectedValue('boom');
      await expect(controller.unlinkPlexAccount(adminUser)).rejects.toThrow(
        'Failed to unlink Plex account',
      );
    });
  });

  describe('getLinkedPlexAccount', () => {
    it('reports the link from the session user', async () => {
      await expect(
        controller.getLinkedPlexAccount(
          Object.assign(new AdminUser(), adminUser, {
            plexUserId: '9',
            plexUsername: 'guest',
          }),
        ),
      ).resolves.toMatchObject({ linked: true, plexUsername: 'guest' });
    });

    it('reports no link when the admin has none', async () => {
      await expect(controller.getLinkedPlexAccount(adminUser)).resolves.toEqual(
        { linked: false },
      );
    });
  });
});
