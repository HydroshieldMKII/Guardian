import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { AdminUser } from '../../entities/admin-user.entity';
import { UserPortalController } from './user-portal.controller';
import { UserPortalService } from './services/user-portal.service';
import { AuthGuard } from '../auth/guards/auth.guard';

describe('UserPortalController', () => {
  let controller: UserPortalController;
  let userPortalService: Record<string, jest.Mock>;

  const requestFor = (user: Request['user']) => {
    const stub: Pick<Request, 'user'> = { user };
    return stub as Request;
  };

  const portalUser = requestFor({
    sessionId: 'session-1',
    userType: 'plex_user',
    plexUserId: 'plex-9',
    plexUsername: 'guest',
  });

  const adminWithPlex = requestFor(
    Object.assign(new AdminUser(), {
      id: 'admin-1',
      username: 'vincent',
      sessionId: 'session-1',
      userType: 'admin' as const,
      plexUserId: 'plex-9',
    }),
  );

  const adminWithoutPlex = requestFor(
    Object.assign(new AdminUser(), {
      id: 'admin-1',
      username: 'vincent',
      sessionId: 'session-1',
      userType: 'admin' as const,
    }),
  );

  beforeEach(async () => {
    userPortalService = {
      getUserDevices: jest.fn().mockResolvedValue([{ id: 1 }]),
      getUserRules: jest.fn().mockResolvedValue({ networkPolicy: 'both' }),
      requestDeviceApproval: jest.fn().mockResolvedValue(undefined),
      getPortalSettings: jest
        .fn()
        .mockResolvedValue({ showRules: true, allowRejectedRequests: true }),
    };

    const module = await Test.createTestingModule({
      controllers: [UserPortalController],
      providers: [{ provide: UserPortalService, useValue: userPortalService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UserPortalController);
  });

  describe('getMyDevices', () => {
    it('scopes the listing to the portal user', async () => {
      await expect(controller.getMyDevices(portalUser)).resolves.toEqual([
        { id: 1 },
      ]);
      expect(userPortalService.getUserDevices).toHaveBeenCalledWith('plex-9');
    });

    it('scopes the listing to an admin’s linked Plex account', async () => {
      await controller.getMyDevices(adminWithPlex);
      expect(userPortalService.getUserDevices).toHaveBeenCalledWith('plex-9');
    });

    it('refuses an admin who has not linked Plex', async () => {
      await expect(controller.getMyDevices(adminWithoutPlex)).rejects.toThrow(
        'Admin account not linked to Plex',
      );
    });

    it('refuses an unauthenticated request', async () => {
      await expect(
        controller.getMyDevices(requestFor(undefined)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyRules', () => {
    it('marks the rules as enabled when the portal exposes them', async () => {
      await expect(controller.getMyRules(portalUser)).resolves.toEqual({
        enabled: true,
        rules: { networkPolicy: 'both' },
      });
    });

    it('marks the rules as disabled when the portal hides them', async () => {
      userPortalService.getUserRules.mockResolvedValue(null);

      await expect(controller.getMyRules(portalUser)).resolves.toEqual({
        enabled: false,
        rules: null,
      });
    });
  });

  describe('requestDeviceApproval', () => {
    it('forwards the note for the caller’s own device', async () => {
      await expect(
        controller.requestDeviceApproval(portalUser, 4, {
          description: 'my tablet',
        }),
      ).resolves.toEqual({
        success: true,
        message: 'Approval request submitted',
      });

      expect(userPortalService.requestDeviceApproval).toHaveBeenCalledWith(
        'plex-9',
        4,
        'my tablet',
      );
    });

    it('accepts a request with no note', async () => {
      await controller.requestDeviceApproval(portalUser, 4, {});
      expect(userPortalService.requestDeviceApproval).toHaveBeenCalledWith(
        'plex-9',
        4,
        undefined,
      );
    });

    it('propagates a refusal from the service', async () => {
      userPortalService.requestDeviceApproval.mockRejectedValue(
        new ForbiddenException('Device is already approved'),
      );

      await expect(
        controller.requestDeviceApproval(portalUser, 4, {}),
      ).rejects.toThrow('Device is already approved');
    });
  });

  describe('getPortalSettings', () => {
    it('returns the portal settings', async () => {
      await expect(controller.getPortalSettings()).resolves.toEqual({
        showRules: true,
        allowRejectedRequests: true,
      });
    });
  });
});
