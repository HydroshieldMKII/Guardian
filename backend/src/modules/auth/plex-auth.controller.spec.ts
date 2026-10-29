import { AdminUser } from '@/entities/admin-user.entity';
import { PlexAuthController } from '@/modules/auth/plex-auth.controller';
import {
  AuthControllersTestbed,
  createAuthControllersTestbed,
  adminSession,
  requestStub,
  responseStub,
} from '@/modules/auth/auth-controllers-testbed.fixture';

describe('PlexAuthController', () => {
  let controller: PlexAuthController;
  let authService: AuthControllersTestbed['authService'];
  let plexOAuthService: AuthControllersTestbed['plexOAuthService'];
  let plexAccounts: AuthControllersTestbed['plexAccounts'];
  let configService: AuthControllersTestbed['configService'];
  const adminUser = adminSession();

  beforeEach(async () => {
    const testbed = await createAuthControllersTestbed();
    ({ authService, plexOAuthService, plexAccounts, configService } = testbed);
    controller = testbed.module.get(PlexAuthController);
  });

  describe('checkPlexOAuthEnabled', () => {
    it('is enabled when an admin has linked Plex', async () => {
      plexAccounts.getAdminWithPlexLinked.mockResolvedValue(adminUser);
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

    it('reports a signed-in pin without revealing the Plex token', async () => {
      plexOAuthService.checkPlexPin.mockResolvedValue(true);
      await expect(controller.checkPlexPin('client-1')).resolves.toEqual({
        authenticated: true,
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
    it('issues an admin session for a linked Plex account', async () => {
      authService.findAdminByPlexUserId.mockResolvedValue({ id: 'admin-1' });
      const { res, cookie } = responseStub();

      const result = await controller.plexLogin(
        { clientId: 'client-1' },
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
        { clientId: 'client-1' },
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
      plexAccounts.isPlexUserOnServer.mockResolvedValue(false);
      await expect(
        controller.plexLogin(
          { clientId: 'client-1' },
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
          { clientId: 'client-1' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('The user portal is currently disabled.');
    });

    it('still admits a linked admin when the portal is disabled', async () => {
      configService.getSetting.mockResolvedValue(false);
      authService.findAdminByPlexUserId.mockResolvedValue({ id: 'admin-1' });

      const result = await controller.plexLogin(
        { clientId: 'client-1' },
        requestStub(),
        responseStub().res,
      );
      expect(result.userType).toBe('admin');
    });

    it('signs in the Plex user of the given pin', async () => {
      await controller.plexLogin(
        { clientId: 'client-1' },
        requestStub(),
        responseStub().res,
      );

      expect(plexOAuthService.claimPlexUser).toHaveBeenCalledWith('client-1');
    });

    it('maps a pin that is not signed in to a 400', async () => {
      plexOAuthService.claimPlexUser.mockImplementation(() => {
        throw new Error('Sign in with Plex first');
      });
      await expect(
        controller.plexLogin(
          { clientId: 'client-1' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('Sign in with Plex first');
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      authService.findAdminByPlexUserId.mockRejectedValue('boom');
      await expect(
        controller.plexLogin(
          { clientId: 'client-1' },
          requestStub(),
          responseStub().res,
        ),
      ).rejects.toThrow('Failed to complete Plex login');
    });
  });

  describe('linkPlexAccount', () => {
    it('links the resolved Plex user to the caller', async () => {
      const result = await controller.linkPlexAccount(adminUser, {
        clientId: 'client-1',
      });

      expect(plexAccounts.linkPlexAccountToAdmin).toHaveBeenCalledWith(
        'admin-1',
        expect.objectContaining({ id: 9 }),
      );
      expect(result.plexUsername).toBe('guest');
    });

    it('maps a link failure to a 400', async () => {
      plexAccounts.linkPlexAccountToAdmin.mockRejectedValue(
        new Error('already linked'),
      );
      await expect(
        controller.linkPlexAccount(adminUser, { clientId: 'client-1' }),
      ).rejects.toThrow('already linked');
    });

    it('links the Plex user of the given pin', async () => {
      await controller.linkPlexAccount(adminUser, { clientId: 'client-1' });

      expect(plexOAuthService.claimPlexUser).toHaveBeenCalledWith('client-1');
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexAccounts.linkPlexAccountToAdmin.mockRejectedValue('boom');
      await expect(
        controller.linkPlexAccount(adminUser, { clientId: 'client-1' }),
      ).rejects.toThrow('Failed to link Plex account');
    });
  });

  describe('unlinkPlexAccount', () => {
    it('unlinks the caller’s account', async () => {
      await expect(controller.unlinkPlexAccount(adminUser)).resolves.toEqual({
        success: true,
      });
      expect(plexAccounts.unlinkPlexAccountFromAdmin).toHaveBeenCalledWith(
        'admin-1',
      );
    });

    it('maps a failure to a 400', async () => {
      plexAccounts.unlinkPlexAccountFromAdmin.mockRejectedValue(
        new Error('not linked'),
      );
      await expect(controller.unlinkPlexAccount(adminUser)).rejects.toThrow(
        'not linked',
      );
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      plexAccounts.unlinkPlexAccountFromAdmin.mockRejectedValue('boom');
      await expect(controller.unlinkPlexAccount(adminUser)).rejects.toThrow(
        'Failed to unlink Plex account',
      );
    });
  });

  describe('getLinkedPlexAccount', () => {
    it('reports the link from the session user', () => {
      expect(
        controller.getLinkedPlexAccount(
          Object.assign(new AdminUser(), adminUser, {
            plexUserId: '9',
            plexUsername: 'guest',
          }),
        ),
      ).toMatchObject({ linked: true, plexUsername: 'guest' });
    });

    it('reports no link when the admin has none', () => {
      expect(controller.getLinkedPlexAccount(adminUser)).toEqual({
        linked: false,
      });
    });
  });
});
