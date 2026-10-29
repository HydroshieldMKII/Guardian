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
import {
  ActiveSessionService,
  SessionHistoryApp,
  SessionHistoryQuery,
} from '@/modules/sessions/services/active-session.service';
import { anyDate, callArgs } from '@/test-matchers';

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
      getMany: jest.fn().mockResolvedValue([]),
    };
    for (const key of [
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'skip',
      'take',
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
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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
        { sessionKey: In(['sk-old']) },
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

  describe('getUserSessionHistory', () => {
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
      expect(builders[0].take).toHaveBeenCalledWith(50);
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

describe('ActiveSessionService history app filter', () => {
  let dataSource: DataSource;
  let service: ActiveSessionService;

  const device = (fields: Partial<UserDevice>) =>
    dataSource.getRepository(UserDevice).save({
      userId: 'u1',
      deviceIdentifier: `dev-${fields.deviceName}`,
      ...fields,
    });

  const session = async (
    sessionKey: string,
    product: string | null,
    userDevice?: UserDevice,
  ) => {
    await dataSource.getRepository(SessionHistory).save({
      sessionKey,
      userId: 'u1',
      product,
      userDeviceId: userDevice?.id ?? null,
      endedAt: new Date(),
    });
  };

  const historyKeys = async (query: SessionHistoryQuery = {}) =>
    (await service.getUserSessionHistory('u1', query))
      .map((entry) => entry.sessionKey)
      .sort();

  const keys = (app: SessionHistoryApp) => historyKeys({ app });

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
        { provide: DeviceTrackingService, useValue: {} },
        { provide: PlexClient, useValue: {} },
        { provide: NotificationOrchestratorService, useValue: {} },
      ],
    }).compile();

    service = module.get(ActiveSessionService);

    const plexWeb = await device({
      deviceName: 'Chrome',
      deviceProduct: 'Plex Web',
    });
    const plexampProduct = await device({
      deviceName: 'Phone',
      deviceProduct: 'Plexamp',
    });
    const plexampName = await device({
      deviceName: 'PLEXAMP kitchen',
      deviceProduct: null,
    });

    await session('session-product', 'Plexamp');
    await session('device-product', null, plexampProduct);
    await session('device-name', 'Plex for Android', plexampName);
    await session('plex-web', 'Plex Web', plexWeb);
    await session('no-device', null);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('matches Plexamp on the session product, device product or device name', async () => {
    expect(await keys('plexamp')).toEqual([
      'device-name',
      'device-product',
      'session-product',
    ]);
  });

  it('keeps sessions without a product or device when only Plex is asked for', async () => {
    expect(await keys('plex')).toEqual(['no-device', 'plex-web']);
  });

  describe('getUserSessionHistory', () => {
    const history = (sessionKey: string, fields: Partial<SessionHistory>) =>
      dataSource.getRepository(SessionHistory).save({
        sessionKey,
        userId: 'u1',
        endedAt: new Date(),
        ...fields,
      });

    beforeEach(async () => {
      await dataSource.getRepository(UserPreference).save({ userId: 'u2' });
    });

    it('returns only completed sessions by default', async () => {
      await history('running', { endedAt: null });
      await history('other-user', { userId: 'u2' });

      expect(await historyKeys()).toEqual([
        'device-name',
        'device-product',
        'no-device',
        'plex-web',
        'session-product',
      ]);
    });

    it('narrows to terminated sessions when asked', async () => {
      await history('terminated', { terminated: true });
      await history('terminated-running', { terminated: true, endedAt: null });
      await history('other-user-terminated', {
        userId: 'u2',
        terminated: true,
      });

      expect(await historyKeys({ terminatedOnly: true })).toEqual([
        'terminated',
      ]);
    });

    it('matches the search term against titles, addresses and devices', async () => {
      const namedDevice = await device({
        deviceName: 'Matrix TV',
        deviceProduct: 'Plex Web',
      });
      const productDevice = await device({
        deviceName: 'Den',
        deviceProduct: 'Matrix Player',
      });

      await history('by-title', { contentTitle: 'The Matrix' });
      await history('by-grandparent', {
        contentTitle: 'Pilot',
        grandparentTitle: 'Matrix Stories',
      });
      await history('by-parent', { parentTitle: 'Matrix Season 1' });
      await history('by-address', { deviceAddress: 'matrix.lan' });
      await history('by-device-name', { userDeviceId: namedDevice.id });
      await history('by-device-product', { userDeviceId: productDevice.id });
      await history('unrelated', { contentTitle: 'Inception' });
      await history('running-match', {
        contentTitle: 'The Matrix',
        endedAt: null,
      });
      await history('other-user-match', {
        userId: 'u2',
        contentTitle: 'The Matrix',
      });

      expect(await historyKeys({ search: '  mAtRiX ' })).toEqual([
        'by-address',
        'by-device-name',
        'by-device-product',
        'by-grandparent',
        'by-parent',
        'by-title',
      ]);
    });
  });
});
