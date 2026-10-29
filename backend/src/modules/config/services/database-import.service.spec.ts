import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import {
  DatabaseImportService,
  ImportPayload,
  ImportRules,
} from '@/modules/config/services/database-import.service';

describe('DatabaseImportService', () => {
  let service: DatabaseImportService;
  let settingsFindOne: jest.Mock;
  let settingsSave: jest.Mock;
  let deviceRepo: Record<string, jest.Mock>;
  let preferenceRepo: Record<string, jest.Mock>;

  const validateSetting = jest.fn();
  const rules: ImportRules = {
    currentAppVersion: '1.3.5',
    compareVersions: (a, b) => (a === b ? 0 : a < b ? -1 : 1),
    validateSetting,
  };
  const importing = (payload: ImportPayload) =>
    service.importDatabase(payload, rules);

  beforeEach(async () => {
    jest.clearAllMocks();

    deviceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity: Partial<UserDevice>) => entity),
      save: jest.fn((entity: Partial<UserDevice>) => Promise.resolve(entity)),
    };

    preferenceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity: Partial<UserPreference>) => entity),
      save: jest.fn((entity: Partial<UserPreference>) =>
        Promise.resolve(entity),
      ),
    };

    const repos = new Map<unknown, Record<string, jest.Mock>>([
      [UserDevice, deviceRepo],
      [UserPreference, preferenceRepo],
    ]);

    settingsFindOne = jest.fn().mockResolvedValue(null);
    settingsSave = jest.fn((entity: AppSettings) => Promise.resolve(entity));
    const settingsRepo = {
      findOne: settingsFindOne,
      save: settingsSave,
      manager: { getRepository: (token: unknown) => repos.get(token) },
    };

    const module = await Test.createTestingModule({
      providers: [
        DatabaseImportService,
        { provide: getRepositoryToken(AppSettings), useValue: settingsRepo },
      ],
    }).compile();

    service = module.get(DatabaseImportService);
  });

  describe('importDatabase', () => {
    it.each([
      ['nothing', null],
      ['an empty object', {}],
      ['a payload with no data key', { version: '1' }],
    ])('rejects %s', async (_label, payload) => {
      await expect(
        service.importDatabase(payload as ImportPayload, rules),
      ).rejects.toThrow('Invalid import data format');
    });

    it('accepts a payload with an empty data block', async () => {
      await expect(importing({ data: {} })).resolves.toEqual({
        imported: 0,
        skipped: 0,
      });
    });

    it('sums the counts across all three collections', async () => {
      settingsFindOne.mockResolvedValue({ key: 'DEFAULT_PAGE' });

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
      settingsFindOne.mockResolvedValue(existing);

      await importSettings([{ key: 'DEFAULT_PAGE', value: 'streams' }]);

      expect(settingsSave).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'streams' }),
      );
    });

    it('skips a value the settings rules reject and keeps going', async () => {
      settingsFindOne.mockImplementation(
        ({ where }: { where: { key: string } }) =>
          Promise.resolve({ key: where.key, value: '10' }),
      );
      validateSetting.mockImplementation((key: string) => {
        if (key === 'PLEXGUARD_REFRESH_INTERVAL') {
          throw new Error(
            'Session refresh interval must be at least 5 seconds',
          );
        }
      });

      await expect(
        importSettings([
          { key: 'PLEXGUARD_REFRESH_INTERVAL', value: '7.5' },
          { key: 'DEFAULT_PAGE', value: 'streams' },
        ]),
      ).resolves.toEqual({ imported: 1, skipped: 1 });
      expect(settingsSave).toHaveBeenCalledTimes(1);
      expect(settingsSave).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'DEFAULT_PAGE', value: 'streams' }),
      );
    });

    it('skips a key this build does not declare', async () => {
      await expect(
        importSettings([{ key: 'RETIRED_SETTING', value: 'x' }]),
      ).resolves.toEqual({ imported: 0, skipped: 1 });
      expect(settingsSave).not.toHaveBeenCalled();
    });

    it('refuses to downgrade APP_VERSION', async () => {
      settingsFindOne.mockResolvedValue({ key: 'APP_VERSION' });

      await expect(
        importSettings([{ key: 'APP_VERSION', value: '1.0.0' }]),
      ).resolves.toEqual({ imported: 0, skipped: 1 });
      expect(settingsSave).not.toHaveBeenCalled();
    });

    it('accepts an APP_VERSION at or above the current one', async () => {
      settingsFindOne.mockResolvedValue({ key: 'APP_VERSION' });

      await expect(
        importSettings([{ key: 'APP_VERSION', value: '1.3.5' }]),
      ).resolves.toEqual({ imported: 1, skipped: 0 });
    });

    it('counts a write failure as skipped and keeps going', async () => {
      settingsFindOne.mockResolvedValue({ key: 'DEFAULT_PAGE' });
      settingsSave
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
        username: 'testuser',
      });

      await importPreferences([{ userId: 'u1', defaultBlock: true }]);

      expect(preferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBlock: true }),
      );
    });

    it('keeps the stored username when the import omits one', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        userId: 'u1',
        username: 'testuser',
      });

      await importPreferences([{ userId: 'u1', defaultBlock: null }]);

      expect(preferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'testuser' }),
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
});
