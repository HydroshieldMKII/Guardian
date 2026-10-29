import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ENTITIES } from '@/database/database.options';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import {
  SessionHistoryApp,
  SessionHistoryQuery,
  SessionHistoryService,
} from '@/modules/sessions/services/session-history.service';
import type { Mock } from 'vitest';

describe('SessionHistoryService', () => {
  let service: SessionHistoryService;
  let historyRepo: Record<string, Mock>;
  let builders: Record<string, Mock>[];

  const newBuilder = () => {
    const builder: Record<string, Mock> = {
      leftJoinAndSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getMany: vi.fn().mockResolvedValue([]),
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

  beforeEach(async () => {
    builders = [];
    historyRepo = {
      createQueryBuilder: vi.fn(() => newBuilder()),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SessionHistoryService,
        { provide: getRepositoryToken(SessionHistory), useValue: historyRepo },
      ],
    }).compile();

    service = module.get(SessionHistoryService);
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
      const failure = service.deleteSessionHistory(4);
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      await expect(failure).rejects.toThrow(
        'Session history with ID 4 not found',
      );
    });

    it('propagates a delete failure', async () => {
      historyRepo.delete.mockRejectedValue(new Error('locked'));
      await expect(service.deleteSessionHistory(4)).rejects.toThrow('locked');
    });
  });
});

describe('SessionHistoryService on a database', () => {
  let dataSource: DataSource;
  let service: SessionHistoryService;

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
        SessionHistoryService,
        {
          provide: getRepositoryToken(SessionHistory),
          useValue: dataSource.getRepository(SessionHistory),
        },
      ],
    }).compile();

    service = module.get(SessionHistoryService);

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

  it('matches Plexamp on the session or device product', async () => {
    expect(await keys('plexamp')).toEqual([
      'device-product',
      'session-product',
    ]);
  });

  it('files a device only named like Plexamp under Plex', async () => {
    expect(await keys('plex')).toEqual([
      'device-name',
      'no-device',
      'plex-web',
    ]);
  });

  describe('markTerminated', () => {
    const save = (sessionKey: string, startedAt: string) =>
      dataSource.getRepository(SessionHistory).save({
        sessionKey,
        userId: 'u1',
        startedAt: new Date(startedAt),
      });
    const terminated = async (id: number) =>
      (await dataSource.getRepository(SessionHistory).findOneByOrFail({ id }))
        .terminated;

    it('marks only the latest play of that session key', async () => {
      const earlier = await save('reused', '2026-01-01T10:00:00Z');
      const latest = await save('reused', '2026-01-01T11:00:00Z');
      const other = await save('other', '2026-01-01T12:00:00Z');

      await service.markTerminated('reused');

      expect(await terminated(earlier.id)).toBe(false);
      expect(await terminated(latest.id)).toBe(true);
      expect(await terminated(other.id)).toBe(false);
    });

    it('does nothing for an unknown session key', async () => {
      await expect(service.markTerminated('missing')).resolves.toBeUndefined();
    });
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
