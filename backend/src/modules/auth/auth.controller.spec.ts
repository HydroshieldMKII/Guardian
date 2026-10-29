import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '@/modules/auth/auth.controller';
import {
  AuthControllersTestbed,
  createAuthControllersTestbed,
  adminSession,
  requestStub,
  responseStub,
  session,
} from '@/modules/auth/auth-controllers-testbed.fixture';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthControllersTestbed['authService'];
  let authSessions: AuthControllersTestbed['authSessions'];
  let configService: AuthControllersTestbed['configService'];
  const adminUser = adminSession();

  beforeEach(async () => {
    const testbed = await createAuthControllersTestbed();
    ({ authService, authSessions, configService } = testbed);
    controller = testbed.module.get(AuthController);
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
        requestStub({ cookies: { session_token: 'session-token' } }),
        res,
      );

      expect(authSessions.logout).toHaveBeenCalledWith('session-token');
      expect(clearCookie).toHaveBeenCalledWith(
        'session_token',
        expect.any(Object),
      );
      expect(result).toEqual({ success: true });
    });

    it('still clears the cookie when no session cookie was sent', async () => {
      const { res, clearCookie } = responseStub();
      await controller.logout(requestStub({ cookies: {} }), res);

      expect(authSessions.logout).not.toHaveBeenCalled();
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
});
