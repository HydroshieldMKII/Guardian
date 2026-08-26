import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { NotificationOrchestratorService } from '@/modules/notifications/services/notification-orchestrator.service';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { callArgs } from '@/test-matchers';

describe('ActiveSessionService', () => {
  let service: ActiveSessionService;
  let historyRepo: Record<string, jest.Mock>;
  let deviceRepo: { findOne: jest.Mock };
  let preferenceRepo: Record<string, jest.Mock>;
  let deviceTrackingService: { clearSessionKey: jest.Mock };
  let plexClient: { getServerIdentity: jest.Mock };
  let orchestrator: { linkOrphanedNotifications: jest.Mock };
  let builders: Record<string, jest.Mock>[];

  const newBuilder = () => {
    const builder: Record<string, jest.Mock> = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    for (const key of [
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'skip',
      'take',
      'update',
      'set',
    ]) {
      builder[key].mockReturnValue(builder);
    }
    builders.push(builder);
    return builder;
  };

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
    builders = [];

    historyRepo = {
      createQueryBuilder: jest.fn(() => newBuilder()),
      create: jest.fn((entity: Partial<SessionHistory>) =>
        Object.assign(new SessionHistory(), entity),
      ),
      save: jest.fn((entity: SessionHistory) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
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
      historyRepo.createQueryBuilder.mockImplementation(() => {
        const builder = newBuilder();
        builder.getOne.mockResolvedValue({ id: 1, ratingKey: '123' });
        return builder;
      });

      await service.updateActiveSessions(payload(plexSession()));

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
      historyRepo.createQueryBuilder.mockImplementationOnce(() => {
        const builder = newBuilder();
        builder.getMany.mockResolvedValue([{ sessionKey: 'sk-old' }]);
        return builder;
      });

      await service.updateActiveSessions(payload(plexSession()));

      expect(deviceTrackingService.clearSessionKey).toHaveBeenCalledWith(
        'sk-old',
      );
      const updateBuilder = builders[1];
      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ playerState: 'stopped' }),
      );
    });

    it('runs no update when nothing has ended', async () => {
      await service.updateActiveSessions(payload(plexSession()));
      expect(deviceTrackingService.clearSessionKey).not.toHaveBeenCalled();
    });

    it('rethrows when the sweep fails', async () => {
      historyRepo.createQueryBuilder.mockImplementation(() => {
        const builder = newBuilder();
        builder.getMany.mockRejectedValue(new Error('db down'));
        return builder;
      });

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
      historyRepo.createQueryBuilder.mockImplementation(() => {
        const builder = newBuilder();
        builder.getOne.mockResolvedValue({ id: 1, ratingKey });
        return builder;
      });
    };

    it('starts a new history row when the track changes', async () => {
      withExistingTrack('111');
      await service.updateActiveSessions(payload(plexampSession('222')));

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
      historyRepo.createQueryBuilder.mockImplementation(() => {
        const builder = newBuilder();
        builder.getMany.mockResolvedValue(rows);
        return builder;
      });
    };

    it('shapes the rows like a Plex sessions payload', async () => {
      listReturning(historyRow());

      const result = await service.getActiveSessionsFormatted();

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

  describe('getUserSessionHistory', () => {
    it('returns only completed sessions by default', async () => {
      await service.getUserSessionHistory('u1');

      const builder = builders[0];
      expect(builder.where).toHaveBeenCalledWith('session.userId = :userId', {
        userId: 'u1',
      });
      expect(builder.andWhere).toHaveBeenCalledWith(
        'session.endedAt IS NOT NULL',
      );
      expect(builder.take).toHaveBeenCalledWith(50);
    });

    it('includes running sessions when asked', async () => {
      await service.getUserSessionHistory('u1', {
        limit: 10,
        includeActive: true,
      });

      const builder = builders[0];
      expect(builder.andWhere).not.toHaveBeenCalled();
      expect(builder.take).toHaveBeenCalledWith(10);
    });

    it('pages from the requested offset', async () => {
      await service.getUserSessionHistory('u1', { limit: 25, offset: 50 });

      const builder = builders[0];
      expect(builder.skip).toHaveBeenCalledWith(50);
      expect(builder.take).toHaveBeenCalledWith(25);
    });

    it('starts at the first page by default', async () => {
      await service.getUserSessionHistory('u1');
      expect(builders[0].skip).toHaveBeenCalledWith(0);
    });

    it('narrows to terminated sessions when asked', async () => {
      await service.getUserSessionHistory('u1', { terminatedOnly: true });

      expect(builders[0].andWhere).toHaveBeenCalledWith(
        'session.terminated = :terminated',
        { terminated: true },
      );
    });

    it('matches the search term against titles, addresses and devices', async () => {
      await service.getUserSessionHistory('u1', { search: '  Ennemie ' });

      expect(builders[0].andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(session.contentTitle) LIKE :term'),
        { term: '%ennemie%' },
      );
    });

    it('ignores a blank search term', async () => {
      await service.getUserSessionHistory('u1', {
        includeActive: true,
        search: '   ',
      });

      expect(builders[0].andWhere).not.toHaveBeenCalled();
    });

    it('propagates a query failure', async () => {
      historyRepo.createQueryBuilder.mockImplementation(() => {
        const builder = newBuilder();
        builder.getMany.mockRejectedValue(new Error('db down'));
        return builder;
      });

      await expect(service.getUserSessionHistory('u1')).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('deleteSessionHistory', () => {
    it('deletes the row', async () => {
      await expect(service.deleteSessionHistory(4)).resolves.toBeUndefined();
      expect(historyRepo.delete).toHaveBeenCalledWith(4);
    });

    it('refuses when there is no such row', async () => {
      historyRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteSessionHistory(4)).rejects.toThrow(
        'Session history with ID 4 not found',
      );
    });

    it('propagates a delete failure', async () => {
      historyRepo.delete.mockRejectedValue(new Error('locked'));
      await expect(service.deleteSessionHistory(4)).rejects.toThrow('locked');
    });
  });
});
