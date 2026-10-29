import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { ENTITIES } from '@/database/database.options';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { NotificationOrchestratorService } from '@/modules/notifications/services/notification-orchestrator.service';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { anyDate, callArgs } from '@/test-matchers';

describe('ActiveSessionService', () => {
  let service: ActiveSessionService;
  let historyRepo: Record<string, jest.Mock>;
  let deviceRepo: { findOne: jest.Mock };
  let preferenceRepo: Record<string, jest.Mock>;
  let deviceTrackingService: { clearSessionKey: jest.Mock };
  let plexClient: { getServerIdentity: jest.Mock };
  let orchestrator: { linkOrphanedNotifications: jest.Mock };

  const plexSession = (overrides: Record<string, unknown> = {}) => ({
    sessionKey: 'sk-1',
    User: { id: 'u1', title: 'testuser' },
    Player: {
      machineIdentifier: 'dev-1',
      product: 'Plex for Android',
      address: '10.0.0.5',
      state: 'playing',
    },
    Media: [
      {
        videoResolution: '1080',
        bitrate: 8000,
        container: 'mkv',
        videoCodec: 'h264',
        audioCodec: 'aac',
      },
    ],
    Session: { id: 'session-1', bandwidth: 12000, location: 'lan' },
    title: 'The Matrix',
    type: 'movie',
    year: 1999,
    duration: 8160000,
    viewOffset: 60000,
    thumb: '/thumb',
    art: '/art',
    ratingKey: '123',
    ...overrides,
  });

  const payload = (...sessions: Record<string, unknown>[]) => ({
    MediaContainer: { size: sessions.length, Metadata: sessions },
  });

  const savedSession = (call = 0) =>
    callArgs<[Record<string, unknown>]>(historyRepo.create, call)[0];

  beforeEach(async () => {
    historyRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((entity: Partial<SessionHistory>) =>
        Object.assign(new SessionHistory(), entity),
      ),
      save: jest.fn((entity: SessionHistory) => Promise.resolve(entity)),
    };

    deviceRepo = { findOne: jest.fn().mockResolvedValue({ id: 7 }) };

    preferenceRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 3, userId: 'u1' }),
      create: jest.fn((entity: Partial<UserPreference>) =>
        Object.assign(new UserPreference(), entity),
      ),
      save: jest.fn((entity: UserPreference) => Promise.resolve(entity)),
    };

    deviceTrackingService = {
      clearSessionKey: jest.fn().mockResolvedValue(undefined),
    };
    plexClient = {
      getServerIdentity: jest.fn().mockResolvedValue('server-uuid'),
    };
    orchestrator = {
      linkOrphanedNotifications: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ActiveSessionService,
        { provide: getRepositoryToken(SessionHistory), useValue: historyRepo },
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepo,
        },
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
        { provide: PlexClient, useValue: plexClient },
        {
          provide: NotificationOrchestratorService,
          useValue: orchestrator,
        },
      ],
    }).compile();

    service = module.get(ActiveSessionService);
  });

  describe('updateActiveSessions', () => {
    it.each([
      ['a null payload', null],
      ['a payload with no container', {}],
      ['a container with no metadata', { MediaContainer: {} }],
    ])('tolerates %s', async (_label, data) => {
      await expect(service.updateActiveSessions(data)).resolves.toBeUndefined();
    });

    it('creates a history row for a session it has not seen', async () => {
      await service.updateActiveSessions(payload(plexSession()));

      expect(savedSession()).toMatchObject({
        sessionKey: 'sk-1',
        userId: 'u1',
        userDeviceId: 7,
        deviceAddress: '10.0.0.5',
        playerState: 'playing',
        contentTitle: 'The Matrix',
        contentType: 'movie',
        year: 1999,
        videoResolution: '1080',
        bandwidth: 12000,
        sessionLocation: 'lan',
      });
    });

    it('carries the episode titles and rating keys of a TV session', async () => {
      await service.updateActiveSessions(
        payload(
          plexSession({
            type: 'episode',
            grandparentTitle: 'The Expanse',
            parentTitle: 'Season 1',
            parentRatingKey: '99',
          }),
        ),
      );

      expect(savedSession()).toMatchObject({
        grandparentTitle: 'The Expanse',
        parentTitle: 'Season 1',
        parentRatingKey: '99',
      });
    });

    it('omits every column Plex reported nothing for', async () => {
      await service.updateActiveSessions(
        payload({
          sessionKey: 'sk-1',
          User: { id: 'u1', title: 'testuser' },
          Player: { machineIdentifier: 'dev-1' },
        }),
      );

      const saved = savedSession();
      for (const column of [
        'contentTitle',
        'contentType',
        'grandparentTitle',
        'parentTitle',
        'art',
        'ratingKey',
        'parentRatingKey',
        'deviceAddress',
        'playerState',
        'product',
      ]) {
        expect(saved).not.toHaveProperty(column);
      }
    });

    it('links any orphaned notifications to a brand new session', async () => {
      await service.updateActiveSessions(payload(plexSession()));
      expect(orchestrator.linkOrphanedNotifications).toHaveBeenCalledWith(
        'sk-1',
      );
    });

    it('updates rather than recreates a session already running', async () => {
      historyRepo.findOne.mockResolvedValue({ id: 1, ratingKey: '123' });

      await service.updateActiveSessions(payload(plexSession()));

      expect(historyRepo.findOne).toHaveBeenCalledWith({
        where: { sessionKey: 'sk-1', endedAt: IsNull() },
      });
      expect(
        callArgs<[Record<string, unknown>, Record<string, unknown>]>(
          historyRepo.update,
        )[0],
      ).toEqual({ sessionKey: 'sk-1', endedAt: IsNull() });
      expect(historyRepo.save).not.toHaveBeenCalled();
      expect(orchestrator.linkOrphanedNotifications).not.toHaveBeenCalled();
    });

    it('omits fields Plex did not send', async () => {
      await service.updateActiveSessions(
        payload({ sessionKey: 'sk-1', User: { id: 'u1' } }),
      );

      expect(savedSession()).not.toHaveProperty('contentTitle');
      expect(savedSession()).not.toHaveProperty('bitrate');
    });

    it('keeps a zero view offset', async () => {
      await service.updateActiveSessions(
        payload(plexSession({ viewOffset: 0 })),
      );
      expect(savedSession().viewOffset).toBe(0);
    });

    it('falls back to the parent year for an episode', async () => {
      await service.updateActiveSessions(
        payload(plexSession({ year: undefined, parentYear: 2015 })),
      );
      expect(savedSession().year).toBe(2015);
    });

    it('skips a session with no session key', async () => {
      await service.updateActiveSessions(payload({ User: { id: 'u1' } }));
      expect(historyRepo.save).not.toHaveBeenCalled();
    });

    it('creates a preference row for a user it has never seen', async () => {
      preferenceRepo.findOne.mockResolvedValue(null);

      await service.updateActiveSessions(payload(plexSession()));

      expect(preferenceRepo.create).toHaveBeenCalledWith({
        userId: 'u1',
        username: 'testuser',
        defaultBlock: null,
        hidden: false,
      });
    });

    it('does not invent a preference row without a username', async () => {
      preferenceRepo.findOne.mockResolvedValue(null);

      await service.updateActiveSessions(
        payload(plexSession({ User: { id: 'u1' } })),
      );

      expect(preferenceRepo.save).not.toHaveBeenCalled();
    });

    it('does not look up a device when Plex identified neither side', async () => {
      await service.updateActiveSessions(
        payload({ sessionKey: 'sk-1', Player: {} }),
      );
      expect(deviceRepo.findOne).not.toHaveBeenCalled();
    });

    it('closes out sessions that are no longer running', async () => {
      historyRepo.find.mockResolvedValueOnce([{ sessionKey: 'sk-old' }]);

      await service.updateActiveSessions(payload(plexSession()));

      expect(historyRepo.find).toHaveBeenCalledWith({
        where: { sessionKey: Not(In(['sk-1'])), endedAt: IsNull() },
      });
      expect(historyRepo.update).toHaveBeenCalledWith(
        { sessionKey: In(['sk-old']), endedAt: IsNull() },
        { endedAt: anyDate(), playerState: 'stopped' },
      );
      expect(deviceTrackingService.clearSessionKey).toHaveBeenCalledWith(
        'sk-old',
      );
    });

    it('runs no update when nothing has ended', async () => {
      await service.updateActiveSessions(payload(plexSession()));
      expect(historyRepo.update).not.toHaveBeenCalled();
      expect(deviceTrackingService.clearSessionKey).not.toHaveBeenCalled();
    });

    it('rethrows when the sweep fails', async () => {
      historyRepo.find.mockRejectedValue(new Error('db down'));

      await expect(
        service.updateActiveSessions(payload(plexSession())),
      ).rejects.toThrow('db down');
    });

    it('swallows a failure upserting one session', async () => {
      historyRepo.save.mockRejectedValue(new Error('constraint'));
      await expect(
        service.updateActiveSessions(payload(plexSession())),
      ).resolves.toBeUndefined();
    });
  });

  describe('Plexamp detection', () => {
    it('treats a session with no product as not Plexamp', async () => {
      await service.updateActiveSessions(
        payload({
          sessionKey: 'sk-1',
          User: { id: 'u1', title: 'testuser' },
          Player: { machineIdentifier: 'dev-1' },
        }),
      );

      expect(savedSession()).toBeDefined();
    });
  });

  describe('Plexamp track changes', () => {
    const plexampSession = (ratingKey: string) =>
      plexSession({
        ratingKey,
        Player: { machineIdentifier: 'dev-1', product: 'Plexamp' },
      });

    const withExistingTrack = (ratingKey: string) => {
      historyRepo.findOne.mockResolvedValue({ id: 1, ratingKey });
    };

    it('starts a new history row when the track changes', async () => {
      withExistingTrack('111');
      await service.updateActiveSessions(payload(plexampSession('222')));

      expect(historyRepo.update).toHaveBeenCalledWith(1, {
        endedAt: anyDate(),
        playerState: 'stopped',
      });
      expect(historyRepo.save).toHaveBeenCalled();
      expect(savedSession().ratingKey).toBe('222');
    });

    it('keeps the same row while the track plays on', async () => {
      withExistingTrack('111');
      await service.updateActiveSessions(payload(plexampSession('111')));

      expect(historyRepo.save).not.toHaveBeenCalled();
    });

    it('does not split a non-Plexamp session on a track change', async () => {
      withExistingTrack('111');
      await service.updateActiveSessions(
        payload(plexSession({ ratingKey: '222' })),
      );

      expect(historyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getActiveSessionsFormatted', () => {
    const historyRow = (overrides: Partial<SessionHistory> = {}) =>
      Object.assign(new SessionHistory(), {
        sessionKey: 'sk-1',
        userId: 'u1',
        deviceAddress: '10.0.0.5',
        playerState: 'playing',
        contentTitle: 'The Matrix',
        contentType: 'movie',
        videoResolution: '1080',
        bitrate: 8000,
        container: 'mkv',
        bandwidth: 12000,
        sessionLocation: 'lan',
        userPreference: { username: 'testuser' },
        userDevice: {
          deviceIdentifier: 'dev-1',
          devicePlatform: 'Android',
          deviceProduct: 'Plex for Android',
          deviceName: 'Living Room TV',
          sessionCount: 4,
        },
        ...overrides,
      });

    const listReturning = (...rows: SessionHistory[]) => {
      historyRepo.find.mockResolvedValue(rows);
    };

    it('shapes the rows like a Plex sessions payload', async () => {
      listReturning(historyRow());

      const result = await service.getActiveSessionsFormatted();

      expect(historyRepo.find).toHaveBeenCalledWith({
        where: { endedAt: IsNull() },
        relations: { userDevice: true, userPreference: true },
        order: { startedAt: 'DESC' },
      });
      expect(result.MediaContainer?.size).toBe(1);
      expect(result.MediaContainer?.Metadata?.[0]).toMatchObject({
        sessionKey: 'sk-1',
        User: { id: 'u1', title: 'testuser' },
        Player: {
          machineIdentifier: 'dev-1',
          title: 'Living Room TV',
          address: '10.0.0.5',
        },
        Session: { id: 'sk-1', bandwidth: 12000, sessionCount: 4 },
        serverMachineIdentifier: 'server-uuid',
      });
    });

    it('includes the media details when there are any', async () => {
      listReturning(historyRow());

      const result = await service.getActiveSessionsFormatted();
      expect(result.MediaContainer?.Metadata?.[0].Media).toEqual([
        {
          videoResolution: '1080',
          bitrate: 8000,
          container: 'mkv',
          videoCodec: undefined,
          audioCodec: undefined,
        },
      ]);
    });

    it('omits the media block when there are no details', async () => {
      listReturning(
        historyRow({
          videoResolution: null,
          bitrate: null,
          container: null,
        }),
      );

      const result = await service.getActiveSessionsFormatted();
      expect(result.MediaContainer?.Metadata?.[0].Media).toEqual([]);
    });

    it('substitutes placeholders for a session with no device or preference', async () => {
      listReturning(historyRow({ userDevice: null, userPreference: null }));

      const result = await service.getActiveSessionsFormatted();
      expect(result.MediaContainer?.Metadata?.[0]).toMatchObject({
        User: { title: 'Unknown User' },
        Player: {
          machineIdentifier: 'Unknown',
          platform: 'Unknown',
          title: 'Unknown Device',
        },
        Session: { sessionCount: 0 },
      });
    });

    it('falls back to the product when the device has no name', async () => {
      listReturning(
        historyRow({
          userDevice: {
            deviceProduct: 'Plex for Android',
            deviceIdentifier: 'dev-1',
          },
        } as Partial<SessionHistory>),
      );

      const result = await service.getActiveSessionsFormatted();
      expect(result.MediaContainer?.Metadata?.[0].Player?.title).toBe(
        'Plex for Android',
      );
    });

    it('returns an empty container when nothing is streaming', async () => {
      const result = await service.getActiveSessionsFormatted();
      expect(result.MediaContainer).toEqual({ size: 0, Metadata: [] });
    });

    it('propagates a failure reaching Plex', async () => {
      plexClient.getServerIdentity.mockRejectedValue(new Error('offline'));
      await expect(service.getActiveSessionsFormatted()).rejects.toThrow(
        'offline',
      );
    });
  });
});

describe('ActiveSessionService on a database', () => {
  let dataSource: DataSource;
  let service: ActiveSessionService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: ENTITIES,
      synchronize: true,
    });
    await dataSource.initialize();
    await dataSource.getRepository(UserPreference).save({ userId: 'u1' });

    const module = await Test.createTestingModule({
      providers: [
        ActiveSessionService,
        {
          provide: getRepositoryToken(SessionHistory),
          useValue: dataSource.getRepository(SessionHistory),
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: dataSource.getRepository(UserDevice),
        },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: dataSource.getRepository(UserPreference),
        },
        {
          provide: DeviceTrackingService,
          useValue: { clearSessionKey: jest.fn() },
        },
        { provide: PlexClient, useValue: {} },
        { provide: NotificationOrchestratorService, useValue: {} },
      ],
    }).compile();

    service = module.get(ActiveSessionService);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe('updateActiveSessions', () => {
    it('leaves an earlier session that reused the key as it ended', async () => {
      const repository = dataSource.getRepository(SessionHistory);
      const earlierEnd = new Date('2026-01-01T10:00:00Z');
      const earlier = await repository.save({
        sessionKey: '7',
        userId: 'u1',
        endedAt: earlierEnd,
        playerState: 'paused',
      });
      const current = await repository.save({
        sessionKey: '7',
        userId: 'u1',
        endedAt: null,
        playerState: 'playing',
      });

      await service.updateActiveSessions({
        MediaContainer: { size: 0, Metadata: [] },
      });

      const [earlierAfter, currentAfter] = await Promise.all([
        repository.findOneByOrFail({ id: earlier.id }),
        repository.findOneByOrFail({ id: current.id }),
      ]);
      expect(earlierAfter.endedAt).toEqual(earlierEnd);
      expect(earlierAfter.playerState).toBe('paused');
      expect(currentAfter.endedAt).toBeInstanceOf(Date);
      expect(currentAfter.playerState).toBe('stopped');
    });
  });
});
