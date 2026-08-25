import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { PlexSession, PlexSessionsResponse } from '@/types/plex.types';
import { ConcurrentStreamService } from '@/modules/users/services/concurrent-stream.service';

const device = (overrides: Partial<UserDevice> = {}): UserDevice =>
  Object.assign(new UserDevice(), {
    id: 1,
    userId: 'u1',
    deviceIdentifier: 'device-a',
    excludeFromConcurrentLimit: false,
    ...overrides,
  });

const session = (overrides: Partial<PlexSession> = {}): PlexSession => ({
  User: { id: 'u1' },
  Player: { machineIdentifier: 'device-a', product: 'Plex Web' },
  ...overrides,
});

const sessionsResponse = (sessions: PlexSession[]): PlexSessionsResponse => ({
  MediaContainer: { size: sessions.length, Metadata: sessions },
});

describe('ConcurrentStreamService', () => {
  let service: ConcurrentStreamService;
  let userDeviceRepository: jest.Mocked<Repository<UserDevice>>;
  let userPreferenceRepository: jest.Mocked<Repository<UserPreference>>;
  let configService: { getSetting: jest.Mock };
  let deviceTrackingService: { isTemporaryAccessValid: jest.Mock };

  const settings: Record<string, unknown> = {
    CONCURRENT_STREAM_LIMIT: 0,
    CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS: false,
  };

  beforeEach(async () => {
    settings.CONCURRENT_STREAM_LIMIT = 0;
    settings.CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS = false;

    userDeviceRepository = {
      find: jest.fn().mockResolvedValue([device()]),
    } as unknown as jest.Mocked<Repository<UserDevice>>;

    userPreferenceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<UserPreference>>;

    configService = {
      getSetting: jest.fn((key: string) => Promise.resolve(settings[key])),
    };

    deviceTrackingService = {
      isTemporaryAccessValid: jest.fn().mockResolvedValue(false),
    };

    const module = await Test.createTestingModule({
      providers: [
        ConcurrentStreamService,
        {
          provide: getRepositoryToken(UserDevice),
          useValue: userDeviceRepository,
        },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: userPreferenceRepository,
        },
        { provide: ConfigService, useValue: configService },
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
      ],
    }).compile();

    service = module.get(ConcurrentStreamService);
  });

  describe('getEffectiveLimit', () => {
    it('falls back to the global limit when the user has no override', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 3;
      await expect(service.getEffectiveLimit('u1')).resolves.toBe(3);
    });

    it('prefers a per-user override', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 3;
      userPreferenceRepository.findOne.mockResolvedValue(
        Object.assign(new UserPreference(), { concurrentStreamLimit: 5 }),
      );
      await expect(service.getEffectiveLimit('u1')).resolves.toBe(5);
    });

    it('honours an override of zero as unlimited', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 3;
      userPreferenceRepository.findOne.mockResolvedValue(
        Object.assign(new UserPreference(), { concurrentStreamLimit: 0 }),
      );
      await expect(service.getEffectiveLimit('u1')).resolves.toBe(0);
    });

    it('ignores a null override', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 4;
      userPreferenceRepository.findOne.mockResolvedValue(
        Object.assign(new UserPreference(), { concurrentStreamLimit: null }),
      );
      await expect(service.getEffectiveLimit('u1')).resolves.toBe(4);
    });

    it('defaults to unlimited when the global setting is not numeric', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 'nope';
      await expect(service.getEffectiveLimit('u1')).resolves.toBe(0);
    });
  });

  describe('filterCountableSessions', () => {
    it('keeps an ordinary session', async () => {
      const result = await service.filterCountableSessions('u1', [session()]);
      expect(result).toHaveLength(1);
    });

    it('drops sessions belonging to another user', async () => {
      const result = await service.filterCountableSessions('u1', [
        session({ User: { id: 'u2' } }),
      ]);
      expect(result).toHaveLength(0);
    });

    it('matches the user by uuid when no id is present', async () => {
      const result = await service.filterCountableSessions('u1', [
        session({ User: { uuid: 'u1' } }),
      ]);
      expect(result).toHaveLength(1);
    });

    it('drops sessions with no device identifier', async () => {
      const result = await service.filterCountableSessions('u1', [
        session({ Player: { product: 'Plex Web' } }),
      ]);
      expect(result).toHaveLength(0);
    });

    it('drops Plexamp sessions', async () => {
      const result = await service.filterCountableSessions('u1', [
        session({
          Player: { machineIdentifier: 'device-a', product: 'Plexamp' },
        }),
      ]);
      expect(result).toHaveLength(0);
    });

    it('drops devices flagged as excluded', async () => {
      userDeviceRepository.find.mockResolvedValue([
        device({ excludeFromConcurrentLimit: true }),
      ]);
      const result = await service.filterCountableSessions('u1', [session()]);
      expect(result).toHaveLength(0);
    });

    it('drops temporary-access devices by default', async () => {
      deviceTrackingService.isTemporaryAccessValid.mockResolvedValue(true);
      const result = await service.filterCountableSessions('u1', [session()]);
      expect(result).toHaveLength(0);
    });

    it('keeps temporary-access devices when configured to include them', async () => {
      settings.CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS = true;
      deviceTrackingService.isTemporaryAccessValid.mockResolvedValue(true);
      const result = await service.filterCountableSessions('u1', [session()]);
      expect(result).toHaveLength(1);
    });

    it('keeps sessions from devices that are not registered', async () => {
      userDeviceRepository.find.mockResolvedValue([]);
      const result = await service.filterCountableSessions('u1', [session()]);
      expect(result).toHaveLength(1);
    });
  });

  describe('countActiveStreams', () => {
    it('counts the countable sessions', async () => {
      userDeviceRepository.find.mockResolvedValue([
        device({ deviceIdentifier: 'device-a' }),
        device({ id: 2, deviceIdentifier: 'device-b' }),
      ]);

      const count = await service.countActiveStreams(
        'u1',
        sessionsResponse([
          session(),
          session({
            Player: { machineIdentifier: 'device-b', product: 'Plex Web' },
          }),
        ]),
      );

      expect(count).toBe(2);
    });

    it('returns zero for an empty container', async () => {
      await expect(service.countActiveStreams('u1', {})).resolves.toBe(0);
    });

    it('returns zero when metadata is absent', async () => {
      await expect(
        service.countActiveStreams('u1', { MediaContainer: {} }),
      ).resolves.toBe(0);
    });
  });

  describe('getConcurrentStreamInfo', () => {
    it('reports unlimited when the limit is zero', async () => {
      await expect(service.getConcurrentStreamInfo('u1')).resolves.toEqual({
        limit: 0,
        currentStreams: 0,
        isUnlimited: true,
      });
    });

    it('reports the limit and current usage', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 2;
      await expect(
        service.getConcurrentStreamInfo('u1', sessionsResponse([session()])),
      ).resolves.toEqual({
        limit: 2,
        currentStreams: 1,
        isUnlimited: false,
      });
    });

    it('reports zero usage when no session data is supplied', async () => {
      settings.CONCURRENT_STREAM_LIMIT = 2;
      const info = await service.getConcurrentStreamInfo('u1');
      expect(info.currentStreams).toBe(0);
    });
  });
});
