import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { AppSettings } from '../../../entities/app-settings.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UserPortalService } from './user-portal.service';

describe('UserPortalService', () => {
  let service: UserPortalService;
  let deviceRepo: Record<string, jest.Mock>;
  let timeRuleRepo: Record<string, jest.Mock>;
  let preferenceRepo: { findOne: jest.Mock };
  let settingsRepo: { findOne: jest.Mock };
  let notificationsService: { createDeviceNoteNotification: jest.Mock };
  let queryBuilder: Record<string, jest.Mock>;

  const settings = new Map<string, string>();

  const device = (overrides: Partial<UserDevice> = {}) =>
    Object.assign(new UserDevice(), {
      id: 1,
      userId: 'plex-9',
      deviceIdentifier: 'dev-1',
      deviceName: 'Living Room TV',
      devicePlatform: 'Android',
      deviceProduct: 'Plex for Android',
      status: 'pending',
      firstSeen: new Date('2026-01-01T00:00:00Z'),
      lastSeen: new Date('2026-08-01T00:00:00Z'),
      excludeFromConcurrentLimit: false,
      temporaryAccessUntil: null,
      requestDescription: null,
      requestSubmittedAt: null,
      requestNoteReadAt: null,
      ...overrides,
    });

  const timeRule = (overrides: Partial<UserTimeRule> = {}) =>
    Object.assign(new UserTimeRule(), {
      id: 1,
      userId: 'plex-9',
      deviceIdentifier: null,
      dayOfWeek: 1,
      startTime: '20:00',
      endTime: '22:00',
      ruleName: 'Bedtime',
      enabled: true,
      ...overrides,
    });

  beforeEach(async () => {
    settings.clear();

    queryBuilder = {
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    for (const key of ['where', 'andWhere', 'orderBy', 'addOrderBy']) {
      queryBuilder[key].mockReturnValue(queryBuilder);
    }

    deviceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(device()),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    timeRuleRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    preferenceRepo = { findOne: jest.fn().mockResolvedValue(null) };

    settingsRepo = {
      findOne: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          settings.has(where.key)
            ? { key: where.key, value: settings.get(where.key) }
            : null,
        ),
      ),
    };

    notificationsService = {
      createDeviceNoteNotification: jest.fn().mockResolvedValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        UserPortalService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: getRepositoryToken(UserTimeRule), useValue: timeRuleRepo },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepo,
        },
        { provide: getRepositoryToken(AppSettings), useValue: settingsRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(UserPortalService);
  });

  describe('getUserDevices', () => {
    it('only asks for that user’s devices, newest-seen first', async () => {
      await service.getUserDevices('plex-9');
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: { userId: 'plex-9' },
        order: { lastSeen: 'DESC' },
      });
    });

    it('presents the device without leaking internals', async () => {
      deviceRepo.find.mockResolvedValue([device()]);

      const [presented] = await service.getUserDevices('plex-9');

      expect(presented).toEqual({
        id: 1,
        deviceIdentifier: 'dev-1',
        deviceName: 'Living Room TV',
        devicePlatform: 'Android',
        deviceProduct: 'Plex for Android',
        status: 'pending',
        firstSeen: new Date('2026-01-01T00:00:00Z'),
        lastSeen: new Date('2026-08-01T00:00:00Z'),
        requestDescription: undefined,
        requestSubmittedAt: undefined,
        requestNoteReadAt: undefined,
        hasTemporaryAccess: null,
        temporaryAccessUntil: undefined,
        temporaryAccessBypassPolicies: undefined,
        excludeFromConcurrentLimit: false,
        rules: undefined,
      });
    });

    it('substitutes placeholders for details Plex never reported', async () => {
      deviceRepo.find.mockResolvedValue([
        device({ deviceName: null, devicePlatform: null, deviceProduct: null }),
      ]);

      const [presented] = await service.getUserDevices('plex-9');

      expect(presented).toMatchObject({
        deviceName: 'Unknown Device',
        devicePlatform: 'Unknown',
        deviceProduct: 'Unknown',
      });
    });

    it('shows a Plexamp device as approved regardless of its stored status', async () => {
      deviceRepo.find.mockResolvedValue([
        device({ status: 'rejected', deviceProduct: 'Plexamp' }),
      ]);

      const [presented] = await service.getUserDevices('plex-9');
      expect(presented.status).toBe('approved');
    });

    it('surfaces live temporary access', async () => {
      const until = new Date(Date.now() + 60_000);
      deviceRepo.find.mockResolvedValue([
        device({
          temporaryAccessUntil: until,
          temporaryAccessBypassPolicies: true,
        }),
      ]);

      const [presented] = await service.getUserDevices('plex-9');

      expect(presented).toMatchObject({
        hasTemporaryAccess: true,
        temporaryAccessUntil: until,
        temporaryAccessBypassPolicies: true,
      });
    });

    it('hides temporary access that has already lapsed', async () => {
      deviceRepo.find.mockResolvedValue([
        device({ temporaryAccessUntil: new Date(Date.now() - 60_000) }),
      ]);

      const [presented] = await service.getUserDevices('plex-9');

      expect(presented.hasTemporaryAccess).toBe(false);
      expect(presented.temporaryAccessUntil).toBeUndefined();
    });

    it('leaves rules off when the portal is not showing them', async () => {
      deviceRepo.find.mockResolvedValue([device()]);

      const [presented] = await service.getUserDevices('plex-9');

      expect(presented.rules).toBeUndefined();
      expect(timeRuleRepo.find).not.toHaveBeenCalled();
    });

    it('attaches the device-specific rules when the portal shows them', async () => {
      settings.set('USER_PORTAL_SHOW_RULES', 'true');
      deviceRepo.find.mockResolvedValue([device()]);
      timeRuleRepo.find.mockResolvedValue([
        timeRule({ id: 1, deviceIdentifier: 'dev-1' }),
        timeRule({ id: 2, deviceIdentifier: 'dev-1', dayOfWeek: 2 }),
      ]);

      const [presented] = await service.getUserDevices('plex-9');

      expect(presented.rules?.timeRules).toHaveLength(2);
      expect(presented.rules?.timeRules[0]).toEqual({
        id: 1,
        dayOfWeek: 1,
        startTime: '20:00',
        endTime: '22:00',
        ruleName: 'Bedtime',
        enabled: true,
        deviceIdentifier: 'dev-1',
      });
    });

    it('does not attach user-wide rules to a device', async () => {
      settings.set('USER_PORTAL_SHOW_RULES', 'true');
      deviceRepo.find.mockResolvedValue([device()]);
      timeRuleRepo.find.mockResolvedValue([timeRule()]);

      const [presented] = await service.getUserDevices('plex-9');
      expect(presented.rules).toBeUndefined();
    });

    it('does not attach rules belonging to a different device', async () => {
      settings.set('USER_PORTAL_SHOW_RULES', 'true');
      deviceRepo.find.mockResolvedValue([device()]);
      timeRuleRepo.find.mockResolvedValue([
        timeRule({ deviceIdentifier: 'dev-other' }),
      ]);

      const [presented] = await service.getUserDevices('plex-9');
      expect(presented.rules).toBeUndefined();
    });
  });

  describe('getUserRules', () => {
    beforeEach(() => {
      settings.set('USER_PORTAL_SHOW_RULES', 'true');
    });

    it('returns nothing when the portal hides rules', async () => {
      settings.set('USER_PORTAL_SHOW_RULES', 'false');
      await expect(service.getUserRules('plex-9')).resolves.toBeNull();
    });

    it('returns nothing when the setting was never written', async () => {
      settings.delete('USER_PORTAL_SHOW_RULES');
      await expect(service.getUserRules('plex-9')).resolves.toBeNull();
    });

    it('falls back to permissive defaults for a user with no preferences', async () => {
      await expect(service.getUserRules('plex-9')).resolves.toMatchObject({
        networkPolicy: 'both',
        ipAccessPolicy: 'all',
        allowedIPs: undefined,
        concurrentStreamLimit: null,
        defaultBlock: null,
      });
    });

    it('reflects the stored preferences', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        networkPolicy: 'lan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['10.0.0.0/8'],
        concurrentStreamLimit: 3,
        defaultBlock: false,
      });

      await expect(service.getUserRules('plex-9')).resolves.toMatchObject({
        networkPolicy: 'lan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['10.0.0.0/8'],
        concurrentStreamLimit: 3,
        effectiveConcurrentStreamLimit: 3,
        defaultBlock: false,
        effectiveDefaultBlock: false,
      });
    });

    it('resolves the concurrent limit from the global setting when unset', async () => {
      settings.set('CONCURRENT_STREAM_LIMIT', '5');

      await expect(service.getUserRules('plex-9')).resolves.toMatchObject({
        concurrentStreamLimit: null,
        effectiveConcurrentStreamLimit: 5,
      });
    });

    it('treats a missing global limit as unlimited', async () => {
      const rules = await service.getUserRules('plex-9');
      expect(rules?.effectiveConcurrentStreamLimit).toBe(0);
    });

    it('treats an unparseable global limit as unlimited', async () => {
      settings.set('CONCURRENT_STREAM_LIMIT', 'lots');

      const rules = await service.getUserRules('plex-9');
      expect(rules?.effectiveConcurrentStreamLimit).toBe(0);
    });

    it('resolves the default block from the global setting when unset', async () => {
      settings.set('PLEX_GUARD_DEFAULT_BLOCK', 'true');

      const rules = await service.getUserRules('plex-9');
      expect(rules?.effectiveDefaultBlock).toBe(true);
    });

    it('treats a missing global default block as allow', async () => {
      const rules = await service.getUserRules('plex-9');
      expect(rules?.effectiveDefaultBlock).toBe(false);
    });

    it('honours a user override of the default block', async () => {
      settings.set('PLEX_GUARD_DEFAULT_BLOCK', 'false');
      preferenceRepo.findOne.mockResolvedValue({ defaultBlock: true });

      const rules = await service.getUserRules('plex-9');
      expect(rules?.effectiveDefaultBlock).toBe(true);
    });

    it('lists only rules that are not tied to a device', async () => {
      await service.getUserRules('plex-9');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(rule.deviceIdentifier IS NULL OR rule.deviceIdentifier = :empty)',
        { empty: '' },
      );
    });

    it('presents the user-wide time rules', async () => {
      queryBuilder.getMany.mockResolvedValue([timeRule()]);

      const rules = await service.getUserRules('plex-9');
      expect(rules?.timeRules).toEqual([
        {
          id: 1,
          dayOfWeek: 1,
          startTime: '20:00',
          endTime: '22:00',
          ruleName: 'Bedtime',
          enabled: true,
          deviceIdentifier: undefined,
        },
      ]);
    });
  });

  describe('requestDeviceApproval', () => {
    it('records the note against the device', async () => {
      await service.requestDeviceApproval('plex-9', 1, 'my new tablet');

      expect(deviceRepo.update).toHaveBeenCalledWith(1, {
        requestDescription: 'my new tablet',
        requestSubmittedAt: expect.any(Date),
      });
    });

    it('accepts a request with no note', async () => {
      await service.requestDeviceApproval('plex-9', 1);

      expect(deviceRepo.update).toHaveBeenCalledWith(1, {
        requestDescription: '',
        requestSubmittedAt: expect.any(Date),
      });
      expect(
        notificationsService.createDeviceNoteNotification,
      ).not.toHaveBeenCalled();
    });

    it('notifies the admin using the stored username', async () => {
      preferenceRepo.findOne.mockResolvedValue({ username: 'guest' });

      await service.requestDeviceApproval('plex-9', 1, 'my new tablet');

      expect(
        notificationsService.createDeviceNoteNotification,
      ).toHaveBeenCalledWith(
        'plex-9',
        'guest',
        'Living Room TV',
        'my new tablet',
      );
    });

    it('falls back to a placeholder username', async () => {
      await service.requestDeviceApproval('plex-9', 1, 'note');

      expect(
        notificationsService.createDeviceNoteNotification,
      ).toHaveBeenCalledWith(
        'plex-9',
        'Unknown User',
        expect.anything(),
        'note',
      );
    });

    it('still records the note when the notification fails', async () => {
      notificationsService.createDeviceNoteNotification.mockRejectedValue(
        new Error('no relay'),
      );

      await expect(
        service.requestDeviceApproval('plex-9', 1, 'note'),
      ).resolves.toBeUndefined();
      expect(deviceRepo.update).toHaveBeenCalled();
    });

    it('refuses a device that does not exist', async () => {
      deviceRepo.findOne.mockResolvedValue(null);
      await expect(service.requestDeviceApproval('plex-9', 1)).rejects.toThrow(
        'Device not found',
      );
    });

    it('refuses a device belonging to someone else', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ userId: 'plex-other' }));

      await expect(service.requestDeviceApproval('plex-9', 1)).rejects.toThrow(
        'Access denied to this device',
      );
      expect(deviceRepo.update).not.toHaveBeenCalled();
    });

    it('refuses a device that is already approved', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ status: 'approved' }));
      await expect(service.requestDeviceApproval('plex-9', 1)).rejects.toThrow(
        'Device is already approved',
      );
    });

    it('refuses a second note on the same device', async () => {
      deviceRepo.findOne.mockResolvedValue(
        device({ requestSubmittedAt: new Date() }),
      );

      await expect(service.requestDeviceApproval('plex-9', 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a note on a rejected device by default', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ status: 'rejected' }));
      await expect(
        service.requestDeviceApproval('plex-9', 1),
      ).resolves.toBeUndefined();
    });

    it('refuses a note on a rejected device when the admin disabled it', async () => {
      settings.set('USER_PORTAL_ALLOW_REJECTED_REQUESTS', 'false');
      deviceRepo.findOne.mockResolvedValue(device({ status: 'rejected' }));

      await expect(service.requestDeviceApproval('plex-9', 1)).rejects.toThrow(
        'Adding notes for rejected devices is not allowed',
      );
    });
  });

  describe('getPortalSettings', () => {
    it('defaults to hiding rules and allowing rejected requests', async () => {
      await expect(service.getPortalSettings()).resolves.toEqual({
        showRules: false,
        allowRejectedRequests: true,
      });
    });

    it('reflects the stored settings', async () => {
      settings.set('USER_PORTAL_SHOW_RULES', 'true');
      settings.set('USER_PORTAL_ALLOW_REJECTED_REQUESTS', 'false');

      await expect(service.getPortalSettings()).resolves.toEqual({
        showRules: true,
        allowRejectedRequests: false,
      });
    });

    it('treats a blank stored value as unset', async () => {
      settings.set('USER_PORTAL_SHOW_RULES', '');
      await expect(service.getPortalSettings()).resolves.toMatchObject({
        showRules: false,
      });
    });
  });
});
