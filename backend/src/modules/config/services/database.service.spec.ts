import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { Notification } from '@/entities/notification.entity';
import { DatabaseService, ExportData } from './database.service';
import type { Mock } from 'vitest';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let settingsRepo: Record<string, Mock>;
  let deviceRepo: Record<string, Mock>;
  let preferenceRepo: Record<string, Mock>;
  let repos: Map<unknown, Record<string, Mock>>;
  let cleared: unknown[];
  let transaction: Mock;
  let updateBuilder: Record<string, Mock>;

  const clearableRepo = (token: unknown) => ({
    clear: vi.fn(() => {
      cleared.push(token);
      return Promise.resolve();
    }),
    count: vi.fn().mockResolvedValue(0),
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    cleared = [];

    updateBuilder = {
      update: vi.fn(),
      set: vi.fn(),
      execute: vi.fn().mockResolvedValue({ affected: 3 }),
    };
    updateBuilder.update.mockReturnValue(updateBuilder);
    updateBuilder.set.mockReturnValue(updateBuilder);

    deviceRepo = {
      ...clearableRepo(UserDevice),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((entity: Partial<UserDevice>) => entity),
      save: vi.fn((entity: Partial<UserDevice>) => Promise.resolve(entity)),
      count: vi.fn().mockResolvedValue(7),
      createQueryBuilder: vi.fn(() => updateBuilder),
    };

    preferenceRepo = {
      ...clearableRepo(UserPreference),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((entity: Partial<UserPreference>) => entity),
      save: vi.fn((entity: Partial<UserPreference>) => Promise.resolve(entity)),
    };

    repos = new Map<unknown, Record<string, Mock>>([
      [UserDevice, deviceRepo],
      [UserPreference, preferenceRepo],
      [
        SessionHistory,
        {
          ...clearableRepo(SessionHistory),
          count: vi.fn().mockResolvedValue(42),
        },
      ],
      [Notification, clearableRepo(Notification)],
      [AppSettings, clearableRepo(AppSettings)],
      ['sessions', clearableRepo('sessions')],
      ['admin_users', clearableRepo('admin_users')],
    ]);

    const getRepository = vi.fn((token: unknown) => {
      const repo = repos.get(token);
      if (!repo)
        throw new Error(`no repository registered for ${String(token)}`);
      return repo;
    });

    transaction = vi.fn(
      async (run: (manager: { getRepository: Mock }) => Promise<void>) =>
        run({ getRepository }),
    );

    settingsRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn((entity: AppSettings) => Promise.resolve(entity)),
      manager: Object.assign(vi.fn(), { getRepository, transaction }),
    };
    settingsRepo.manager = { getRepository, transaction } as never;

    const module = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: getRepositoryToken(AppSettings), useValue: settingsRepo },
      ],
    }).compile();

    service = module.get(DatabaseService);
  });

  describe('exportDatabase', () => {
    const parsed = async (): Promise<ExportData> =>
      JSON.parse(await service.exportDatabase('1.3.5')) as ExportData;

    it('stamps the export with the app version', async () => {
      expect((await parsed()).version).toBe('1.3.5');
    });

    it('stamps the export with an ISO timestamp', async () => {
      expect((await parsed()).exportedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
      );
    });

    it('carries settings, devices and preferences', async () => {
      settingsRepo.find.mockResolvedValue([{ key: 'DEFAULT_PAGE' }]);
      deviceRepo.find.mockResolvedValue([{ deviceIdentifier: 'dev-1' }]);
      preferenceRepo.find.mockResolvedValue([{ userId: 'u1' }]);

      expect((await parsed()).data).toEqual({
        settings: [{ key: 'DEFAULT_PAGE' }],
        userDevices: [{ deviceIdentifier: 'dev-1' }],
        userPreferences: [{ userId: 'u1' }],
      });
    });

    it('never exports sessions or admin users', async () => {
      const keys = Object.keys((await parsed()).data);

      expect(keys).not.toContain('sessions');
      expect(keys).not.toContain('adminUsers');
    });

    it('writes indented json', async () => {
      expect(await service.exportDatabase('1.3.5')).toContain('\n  ');
    });

    it('reports a read failure without leaking the cause', async () => {
      settingsRepo.find.mockRejectedValue(new Error('disk on fire'));

      await expect(service.exportDatabase('1.3.5')).rejects.toThrow(
        'Failed to export database',
      );
    });
  });

  describe('resetDatabase', () => {
    it('clears every table in one transaction', async () => {
      await service.resetDatabase();

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(cleared).toEqual([
        SessionHistory,
        Notification,
        UserPreference,
        UserDevice,
        AppSettings,
        'sessions',
        'admin_users',
      ]);
    });

    it('clears history before the devices it points at', async () => {
      await service.resetDatabase();

      expect(cleared.indexOf(SessionHistory)).toBeLessThan(
        cleared.indexOf(UserDevice),
      );
    });

    it('reports a failure with its cause', async () => {
      transaction.mockRejectedValue(new Error('locked'));

      await expect(service.resetDatabase()).rejects.toThrow(
        'Database reset failed: locked',
      );
    });
  });

  describe('resetStreamCounts', () => {
    it('zeroes the counter and drops the current session key', async () => {
      await service.resetStreamCounts();

      expect(updateBuilder.set).toHaveBeenCalledWith({
        sessionCount: 0,
        currentSessionKey: null,
      });
    });

    it('leaves every other table alone', async () => {
      await service.resetStreamCounts();
      expect(cleared).toEqual([]);
    });

    it('reports a failure with its cause', async () => {
      updateBuilder.execute.mockRejectedValue(new Error('locked'));

      await expect(service.resetStreamCounts()).rejects.toThrow(
        'Stream count reset failed: locked',
      );
    });

    it('reports a non-Error failure by its text', async () => {
      updateBuilder.execute.mockRejectedValue('disk full');

      await expect(service.resetStreamCounts()).rejects.toThrow(
        'Stream count reset failed: disk full',
      );
    });

    it('tolerates a driver that does not report affected rows', async () => {
      updateBuilder.execute.mockResolvedValue({});

      await expect(service.resetStreamCounts()).resolves.toBeUndefined();
    });
  });

  describe('deleteAllDevices', () => {
    it('clears devices along with the rows that reference them', async () => {
      await service.deleteAllDevices();

      expect(cleared).toEqual([SessionHistory, Notification, UserDevice]);
    });

    it('leaves settings and admin users intact', async () => {
      await service.deleteAllDevices();

      expect(cleared).not.toContain(AppSettings);
      expect(cleared).not.toContain('admin_users');
    });

    it('counts the devices before deleting them', async () => {
      await service.deleteAllDevices();

      expect(deviceRepo.count.mock.invocationCallOrder[0]).toBeLessThan(
        transaction.mock.invocationCallOrder[0],
      );
    });

    it('reports a failure with its cause', async () => {
      transaction.mockRejectedValue(new Error('locked'));

      await expect(service.deleteAllDevices()).rejects.toThrow(
        'Device deletion failed: locked',
      );
    });
  });

  describe('clearAllSessionHistory', () => {
    it('clears only the history table', async () => {
      await service.clearAllSessionHistory();

      expect(cleared).toEqual([SessionHistory]);
    });

    it('reports a failure with its cause', async () => {
      transaction.mockRejectedValue(new Error('locked'));

      await expect(service.clearAllSessionHistory()).rejects.toThrow(
        'Session history clearing failed: locked',
      );
    });
  });
});
