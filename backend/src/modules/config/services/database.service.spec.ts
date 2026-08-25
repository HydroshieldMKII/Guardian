import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { Notification } from '@/entities/notification.entity';
import { DatabaseService, ExportData, ImportPayload } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let settingsRepo: Record<string, jest.Mock>;
  let deviceRepo: Record<string, jest.Mock>;
  let preferenceRepo: Record<string, jest.Mock>;
  let repos: Map<unknown, Record<string, jest.Mock>>;
  let cleared: unknown[];
  let transaction: jest.Mock;
  let updateBuilder: Record<string, jest.Mock>;

  const compareVersions = (a: string, b: string) =>
    a === b ? 0 : a < b ? -1 : 1;

  const clearableRepo = (token: unknown) => ({
    clear: jest.fn(() => {
      cleared.push(token);
      return Promise.resolve();
    }),
    count: jest.fn().mockResolvedValue(0),
  });

  const importing = (payload: ImportPayload) =>
    service.importDatabase(payload, '1.3.5', compareVersions);

  beforeEach(async () => {
    jest.clearAllMocks();
    cleared = [];

    updateBuilder = {
      update: jest.fn(),
      set: jest.fn(),
      execute: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    updateBuilder.update.mockReturnValue(updateBuilder);
    updateBuilder.set.mockReturnValue(updateBuilder);

    deviceRepo = {
      ...clearableRepo(UserDevice),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity: Partial<UserDevice>) => entity),
      save: jest.fn((entity: Partial<UserDevice>) => Promise.resolve(entity)),
      count: jest.fn().mockResolvedValue(7),
      createQueryBuilder: jest.fn(() => updateBuilder),
    };

    preferenceRepo = {
      ...clearableRepo(UserPreference),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity: Partial<UserPreference>) => entity),
      save: jest.fn((entity: Partial<UserPreference>) =>
        Promise.resolve(entity),
      ),
    };

    repos = new Map<unknown, Record<string, jest.Mock>>([
      [UserDevice, deviceRepo],
      [UserPreference, preferenceRepo],
      [
        SessionHistory,
        {
          ...clearableRepo(SessionHistory),
          count: jest.fn().mockResolvedValue(42),
        },
      ],
      [Notification, clearableRepo(Notification)],
      [AppSettings, clearableRepo(AppSettings)],
      ['sessions', clearableRepo('sessions')],
      ['admin_users', clearableRepo('admin_users')],
    ]);

    const getRepository = jest.fn((token: unknown) => {
      const repo = repos.get(token);
      if (!repo)
        throw new Error(`no repository registered for ${String(token)}`);
      return repo;
    });

    transaction = jest.fn(
      async (run: (manager: { getRepository: jest.Mock }) => Promise<void>) =>
        run({ getRepository }),
    );

    settingsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((entity: AppSettings) => Promise.resolve(entity)),
      manager: Object.assign(jest.fn(), { getRepository, transaction }),
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

  describe('importDatabase', () => {
    it.each([
      ['nothing', null],
      ['an empty object', {}],
      ['a payload with no data key', { version: '1' }],
    ])('rejects %s', async (_label, payload) => {
      await expect(
        service.importDatabase(
          payload as ImportPayload,
          '1.3.5',
          compareVersions,
        ),
      ).rejects.toThrow('Invalid import data format');
    });

    it('accepts a payload with an empty data block', async () => {
      await expect(importing({ data: {} })).resolves.toEqual({
        imported: 0,
        skipped: 0,
      });
    });

    it('sums the counts across all three collections', async () => {
      settingsRepo.findOne.mockResolvedValue({ key: 'DEFAULT_PAGE' });

      await expect(
        importing({
          data: {
            settings: [{ key: 'DEFAULT_PAGE', value: 'streams' }],
            userDevices: [{ deviceIdentifier: 'dev-1', userId: 'u1' }],
            userPreferences: [{ userId: 'u1' }],
          },
        }),
      ).resolves.toEqual({ imported: 3, skipped: 0 });
    });
  });

  describe('importing settings', () => {
    const importSettings = (settings: { key: string; value: string }[]) =>
      importing({ data: { settings } });

    it('overwrites a setting that already exists', async () => {
      const existing = { key: 'DEFAULT_PAGE', value: 'devices' };
      settingsRepo.findOne.mockResolvedValue(existing);

      await importSettings([{ key: 'DEFAULT_PAGE', value: 'streams' }]);

      expect(settingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'streams' }),
      );
    });

    it('skips a key this build does not declare', async () => {
      await expect(
        importSettings([{ key: 'RETIRED_SETTING', value: 'x' }]),
      ).resolves.toEqual({ imported: 0, skipped: 1 });
      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('refuses to downgrade APP_VERSION', async () => {
      settingsRepo.findOne.mockResolvedValue({ key: 'APP_VERSION' });

      await expect(
        importSettings([{ key: 'APP_VERSION', value: '1.0.0' }]),
      ).resolves.toEqual({ imported: 0, skipped: 1 });
      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('accepts an APP_VERSION at or above the current one', async () => {
      settingsRepo.findOne.mockResolvedValue({ key: 'APP_VERSION' });

      await expect(
        importSettings([{ key: 'APP_VERSION', value: '1.3.5' }]),
      ).resolves.toEqual({ imported: 1, skipped: 0 });
    });

    it('counts a write failure as skipped and keeps going', async () => {
      settingsRepo.findOne.mockResolvedValue({ key: 'DEFAULT_PAGE' });
      settingsRepo.save
        .mockRejectedValueOnce(new Error('locked'))
        .mockResolvedValueOnce({});

      await expect(
        importSettings([
          { key: 'DEFAULT_PAGE', value: 'streams' },
          { key: 'TIMEZONE', value: 'UTC' },
        ]),
      ).resolves.toEqual({ imported: 1, skipped: 1 });
    });
  });

  describe('importing devices', () => {
    const importDevices = (devices: Partial<UserDevice>[]) =>
      importing({ data: { userDevices: devices } });

    it('creates a device that is not on file', async () => {
      await expect(
        importDevices([{ deviceIdentifier: 'dev-1', userId: 'u1' }]),
      ).resolves.toEqual({ imported: 1, skipped: 0 });
      expect(deviceRepo.create).toHaveBeenCalled();
    });

    it('matches an existing device on user and identifier', async () => {
      await importDevices([{ deviceIdentifier: 'dev-1', userId: 'u1' }]);

      expect(deviceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: 'dev-1' },
      });
    });

    it('merges into a device that already exists', async () => {
      const existing = {
        deviceIdentifier: 'dev-1',
        userId: 'u1',
        status: 'pending',
      };
      deviceRepo.findOne.mockResolvedValue(existing);

      await importDevices([
        { deviceIdentifier: 'dev-1', userId: 'u1', status: 'approved' },
      ]);

      expect(deviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      );
      expect(deviceRepo.create).not.toHaveBeenCalled();
    });

    it('counts a failure as skipped and keeps going', async () => {
      deviceRepo.save
        .mockRejectedValueOnce(new Error('constraint'))
        .mockResolvedValueOnce({});

      await expect(
        importDevices([
          { deviceIdentifier: 'dev-1', userId: 'u1' },
          { deviceIdentifier: 'dev-2', userId: 'u1' },
        ]),
      ).resolves.toEqual({ imported: 1, skipped: 1 });
    });
  });

  describe('importing preferences', () => {
    const importPreferences = (preferences: Partial<UserPreference>[]) =>
      importing({ data: { userPreferences: preferences } });

    it('creates a preference that is not on file', async () => {
      await expect(
        importPreferences([{ userId: 'u1', defaultBlock: true }]),
      ).resolves.toEqual({ imported: 1, skipped: 0 });
      expect(preferenceRepo.create).toHaveBeenCalled();
    });

    it('overwrites the block policy on an existing preference', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        userId: 'u1',
        defaultBlock: false,
        username: 'vincent',
      });

      await importPreferences([{ userId: 'u1', defaultBlock: true }]);

      expect(preferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBlock: true }),
      );
    });

    it('keeps the stored username when the import omits one', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        userId: 'u1',
        username: 'vincent',
      });

      await importPreferences([{ userId: 'u1', defaultBlock: null }]);

      expect(preferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'vincent' }),
      );
    });

    it('reads an absent block policy as the global default', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });

      await importPreferences([{ userId: 'u1' }]);

      expect(preferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBlock: null }),
      );
    });

    it('counts a failure as skipped', async () => {
      preferenceRepo.save.mockRejectedValue(new Error('locked'));

      await expect(importPreferences([{ userId: 'u1' }])).resolves.toEqual({
        imported: 0,
        skipped: 1,
      });
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

      const [applied] = updateBuilder.set.mock.calls[0] as [
        { sessionCount: number; currentSessionKey: () => string },
      ];
      expect(applied.sessionCount).toBe(0);
      expect(applied.currentSessionKey()).toBe('NULL');
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
