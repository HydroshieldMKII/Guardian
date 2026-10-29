import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { PlexSession, PlexSessionsResponse } from '@/types/plex.types';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import {
  DeviceEventsService,
  DeviceLocationChangedEvent,
} from '@/modules/devices/services/device-events.service';
import { userDevice } from '@/modules/devices/services/user-device.fixture';
import { anyDate, callArgs } from '@/test-matchers';

describe('DeviceTrackingService', () => {
  let service: DeviceTrackingService;
  let deviceEvents: DeviceEventsService;
  let deviceRepo: Record<
    'find' | 'findOne' | 'create' | 'save' | 'update',
    jest.Mock
  >;
  let historyRepo: { update: jest.Mock };
  let usersService: Record<string, jest.Mock>;
  let configService: { getSetting: jest.Mock };

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

  beforeEach(async () => {
    deviceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity: Partial<UserDevice>) =>
        Object.assign(new UserDevice(), entity),
      ),
      save: jest.fn((entity: UserDevice) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    historyRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    usersService = {
      updateUserFromSessionData: jest.fn().mockResolvedValue(undefined),
      getEffectiveDefaultBlock: jest.fn().mockResolvedValue(true),
    };
    configService = { getSetting: jest.fn().mockResolvedValue(false) };

    const module = await Test.createTestingModule({
      providers: [
        DeviceTrackingService,
        DeviceEventsService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: getRepositoryToken(SessionHistory), useValue: historyRepo },
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DeviceTrackingService);
    deviceEvents = module.get(DeviceEventsService);
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
      deviceEvents.onNewDeviceDetected(listener);

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

    it('notifies listeners without a session key when Plex sent none', async () => {
      const listener = jest.fn();
      deviceEvents.onNewDeviceDetected(listener);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session({ sessionKey: undefined })),
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ sessionKey: undefined }),
      );
    });

    it('substitutes placeholders for details Plex did not send', async () => {
      const listener = jest.fn();
      deviceEvents.onNewDeviceDetected(listener);

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
      deviceEvents.onNewDeviceDetected(() => {
        throw new Error('listener blew up');
      });
      deviceEvents.onNewDeviceDetected(survivor);

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(survivor).toHaveBeenCalled();
    });
  });

  describe('existing devices', () => {
    it('refreshes the last-seen timestamp', async () => {
      const existing = userDevice({
        lastSeen: new Date('2020-01-01T00:00:00Z'),
      });
      deviceRepo.findOne.mockResolvedValue(existing);
      const before = Date.now();

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().lastSeen.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('counts a session key it has never seen', async () => {
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice()).toMatchObject({
        sessionCount: 5,
        currentSessionKey: 'sk-1',
      });
    });

    it('does not double-count a session key seen on the previous poll', async () => {
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));

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
        userDevice({ sessionCount: 4, currentSessionKey: 'sk-1' }),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().sessionCount).toBe(4);
    });

    it('counts a genuinely new session on the same device', async () => {
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session({ sessionKey: 'sk-2' })),
      );

      expect(savedDevice(1).sessionCount).toBe(6);
    });

    it('leaves the session count alone when Plex sends no session key', async () => {
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session({ sessionKey: undefined })),
      );

      expect(savedDevice().sessionCount).toBe(4);
    });

    it('fills in the platform and product when the row has neither', async () => {
      deviceRepo.findOne.mockResolvedValue(
        userDevice({ devicePlatform: null, deviceProduct: null }),
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
        userDevice({
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
      deviceRepo.findOne.mockResolvedValue(
        userDevice({ deviceVersion: '9.0' }),
      );

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().deviceVersion).toBe('10.0');
    });

    it('records the first IP address without raising a location change', async () => {
      const listener = jest.fn();
      deviceEvents.onDeviceLocationChanged(listener);
      deviceRepo.findOne.mockResolvedValue(userDevice({ ipAddress: null }));

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(savedDevice().ipAddress).toBe('10.0.0.5');
      expect(listener).not.toHaveBeenCalled();
    });

    it('raises a location change when the IP moves', async () => {
      const listener = jest.fn();
      deviceEvents.onDeviceLocationChanged(listener);
      deviceRepo.findOne.mockResolvedValue(
        userDevice({ ipAddress: '10.0.0.5' }),
      );

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
      deviceEvents.onDeviceLocationChanged(listener);
      deviceRepo.findOne.mockResolvedValue(userDevice());

      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps notifying the other location listeners when one throws', async () => {
      const survivor = jest.fn();
      deviceEvents.onDeviceLocationChanged(() => {
        throw new Error('listener blew up');
      });
      deviceEvents.onDeviceLocationChanged(survivor);
      deviceRepo.findOne.mockResolvedValue(
        userDevice({ ipAddress: '10.0.0.5' }),
      );

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
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));
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
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));
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

  describe('placeholders in log and event text', () => {
    it('falls back to the stored username on a location change', async () => {
      deviceRepo.findOne.mockResolvedValue(
        userDevice({ ipAddress: '10.0.0.1', username: 'stored-name' }),
      );
      const events: DeviceLocationChangedEvent[] = [];
      deviceEvents.onDeviceLocationChanged((event) => events.push(event));

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
        userDevice({
          ipAddress: '10.0.0.1',
          username: null,
          deviceName: null,
        }),
      );
      const events: DeviceLocationChangedEvent[] = [];
      deviceEvents.onDeviceLocationChanged((event) => events.push(event));

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

  describe('clearSessionKey', () => {
    it('clears the key on the device and closes the history row', async () => {
      deviceRepo.find.mockResolvedValue([
        userDevice({ currentSessionKey: 'sk-1' }),
      ]);

      await service.clearSessionKey('sk-1');

      expect(deviceRepo.update).toHaveBeenCalledWith(
        { currentSessionKey: 'sk-1' },
        { currentSessionKey: null },
      );
      expect(historyRepo.update).toHaveBeenCalledWith(
        { sessionKey: 'sk-1', endedAt: IsNull() },
        { endedAt: anyDate() },
      );
    });

    it('lets the same session key be counted again afterwards', async () => {
      deviceRepo.findOne.mockResolvedValue(userDevice({ sessionCount: 4 }));
      await service.processSessionsForDeviceTracking(
        sessionsResponse(session()),
      );

      deviceRepo.find.mockResolvedValue([
        userDevice({ currentSessionKey: 'sk-1' }),
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
      deviceRepo.update.mockResolvedValue({});
      await expect(service.clearSessionKey('sk-1')).resolves.toBeUndefined();
    });
  });
});
