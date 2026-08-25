import { Test } from '@nestjs/testing';
import { PlexService } from './plex.service';
import { PlexClient } from './plex-client';
import { SessionTerminationService } from './session-termination.service';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { SessionOrchestratorService } from '@/services/session-orchestrator.service';
import { SettingValues } from '@/modules/config/settings.catalog';
import { PlexSessionsResponse } from '@/types/plex.types';

describe('PlexService', () => {
  let service: PlexService;
  let plexClient: Record<string, jest.Mock>;
  let deviceTrackingService: { findDeviceByIdentifier: jest.Mock };
  let activeSessionService: { getActiveSessionsFormatted: jest.Mock };
  let sessionOrchestratorService: { orchestrateSessionUpdate: jest.Mock };
  let settings: Partial<SettingValues>;

  const session = (overrides: Record<string, unknown> = {}) => ({
    sessionKey: '1',
    thumb: '/library/metadata/42/thumb/1700000000',
    art: '/library/metadata/42/art/1700000000',
    Player: { machineIdentifier: 'dev-1' },
    Session: { id: 's1' },
    ...overrides,
  });

  const sessionsResponse = (
    metadata: Record<string, unknown>[],
  ): PlexSessionsResponse => ({
    MediaContainer: { size: metadata.length, Metadata: metadata },
  });

  const firstSession = async () => {
    const result = await service.getActiveSessions();
    const metadata = result.MediaContainer?.Metadata ?? [];
    return metadata[0] as unknown as Record<string, unknown>;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    settings = {
      ENABLE_MEDIA_THUMBNAILS: true,
      ENABLE_MEDIA_ARTWORK: true,
      CUSTOM_PLEX_URL: '',
      PLEX_SERVER_IP: '10.0.0.5',
      PLEX_SERVER_PORT: '32400',
      USE_SSL: false,
    };

    plexClient = {
      getServerIdentity: jest.fn().mockResolvedValue('server-abc'),
      getSessions: jest.fn().mockResolvedValue(sessionsResponse([session()])),
    };

    deviceTrackingService = {
      findDeviceByIdentifier: jest.fn().mockResolvedValue({ sessionCount: 3 }),
    };

    activeSessionService = {
      getActiveSessionsFormatted: jest
        .fn()
        .mockResolvedValue(sessionsResponse([session()])),
    };

    sessionOrchestratorService = {
      orchestrateSessionUpdate: jest.fn((s: unknown) => Promise.resolve(s)),
    };

    const module = await Test.createTestingModule({
      providers: [
        PlexService,
        { provide: PlexClient, useValue: plexClient },
        { provide: SessionTerminationService, useValue: {} },
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
        { provide: ActiveSessionService, useValue: activeSessionService },
        {
          provide: ConfigService,
          useValue: {
            getSetting: jest.fn((key: keyof SettingValues) =>
              Promise.resolve(settings[key] ?? null),
            ),
          },
        },
        {
          provide: SessionOrchestratorService,
          useValue: sessionOrchestratorService,
        },
      ],
    }).compile();

    service = module.get(PlexService);
  });

  describe('getServerIdentifier', () => {
    it('asks the Plex server once and remembers the answer', async () => {
      await expect(service.getServerIdentifier()).resolves.toBe('server-abc');
      await expect(service.getServerIdentifier()).resolves.toBe('server-abc');

      expect(plexClient.getServerIdentity).toHaveBeenCalledTimes(1);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      const [a, b] = await Promise.all([
        service.getServerIdentifier(),
        service.getServerIdentifier(),
      ]);

      expect([a, b]).toEqual(['server-abc', 'server-abc']);
      expect(plexClient.getServerIdentity).toHaveBeenCalledTimes(1);
    });

    it('returns null when the server cannot be reached', async () => {
      plexClient.getServerIdentity.mockRejectedValue(new Error('offline'));

      await expect(service.getServerIdentifier()).resolves.toBeNull();
    });

    it('retries after a failure rather than caching it', async () => {
      plexClient.getServerIdentity
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce('server-abc');

      await expect(service.getServerIdentifier()).resolves.toBeNull();
      await expect(service.getServerIdentifier()).resolves.toBe('server-abc');
    });
  });

  describe('getActiveSessions', () => {
    it('stamps each session with the server identifier', async () => {
      expect(await firstSession()).toMatchObject({
        serverMachineIdentifier: 'server-abc',
      });
    });

    it('attaches the stream count for the playing device', async () => {
      expect((await firstSession()).Session).toEqual({
        id: 's1',
        sessionCount: 3,
      });
    });

    it('counts zero for a device it has never seen', async () => {
      deviceTrackingService.findDeviceByIdentifier.mockResolvedValue(null);

      expect((await firstSession()).Session).toMatchObject({
        sessionCount: 0,
      });
    });

    it('counts zero when the device lookup fails', async () => {
      deviceTrackingService.findDeviceByIdentifier.mockRejectedValue(
        new Error('db down'),
      );

      expect((await firstSession()).Session).toMatchObject({
        sessionCount: 0,
      });
    });

    it('skips the lookup for a session with no player', async () => {
      plexClient.getSessions.mockResolvedValue(
        sessionsResponse([session({ Player: undefined })]),
      );

      await service.getActiveSessions();
      expect(
        deviceTrackingService.findDeviceByIdentifier,
      ).not.toHaveBeenCalled();
    });

    it('passes an empty response through untouched', async () => {
      const empty = { MediaContainer: { size: 0 } } as PlexSessionsResponse;
      plexClient.getSessions.mockResolvedValue(empty);

      await expect(service.getActiveSessions()).resolves.toBe(empty);
    });

    it('propagates a failure from Plex', async () => {
      plexClient.getSessions.mockRejectedValue(new Error('unreachable'));

      await expect(service.getActiveSessions()).rejects.toThrow('unreachable');
    });
  });

  describe('media urls', () => {
    it('rewrites the thumbnail through the proxy', async () => {
      expect(await firstSession()).toMatchObject({
        thumbnailUrl: '/api/pg/plex/media/thumb/42?t=1700000000',
      });
    });

    it('rewrites the artwork through the proxy', async () => {
      expect(await firstSession()).toMatchObject({
        artUrl: '/api/pg/plex/media/art/42?t=1700000000',
      });
    });

    it('omits the timestamp when the path carries none', async () => {
      plexClient.getSessions.mockResolvedValue(
        sessionsResponse([session({ thumb: '/library/metadata/42/thumb' })]),
      );

      expect(await firstSession()).toMatchObject({
        thumbnailUrl: '/api/pg/plex/media/thumb/42',
      });
    });

    it('yields nothing for an empty path', async () => {
      plexClient.getSessions.mockResolvedValue(
        sessionsResponse([session({ thumb: '' })]),
      );

      const result = await firstSession();
      expect(result.thumbnailUrl).toBeUndefined();
    });

    it('yields nothing for a path it cannot parse', async () => {
      plexClient.getSessions.mockResolvedValue(
        sessionsResponse([session({ thumb: '/nonsense/path' })]),
      );

      expect(await firstSession()).toMatchObject({ thumbnailUrl: '' });
    });

    it('leaves the thumbnail out while thumbnails are disabled', async () => {
      settings.ENABLE_MEDIA_THUMBNAILS = false;

      const result = await firstSession();
      expect(result.thumbnailUrl).toBeUndefined();
      expect(result.artUrl).toBeDefined();
    });

    it('leaves the artwork out while artwork is disabled', async () => {
      settings.ENABLE_MEDIA_ARTWORK = false;

      const result = await firstSession();
      expect(result.artUrl).toBeUndefined();
      expect(result.thumbnailUrl).toBeDefined();
    });

    it('leaves both out for a session carrying neither', async () => {
      plexClient.getSessions.mockResolvedValue(
        sessionsResponse([session({ thumb: undefined, art: undefined })]),
      );

      const result = await firstSession();
      expect(result.thumbnailUrl).toBeUndefined();
      expect(result.artUrl).toBeUndefined();
    });
  });

  describe('getPlexWebUrl', () => {
    it('prefers a custom URL when one is set', async () => {
      settings.CUSTOM_PLEX_URL = '  https://plex.example.com  ';

      await expect(service.getPlexWebUrl()).resolves.toBe(
        'https://plex.example.com',
      );
    });

    it('ignores a custom URL that is only whitespace', async () => {
      settings.CUSTOM_PLEX_URL = '   ';

      await expect(service.getPlexWebUrl()).resolves.toBe(
        'http://10.0.0.5:32400',
      );
    });

    it('builds an http URL from the server settings', async () => {
      await expect(service.getPlexWebUrl()).resolves.toBe(
        'http://10.0.0.5:32400',
      );
    });

    it('builds an https URL when SSL is on', async () => {
      settings.USE_SSL = true;

      await expect(service.getPlexWebUrl()).resolves.toBe(
        'https://10.0.0.5:32400',
      );
    });

    it.each(['PLEX_SERVER_IP', 'PLEX_SERVER_PORT'] as const)(
      'refuses to guess with no %s',
      async (key) => {
        settings[key] = '';

        await expect(service.getPlexWebUrl()).rejects.toThrow(
          'Plex server IP and port not configured',
        );
      },
    );
  });

  describe('updateActiveSessions', () => {
    it('hands the fetched sessions to the orchestrator', async () => {
      await service.updateActiveSessions();

      expect(
        sessionOrchestratorService.orchestrateSessionUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ MediaContainer: expect.anything() }),
      );
    });

    it('returns whatever the orchestrator produced', async () => {
      const orchestrated = sessionsResponse([]);
      sessionOrchestratorService.orchestrateSessionUpdate.mockResolvedValue(
        orchestrated,
      );

      await expect(service.updateActiveSessions()).resolves.toBe(orchestrated);
    });

    it('propagates an orchestration failure', async () => {
      sessionOrchestratorService.orchestrateSessionUpdate.mockRejectedValue(
        new Error('terminate failed'),
      );

      await expect(service.updateActiveSessions()).rejects.toThrow(
        'terminate failed',
      );
    });
  });

  describe('getActiveSessionsWithMediaUrls', () => {
    it('reads from the stored sessions rather than Plex', async () => {
      await service.getActiveSessionsWithMediaUrls();

      expect(
        activeSessionService.getActiveSessionsFormatted,
      ).toHaveBeenCalled();
      expect(plexClient.getSessions).not.toHaveBeenCalled();
    });

    it('rewrites the media urls', async () => {
      const result = await service.getActiveSessionsWithMediaUrls();

      expect(result.MediaContainer?.Metadata?.[0]).toMatchObject({
        thumbnailUrl: '/api/pg/plex/media/thumb/42?t=1700000000',
      });
    });

    it('does not stamp a server identifier or stream count', async () => {
      const result = await service.getActiveSessionsWithMediaUrls();

      expect(
        result.MediaContainer?.Metadata?.[0].serverMachineIdentifier,
      ).toBeUndefined();
    });

    it('passes an empty response through untouched', async () => {
      const empty = { MediaContainer: { size: 0 } };
      activeSessionService.getActiveSessionsFormatted.mockResolvedValue(empty);

      await expect(service.getActiveSessionsWithMediaUrls()).resolves.toBe(
        empty,
      );
    });

    it('propagates a read failure', async () => {
      activeSessionService.getActiveSessionsFormatted.mockRejectedValue(
        new Error('db down'),
      );

      await expect(service.getActiveSessionsWithMediaUrls()).rejects.toThrow(
        'db down',
      );
    });
  });
});
