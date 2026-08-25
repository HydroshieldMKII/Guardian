import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { PlexSession, PlexSessionsResponse } from '@/types/plex.types';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { anyDate, callArgs } from '@/test-matchers';

interface TemporaryAccessPatch {
  temporaryAccessDurationMinutes: number;
  temporaryAccessBypassPolicies: boolean;
  temporaryAccessUntil: Date;
}

describe('DeviceTrackingService', () => {
  let service: DeviceTrackingService;
  let deviceRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let historyRepo: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let deviceQueryBuilder: Record<string, jest.Mock>;
  let historyQueryBuilder: Record<string, jest.Mock>;
  let transactionRepos: {
    history: { delete: jest.Mock };
    devices: { delete: jest.Mock };
  };

  const device = (overrides: Partial<UserDevice> = {}): UserDevice =>
    Object.assign(new UserDevice(), {
      id: 1,
      userId: 'u1',
      username: 'testuser',
      deviceIdentifier: 'dev-1',
      deviceName: 'Living Room TV',
      devicePlatform: 'Android',
      deviceProduct: 'Plex for Android',
      deviceVersion: '10.0',
      status: 'pending',
      sessionCount: 1,
      currentSessionKey: null,
      ipAddress: '10.0.0.5',
      firstSeen: new Date('2026-01-01T00:00:00Z'),
      lastSeen: new Date('2026-08-01T00:00:00Z'),
      excludeFromConcurrentLimit: false,
      temporaryAccessUntil: null,
      ...overrides,
    });

  const session = (overrides: Partial<PlexSession> = {}): PlexSession => ({
    sessionKey: 'sk-1',
    User: { id: 'u1', title: 'testuser', thumb: 'avatar.png' },
    Player: {
      machineIdentifier: 'dev-1',
      device: 'Living Room TV',
      platform: 'Android',
      product: 'Plex for Android',
      version: '10.0',
      address: '10.0.0.5',
    },
    ...overrides,
  });

  const sessionsResponse = (
    ...metadata: PlexSession[]
  ): PlexSessionsResponse => ({
    MediaContainer: { size: metadata.length, Metadata: metadata },
  });

  const chainable = (terminal: Record<string, jest.Mock>) => {
    const builder: Record<string, jest.Mock> = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      ...terminal,
    };
    builder.update.mockReturnValue(builder);
    builder.set.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    return builder;
  };

  beforeEach(async () => {
    deviceQueryBuilder = chainable({
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    historyQueryBuilder = chainable({
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    });

    transactionRepos = {
      history: { delete: jest.fn().mockResolvedValue({ affected: 3 }) },
      devices: { delete: jest.fn().mockResolvedValue({ affected: 1 }) },
    };

    deviceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity: Partial<UserDevice>) =>
        Object.assign(new UserDevice(), entity),
      ),
      save: jest.fn((entity: UserDevice) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => deviceQueryBuilder),
      manager: {
        transaction: jest.fn(async (run: (manager: unknown) => Promise<void>) =>
          run({
            getRepository: (entity: unknown) =>
              entity === SessionHistory
                ? transactionRepos.history
                : transactionRepos.devices,
          }),
        ),
      },
    };

    historyRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 2 }),
      createQueryBuilder: jest.fn(() => historyQueryBuilder),
    };

    usersService = {
      updateUserFromSessionData: jest.fn().mockResolvedValue(undefined),
      getEffectiveDefaultBlock: jest.fn().mockResolvedValue(true),
    };

    configService = {
      getSetting: jest.fn().mockResolvedValue(false),
      getTimezone: jest.fn().mockResolvedValue('+00:00'),
    };

    const module = await Test.createTestingModule({
      providers: [
        DeviceTrackingService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: getRepositoryToken(SessionHistory), useValue: historyRepo },
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DeviceTrackingService);
  });

  const savedDevice = (call = 0): UserDevice =>
    callArgs<[UserDevice]>(deviceRepo.save, call)[0];

  describe('processSessionsForDeviceTracking', () => {
    it('does nothing when there are no sessions', async () => {
      await service.processSessionsForDeviceTracking(sessionsResponse());
      expect(deviceRepo.findOne).not.toHaveBeenCalled();
    });

    it.each([
      ['a null payload', null],
      ['an empty payload', {}],
      ['a container with no metadata', { MediaContainer: { size: 0 } }],
    ])('tolerates %s', async (_label, payload) => {
      await expect(
        service.processSessionsForDeviceTracking(
          payload as PlexSessionsResponse,
        ),
      ).resolves.toBeUndefined();
    });

    it('refreshes the user profile from the session', async () => {
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(usersService.updateUserFromSessionData).toHaveBeenCalledWith(
        'u1',
        'testuser',
        'avatar.png',
      );
    });

    it('files a session with no identifiable user or device under "unknown"', async () => {
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session({ User: undefined, Player: undefined })),
      );

      expect(savedDevice()).toMatchObject({
        userId: 'unknown',
        deviceIdentifier: 'unknown',
      });
    });

    it('falls back to the user uuid when no id is present', async () => {
      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({ User: { uuid: 'uuid-1', title: 'testuser' } }),
        ),
      );

      expect(usersService.updateUserFromSessionData).toHaveBeenCalledWith(
        'uuid-1',
        'testuser',
        undefined,
      );
    });

    it('keeps processing the remaining sessions after one fails', async () => {
      deviceRepo.findOne
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValue(null);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session(),
          session({ Player: { machineIdentifier: 'dev-2' } }),
        ),
      );

      expect(deviceRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('new devices', () => {
    it('creates a pending device outside strict mode', async () => {
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice()).toMatchObject({
        userId: 'u1',
        deviceIdentifier: 'dev-1',
        status: 'pending',
        sessionCount: 1,
        currentSessionKey: 'sk-1',
        ipAddress: '10.0.0.5',
      });
    });

    it('rejects a new device in strict mode when the user default is block', async () => {
      configService.getSetting.mockResolvedValue(true);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().status).toBe('rejected');
    });

    it('approves a new device in strict mode when the user default is allow', async () => {
      configService.getSetting.mockResolvedValue(true);
      usersService.getEffectiveDefaultBlock.mockResolvedValue(false);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().status).toBe('approved');
    });

    it.each([
      ['product', { product: 'Plexamp' }],
      ['name', { device: 'Kitchen PlexAmp' }],
    ])(
      'always approves a Plexamp device in strict mode, matched by %s',
      async (_label, player) => {
        configService.getSetting.mockResolvedValue(true);

        await service.processSessionsForDeviceTracking(
          sessionsResponse(
            session({
              Player: { machineIdentifier: 'dev-1', ...player },
            }),
          ),
        );

        expect(savedDevice().status).toBe('approved');
      },
    );

    it('notifies listeners with the device details', async () => {
      const listener = jest.fn();
      service.onNewDeviceDetected(listener);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(listener).toHaveBeenCalledWith({
        userId: 'u1',
        username: 'testuser',
        deviceName: 'Living Room TV',
        deviceIdentifier: 'dev-1',
        ipAddress: '10.0.0.5',
        platform: 'Android',
        sessionKey: 'sk-1',
      });
    });

    it('substitutes placeholders for details Plex did not send', async () => {
      const listener = jest.fn();
      service.onNewDeviceDetected(listener);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            User: { id: 'u1' },
            Player: { machineIdentifier: 'dev-1' },
          }),
        ),
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'Unknown User',
          deviceName: 'Unknown Device',
          ipAddress: 'Unknown IP',
          platform: 'Unknown',
        }),
      );
    });

    it('keeps notifying the other listeners when one throws', async () => {
      const survivor = jest.fn();
      service.onNewDeviceDetected(() => {
        throw new Error('listener blew up');
      });
      service.onNewDeviceDetected(survivor);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(survivor).toHaveBeenCalled();
    });
  });

  describe('existing devices', () => {
    it('refreshes the last-seen timestamp', async () => {
      const existing = device({ lastSeen: new Date('2020-01-01T00:00:00Z') });
      deviceRepo.findOne.mockResolvedValue(existing);
      const before = Date.now();

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().lastSeen.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('counts a session key it has never seen', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice()).toMatchObject({
        sessionCount: 5,
        currentSessionKey: 'sk-1',
      });
    });

    it('does not double-count a session key seen on the previous poll', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice(1).sessionCount).toBe(5);
    });

    it('does not re-count the session key already stored on the device', async () => {
      deviceRepo.findOne.mockResolvedValue(
        device({ sessionCount: 4, currentSessionKey: 'sk-1' }),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().sessionCount).toBe(4);
    });

    it('counts a genuinely new session on the same device', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session({ sessionKey: 'sk-2' })),
      );

      expect(savedDevice(1).sessionCount).toBe(6);
    });

    it('leaves the session count alone when Plex sends no session key', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session({ sessionKey: undefined })),
      );

      expect(savedDevice().sessionCount).toBe(4);
    });

    it('fills in the platform and product when the row has neither', async () => {
      deviceRepo.findOne.mockResolvedValue(
        device({ devicePlatform: null, deviceProduct: null }),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            Player: {
              machineIdentifier: 'dev-1',
              platform: 'iOS',
              product: 'Plex for iOS',
            },
          }),
        ),
      );

      expect(savedDevice()).toMatchObject({
        devicePlatform: 'iOS',
        deviceProduct: 'Plex for iOS',
      });
    });

    it('fills in details that were missing, without overwriting known ones', async () => {
      deviceRepo.findOne.mockResolvedValue(
        device({
          deviceName: null,
          devicePlatform: 'Android',
          deviceProduct: null,
          username: null,
        }),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            Player: {
              machineIdentifier: 'dev-1',
              device: 'Bedroom TV',
              platform: 'iOS',
              product: 'Plex for iOS',
              version: '11.0',
            },
          }),
        ),
      );

      expect(savedDevice()).toMatchObject({
        deviceName: 'Bedroom TV',
        devicePlatform: 'Android',
        deviceProduct: 'Plex for iOS',
        username: 'testuser',
      });
    });

    it('always takes the newest client version', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ deviceVersion: '9.0' }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().deviceVersion).toBe('10.0');
    });

    it('records the first IP address without raising a location change', async () => {
      const listener = jest.fn();
      service.onDeviceLocationChanged(listener);
      deviceRepo.findOne.mockResolvedValue(device({ ipAddress: null }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().ipAddress).toBe('10.0.0.5');
      expect(listener).not.toHaveBeenCalled();
    });

    it('raises a location change when the IP moves', async () => {
      const listener = jest.fn();
      service.onDeviceLocationChanged(listener);
      deviceRepo.findOne.mockResolvedValue(device({ ipAddress: '10.0.0.5' }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            Player: { machineIdentifier: 'dev-1', address: '203.0.113.9' },
          }),
        ),
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          oldIpAddress: '10.0.0.5',
          newIpAddress: '203.0.113.9',
        }),
      );
      expect(savedDevice().ipAddress).toBe('203.0.113.9');
    });

    it('stays quiet when the IP is unchanged', async () => {
      const listener = jest.fn();
      service.onDeviceLocationChanged(listener);
      deviceRepo.findOne.mockResolvedValue(device());

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps notifying the other location listeners when one throws', async () => {
      const survivor = jest.fn();
      service.onDeviceLocationChanged(() => {
        throw new Error('listener blew up');
      });
      service.onDeviceLocationChanged(survivor);
      deviceRepo.findOne.mockResolvedValue(device({ ipAddress: '10.0.0.5' }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            Player: { machineIdentifier: 'dev-1', address: '203.0.113.9' },
          }),
        ),
      );

      expect(survivor).toHaveBeenCalled();
    });
  });

  describe('cleanupStaleSessionKeys', () => {
    it('forgets a device key that has been idle for over a day', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
      service.cleanupStaleSessionKeys();
      jest.spyOn(Date, 'now').mockRestore();

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice(1).sessionCount).toBe(5);
    });

    it('keeps a device key that is still active', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      service.cleanupStaleSessionKeys();

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice(1).sessionCount).toBe(5);
    });
  });

  describe('queries', () => {
    it('lists all devices newest-seen first', async () => {
      await service.getAllDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        order: { lastSeen: 'DESC' },
      });
    });

    it('lists pending devices newest-first', async () => {
      await service.getPendingDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        order: { firstSeen: 'DESC' },
      });
    });

    it('treats both approved and rejected devices as processed', async () => {
      await service.getProcessedDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: [{ status: 'approved' }, { status: 'rejected' }],
        order: { lastSeen: 'DESC' },
      });
    });

    it('lists approved devices', async () => {
      await service.getApprovedDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: { status: 'approved' },
        order: { lastSeen: 'DESC' },
      });
    });

    it('finds a device by user and identifier', async () => {
      await service.findDeviceByUserAndIdentifier('u1', 'dev-1');
      expect(deviceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: 'dev-1' },
      });
    });

    it('finds a device by identifier alone', async () => {
      await service.findDeviceByIdentifier('dev-1');
      expect(deviceRepo.findOne).toHaveBeenCalledWith({
        where: { deviceIdentifier: 'dev-1' },
      });
    });
  });

  describe('enforceStrictModeOnPendingDevices', () => {
    it('does nothing when strict mode is off', async () => {
      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        0,
      );
      expect(deviceRepo.find).not.toHaveBeenCalled();
    });

    it('does nothing when there is nothing pending', async () => {
      configService.getSetting.mockResolvedValue(true);
      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        0,
      );
      expect(deviceRepo.save).not.toHaveBeenCalled();
    });

    it('applies the block policy to each pending device', async () => {
      configService.getSetting.mockResolvedValue(true);
      deviceRepo.find.mockResolvedValue([device({ id: 1 }), device({ id: 2 })]);

      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        2,
      );
      expect(savedDevice(0).status).toBe('rejected');
      expect(savedDevice(1).status).toBe('rejected');
    });

    it('approves when the user default is allow', async () => {
      configService.getSetting.mockResolvedValue(true);
      usersService.getEffectiveDefaultBlock.mockResolvedValue(false);
      deviceRepo.find.mockResolvedValue([device()]);

      await service.enforceStrictModeOnPendingDevices();
      expect(savedDevice().status).toBe('approved');
    });

    it('still applies the policy to a device with no name', async () => {
      configService.getSetting.mockResolvedValue(true);
      deviceRepo.find.mockResolvedValue([
        device({ deviceName: null, username: null }),
      ]);

      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        1,
      );
      expect(savedDevice().status).toBe('rejected');
    });

    it('always approves Plexamp devices', async () => {
      configService.getSetting.mockResolvedValue(true);
      deviceRepo.find.mockResolvedValue([device({ deviceProduct: 'Plexamp' })]);

      await service.enforceStrictModeOnPendingDevices();
      expect(savedDevice().status).toBe('approved');
    });

    it('counts only the devices it managed to update', async () => {
      configService.getSetting.mockResolvedValue(true);
      deviceRepo.find.mockResolvedValue([device({ id: 1 }), device({ id: 2 })]);
      deviceRepo.save
        .mockRejectedValueOnce(new Error('locked'))
        .mockImplementation((entity: UserDevice) => Promise.resolve(entity));

      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        1,
      );
    });
  });

  describe('status changes', () => {
    it('approves a device and drops any temporary access', async () => {
      await service.approveDevice(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, { status: 'approved' });
      expect(deviceQueryBuilder.where).toHaveBeenCalledWith('id = :deviceId', {
        deviceId: 7,
      });
    });

    it('rejects a device without touching temporary access', async () => {
      await service.rejectDevice(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, { status: 'rejected' });
      expect(deviceRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('sends a device back to pending and drops temporary access', async () => {
      await service.setPendingDevice(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, { status: 'pending' });
      expect(deviceQueryBuilder.execute).toHaveBeenCalled();
    });

    it('renames a device', async () => {
      await service.renameDevice(7, 'Attic TV');
      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        deviceName: 'Attic TV',
      });
    });

    it('excludes a device from the concurrent limit', async () => {
      await service.updateExcludeFromConcurrentLimit(7, true);
      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        excludeFromConcurrentLimit: true,
      });
    });

    it('includes a device back in the concurrent limit', async () => {
      await service.updateExcludeFromConcurrentLimit(7, false);
      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        excludeFromConcurrentLimit: false,
      });
    });

    it('marks a request note as read', async () => {
      await service.markNoteAsRead(7);
      expect(deviceRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ requestNoteReadAt: anyDate() }),
      );
    });

    it('clears every note column when deleting a note', async () => {
      await service.deleteNote(7);

      const [columns] = deviceQueryBuilder.set.mock.calls[0] as [
        Record<string, () => string>,
      ];
      expect(Object.keys(columns)).toEqual([
        'requestDescription',
        'requestSubmittedAt',
        'requestNoteReadAt',
      ]);
      expect(Object.values(columns).map((toSql) => toSql())).toEqual([
        'NULL',
        'NULL',
        'NULL',
      ]);
      expect(deviceQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: 7,
      });
    });
  });

  describe('placeholders in log and event text', () => {
    it('falls back to the stored username on a location change', async () => {
      deviceRepo.findOne.mockResolvedValue(
        device({ ipAddress: '10.0.0.1', username: 'stored-name' }),
      );
      const events: Record<string, unknown>[] = [];
      service.onDeviceLocationChanged((event) =>
        events.push(event as unknown as Record<string, unknown>),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            User: { id: 'u1' },
            Player: { machineIdentifier: 'dev-1', address: '1.2.3.4' },
          }),
        ),
      );

      expect(events[0]).toMatchObject({ username: 'stored-name' });
    });

    it('falls back to placeholders when neither side has a name', async () => {
      deviceRepo.findOne.mockResolvedValue(
        device({
          ipAddress: '10.0.0.1',
          username: null,
          deviceName: null,
        }),
      );
      const events: Record<string, unknown>[] = [];
      service.onDeviceLocationChanged((event) =>
        events.push(event as unknown as Record<string, unknown>),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(
          session({
            User: { id: 'u1' },
            Player: { machineIdentifier: 'dev-1', address: '1.2.3.4' },
          }),
        ),
      );

      expect(events[0]).toMatchObject({
        username: 'Unknown',
        deviceName: 'Unknown Device',
      });
    });
  });

  describe('deleteDevice', () => {
    it('removes the session history and the device in one transaction', async () => {
      await service.deleteDevice(7);

      expect(transactionRepos.history.delete).toHaveBeenCalledWith({
        userDeviceId: 7,
      });
      expect(transactionRepos.devices.delete).toHaveBeenCalledWith(7);
    });

    it('reports a transaction failure with context', async () => {
      transactionRepos.devices.delete.mockRejectedValue(
        new Error('foreign key'),
      );

      await expect(service.deleteDevice(7)).rejects.toThrow(
        'Device deletion failed: foreign key',
      );
    });
  });

  describe('temporary access', () => {
    it('stores the expiry, duration and bypass flag', async () => {
      const before = Date.now();
      await service.grantTemporaryAccess(7, 30, true);

      const [id, patch] = callArgs<[number, TemporaryAccessPatch]>(
        deviceRepo.update,
      );
      expect(id).toBe(7);
      expect(patch.temporaryAccessDurationMinutes).toBe(30);
      expect(patch.temporaryAccessBypassPolicies).toBe(true);
      expect(patch.temporaryAccessUntil.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60 * 1000,
      );
    });

    it('defaults to not bypassing policies', async () => {
      await service.grantTemporaryAccess(7, 30);
      expect(
        callArgs<[number, TemporaryAccessPatch]>(deviceRepo.update)[1]
          .temporaryAccessBypassPolicies,
      ).toBe(false);
    });

    it.each(['+05:30', '-08:00', 'not-an-offset'])(
      'grants access regardless of the configured timezone %s',
      async (timezone) => {
        configService.getTimezone.mockResolvedValue(timezone);
        await expect(
          service.grantTemporaryAccess(7, 30),
        ).resolves.toBeUndefined();
      },
    );

    it('nulls every temporary access column when revoking', async () => {
      await service.revokeTemporaryAccess(7);

      const [columns] = deviceQueryBuilder.set.mock.calls[0] as [
        {
          temporaryAccessUntil: () => string;
          temporaryAccessGrantedAt: () => string;
          temporaryAccessDurationMinutes: () => string;
          temporaryAccessBypassPolicies: boolean;
        },
      ];
      expect(columns.temporaryAccessBypassPolicies).toBe(false);
      expect(columns.temporaryAccessUntil()).toBe('NULL');
      expect(columns.temporaryAccessGrantedAt()).toBe('NULL');
      expect(columns.temporaryAccessDurationMinutes()).toBe('NULL');
    });

    it('accepts access that has not expired', async () => {
      const active = device({
        temporaryAccessUntil: new Date(Date.now() + 60_000),
      });

      await expect(service.isTemporaryAccessValid(active)).resolves.toBe(true);
      expect(deviceRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects and cleans up access that has lapsed', async () => {
      const lapsed = device({
        temporaryAccessUntil: new Date(Date.now() - 60_000),
      });

      await expect(service.isTemporaryAccessValid(lapsed)).resolves.toBe(false);
      expect(deviceQueryBuilder.execute).toHaveBeenCalled();
    });

    it('rejects a device that never had temporary access', async () => {
      await expect(service.isTemporaryAccessValid(device())).resolves.toBe(
        false,
      );
      expect(deviceRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('reports the remaining minutes, rounded up', async () => {
      const active = device({
        temporaryAccessUntil: new Date(Date.now() + 90_000),
      });
      expect(service.getTemporaryAccessTimeLeft(active)).toBe(2);
    });

    it('reports zero once the window has passed', async () => {
      const lapsed = device({
        temporaryAccessUntil: new Date(Date.now() - 60_000),
      });
      expect(service.getTemporaryAccessTimeLeft(lapsed)).toBe(0);
    });

    it('reports null for a device with no temporary access', () => {
      expect(service.getTemporaryAccessTimeLeft(device())).toBeNull();
    });
  });

  describe('clearSessionKey', () => {
    it('clears the key on the device and closes the history row', async () => {
      deviceRepo.find.mockResolvedValue([
        device({ currentSessionKey: 'sk-1' }),
      ]);

      await service.clearSessionKey('sk-1');

      expect(deviceQueryBuilder.where).toHaveBeenCalledWith(
        'current_session_key = :sessionKey',
        { sessionKey: 'sk-1' },
      );
      expect(historyQueryBuilder.where).toHaveBeenCalledWith(
        'session_key = :sessionKey',
        { sessionKey: 'sk-1' },
      );

      const [deviceColumns] = deviceQueryBuilder.set.mock.calls[0] as [
        { currentSessionKey: () => string },
      ];
      const [historyColumns] = historyQueryBuilder.set.mock.calls[0] as [
        { endedAt: () => string },
      ];
      expect(deviceColumns.currentSessionKey()).toBe('NULL');
      expect(historyColumns.endedAt()).toBe('CURRENT_TIMESTAMP');
    });

    it('lets the same session key be counted again afterwards', async () => {
      deviceRepo.findOne.mockResolvedValue(device({ sessionCount: 4 }));
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      deviceRepo.find.mockResolvedValue([
        device({ currentSessionKey: 'sk-1' }),
      ]);
      await service.clearSessionKey('sk-1');

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice(1).sessionCount).toBe(6);
    });

    it('tolerates a session key no device is holding', async () => {
      await expect(
        service.clearSessionKey('sk-ghost'),
      ).resolves.toBeUndefined();
    });

    it('tolerates a driver that omits the affected count', async () => {
      deviceQueryBuilder.execute.mockResolvedValue({});
      await expect(service.clearSessionKey('sk-1')).resolves.toBeUndefined();
    });
  });

  describe('cleanupInactiveDevices', () => {
    it('reports nothing to do on an empty database', async () => {
      await expect(service.cleanupInactiveDevices(30)).resolves.toEqual({
        deletedCount: 0,
        deletedDevices: [],
      });
      expect(deviceRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes devices last seen before the cutoff', async () => {
      const stale = device({
        id: 1,
        lastSeen: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      });
      const active = device({ id: 2, lastSeen: new Date() });
      deviceRepo.find.mockResolvedValue([stale, active]);

      const result = await service.cleanupInactiveDevices(30);

      expect(result.deletedCount).toBe(1);
      expect(result.deletedDevices).toEqual([stale]);
      expect(deviceRepo.delete).toHaveBeenCalledWith({ id: In([1]) });
      expect(historyRepo.delete).toHaveBeenCalledWith({
        userDeviceId: In([1]),
      });
    });

    it('names a device by its identifier when it has no name', async () => {
      deviceRepo.find.mockResolvedValue([
        device({
          id: 1,
          deviceName: null,
          username: null,
          lastSeen: new Date('2026-01-01T00:00:00Z'),
        }),
      ]);

      const result = await service.cleanupInactiveDevices(30);
      expect(result.deletedCount).toBe(1);
    });

    it('skips a device with no last-seen date', async () => {
      deviceRepo.find.mockResolvedValue([
        device({ id: 1, lastSeen: undefined }),
      ]);

      const result = await service.cleanupInactiveDevices(30);
      expect(result.deletedCount).toBe(0);
    });

    it('keeps every device when none are stale', async () => {
      deviceRepo.find.mockResolvedValue([device({ lastSeen: new Date() })]);

      const result = await service.cleanupInactiveDevices(30);
      expect(result.deletedCount).toBe(0);
      expect(deviceRepo.delete).toHaveBeenCalledWith({ id: In([]) });
    });
  });
});
