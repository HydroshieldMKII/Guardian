import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import {
  DatabaseImportService,
  ImportRules,
} from '@/modules/config/services/database-import.service';
import { SECRET_MASK } from '@/modules/config/services/public-setting';
import type { Mock } from 'vitest';

describe('DatabaseImportService', () => {
  let service: DatabaseImportService;
  let settingsFindOne: Mock;
  let settingsSave: Mock;
  let deviceRepo: Record<string, Mock>;
  let preferenceRepo: Record<string, Mock>;
  let transaction: Mock;

  const prepareSetting = vi.fn((_key: string, value: string) => value);
  const rules: ImportRules = {
    currentAppVersion: '1.3.5',
    compareVersions: (a, b) => (a === b ? 0 : a < b ? -1 : 1),
    prepareSetting,
  };
  const importing = (payload: unknown) =>
    service.importDatabase(payload, rules);
  const counts = (imported: number, skipped: number): unknown =>
    expect.objectContaining({ imported, skipped });

  beforeEach(async () => {
    vi.clearAllMocks();
    prepareSetting.mockImplementation((_key: string, value: string) => value);

    deviceRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((entity: Partial<UserDevice>) => entity),
      save: vi.fn((entity: Partial<UserDevice>) => Promise.resolve(entity)),
    };

    preferenceRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((entity: Partial<UserPreference>) => entity),
      save: vi.fn((entity: Partial<UserPreference>) => Promise.resolve(entity)),
    };

    settingsFindOne = vi.fn().mockResolvedValue(null);
    settingsSave = vi.fn((entity: AppSettings) => Promise.resolve(entity));
    const settingsRepo: Record<string, unknown> = {
      findOne: settingsFindOne,
      save: settingsSave,
    };

    const repos = new Map<unknown, unknown>([
      [AppSettings, settingsRepo],
      [UserDevice, deviceRepo],
      [UserPreference, preferenceRepo],
    ]);
    const manager: Record<string, unknown> = {
      getRepository: (token: unknown) => repos.get(token),
    };
    transaction = vi.fn((work: (m: unknown) => Promise<unknown>) =>
      work(manager),
    );
    manager.transaction = transaction;
    settingsRepo.manager = manager;

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
      ['a list', []],
      ['an empty object', {}],
      ['a payload with no data key', { version: '1' }],
      ['a text data block', { data: 'x' }],
      ['a list data block', { data: [] }],
    ])('rejects %s with a 400', async (_label, payload) => {
      const failure = importing(payload);
      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      await expect(failure).rejects.toThrow('Invalid import data format');
      expect(transaction).not.toHaveBeenCalled();
    });

    it('accepts a payload with an empty data block', async () => {
      await expect(importing({ data: {} })).resolves.toEqual({
        imported: 0,
        skipped: 0,
        changedSettings: [],
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
      ).resolves.toEqual(counts(3, 0));
    });

    it('runs every write inside one transaction', async () => {
      await importing({
        data: { userDevices: [{ deviceIdentifier: 'dev-1', userId: 'u1' }] },
      });

      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it('lets a write failure abort the whole import', async () => {
      deviceRepo.save.mockRejectedValue(new Error('constraint'));

      await expect(
        importing({
          data: { userDevices: [{ deviceIdentifier: 'dev-1', userId: 'u1' }] },
        }),
      ).rejects.toThrow('constraint');
    });
  });

  describe('rejecting a malformed file', () => {
    const rejection = async (payload: unknown) => {
      const failure = importing(payload);
      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
      expect(settingsSave).not.toHaveBeenCalled();
      expect(deviceRepo.save).not.toHaveBeenCalled();
      expect(preferenceRepo.save).not.toHaveBeenCalled();
      return failure.catch((error: Error) => error.message);
    };

    it('writes nothing when a later setting is null', async () => {
      settingsFindOne.mockResolvedValue({ key: 'DEFAULT_PAGE' });

      const message = await rejection({
        data: {
          settings: [{ key: 'DEFAULT_PAGE', value: 'streams' }, null],
        },
      });

      expect(message).toContain('settings[1] must be an object');
    });

    it.each(['userDevices', 'userPreferences'])(
      'rejects a null entry in %s',
      async (collection) => {
        expect(await rejection({ data: { [collection]: [null] } })).toContain(
          `${collection}[0] must be an object`,
        );
      },
    );

    it('rejects a collection that is not a list', async () => {
      expect(await rejection({ data: { settings: 'x' } })).toContain(
        'settings must be a list',
      );
    });

    it('rejects a setting without a key', async () => {
      expect(
        await rejection({ data: { settings: [{ value: 'x' }] } }),
      ).toContain('settings[0].key');
    });

    it('rejects a setting whose value is not text', async () => {
      expect(
        await rejection({
          data: { settings: [{ key: 'A', value: { a: 1 } }] },
        }),
      ).toContain('settings[0].value must be a string');
    });

    it('rejects a device without its natural key', async () => {
      const message = await rejection({ data: { userDevices: [{}] } });

      expect(message).toContain('userDevices[0].userId is required');
      expect(message).toContain('userDevices[0].deviceIdentifier is required');
    });

    it.each([
      ['status', 'bogus'],
      ['sessionCount', 'abc'],
      ['sessionCount', -1],
      ['lastSeen', 'not a date'],
      ['temporaryAccessBypassPolicies', 'yes'],
      ['requestDescription', 'x'.repeat(501)],
      ['deviceName', 5],
    ])('rejects a device with %s set to %p', async (field, value) => {
      expect(
        await rejection({
          data: {
            userDevices: [
              { userId: 'u1', deviceIdentifier: 'dev-1', [field]: value },
            ],
          },
        }),
      ).toContain(`userDevices[0].${field}`);
    });

    it.each([
      ['networkPolicy', 'everywhere'],
      ['ipAccessPolicy', 'some'],
      ['hidden', 1],
      ['defaultBlock', 'true'],
      ['allowedIPs', 'a'],
      ['concurrentStreamLimit', 1.5],
    ])('rejects a preference with %s set to %p', async (field, value) => {
      expect(
        await rejection({
          data: { userPreferences: [{ userId: 'u1', [field]: value }] },
        }),
      ).toContain(`userPreferences[0].${field}`);
    });

    it('rejects the same device twice', async () => {
      const device = { userId: 'u1', deviceIdentifier: 'dev-1' };

      expect(
        await rejection({ data: { userDevices: [device, device] } }),
      ).toContain('userDevices contains a duplicate');
    });

    it('rejects the same preference and setting twice', async () => {
      const message = await rejection({
        data: {
          settings: [
            { key: 'A', value: '1' },
            { key: 'A', value: '2' },
          ],
          userPreferences: [{ userId: 'u1' }, { userId: 'u1' }],
        },
      });

      expect(message).toContain('settings contains a duplicate: A');
      expect(message).toContain('userPreferences contains a duplicate: u1');
    });

    it('lists at most ten problems', async () => {
      const message = await rejection({
        data: { settings: Array.from({ length: 14 }, () => null) },
      });

      expect(message).toContain('and 4 more');
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

    it('keeps a stored secret when the file holds the masked placeholder', async () => {
      settingsFindOne.mockResolvedValue({
        key: 'PLEX_TOKEN',
        value: 'stored-token',
        private: true,
      });

      const result = await importSettings([
        { key: 'PLEX_TOKEN', value: SECRET_MASK },
      ]);

      expect(settingsSave).not.toHaveBeenCalled();
      expect(result.changedSettings).toEqual([]);
    });

    it('reports only the settings whose value changed', async () => {
      settingsFindOne.mockImplementation(
        ({ where }: { where: { key: string } }) =>
          Promise.resolve({ key: where.key, value: 'same' }),
      );

      const result = await importSettings([
        { key: 'DEFAULT_PAGE', value: 'streams' },
        { key: 'TIMEZONE', value: 'same' },
      ]);

      expect(result).toEqual(counts(2, 0));
      expect(result.changedSettings).toEqual([
        { key: 'DEFAULT_PAGE', value: 'streams' },
      ]);
    });

    it('skips a value the settings rules reject and keeps going', async () => {
      settingsFindOne.mockImplementation(
        ({ where }: { where: { key: string } }) =>
          Promise.resolve({ key: where.key, value: '10' }),
      );
      prepareSetting.mockImplementation((key: string, value: string) => {
        if (key === 'PLEXGUARD_REFRESH_INTERVAL') {
          throw new Error(
            'Session refresh interval must be a whole number of seconds',
          );
        }
        return value;
      });

      await expect(
        importSettings([
          { key: 'PLEXGUARD_REFRESH_INTERVAL', value: '7.5' },
          { key: 'DEFAULT_PAGE', value: 'streams' },
        ]),
      ).resolves.toEqual(counts(1, 1));
      expect(settingsSave).toHaveBeenCalledTimes(1);
      expect(settingsSave).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'DEFAULT_PAGE', value: 'streams' }),
      );
    });

    it('stores the value the settings rules adjusted it to', async () => {
      settingsFindOne.mockResolvedValue({
        key: 'PLEXGUARD_REFRESH_INTERVAL',
        value: '10',
      });
      prepareSetting.mockReturnValueOnce('5');

      await expect(
        importSettings([{ key: 'PLEXGUARD_REFRESH_INTERVAL', value: '2' }]),
      ).resolves.toEqual(counts(1, 0));
      expect(settingsSave).toHaveBeenCalledWith(
        expect.objectContaining({ value: '5' }),
      );
    });

    it('reads a null value as empty text', async () => {
      settingsFindOne.mockResolvedValue({ key: 'PLEX_TOKEN', value: 'old' });

      await importing({
        data: { settings: [{ key: 'PLEX_TOKEN', value: null }] },
      });

      expect(settingsSave).toHaveBeenCalledWith(
        expect.objectContaining({ value: '' }),
      );
    });

    it('skips a key this build does not declare', async () => {
      await expect(
        importSettings([{ key: 'RETIRED_SETTING', value: 'x' }]),
      ).resolves.toEqual(counts(0, 1));
      expect(settingsSave).not.toHaveBeenCalled();
    });

    it('refuses to downgrade APP_VERSION', async () => {
      settingsFindOne.mockResolvedValue({ key: 'APP_VERSION' });

      await expect(
        importSettings([{ key: 'APP_VERSION', value: '1.0.0' }]),
      ).resolves.toEqual(counts(0, 1));
      expect(settingsSave).not.toHaveBeenCalled();
    });

    it('accepts an APP_VERSION at or above the current one', async () => {
      settingsFindOne.mockResolvedValue({ key: 'APP_VERSION' });

      await expect(
        importSettings([{ key: 'APP_VERSION', value: '1.3.5' }]),
      ).resolves.toEqual(counts(1, 0));
    });
  });

  describe('importing devices', () => {
    const importDevices = (devices: unknown[]) =>
      importing({ data: { userDevices: devices } });

    it('creates a device that is not on file', async () => {
      await expect(
        importDevices([{ deviceIdentifier: 'dev-1', userId: 'u1' }]),
      ).resolves.toEqual(counts(1, 0));
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

    it('never trusts an imported primary key', async () => {
      const existing = { id: 1, deviceIdentifier: 'other', userId: 'u9' };
      deviceRepo.findOne.mockResolvedValue(null);

      await importDevices([{ id: 1, deviceIdentifier: 'dev-1', userId: 'u1' }]);
      expect(deviceRepo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ id: expect.anything() as unknown }),
      );

      deviceRepo.findOne.mockResolvedValue(existing);
      await importDevices([{ id: 7, deviceIdentifier: 'other', userId: 'u9' }]);
      expect(deviceRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 1 }),
      );
    });

    it('turns date fields into dates and ignores unknown fields', async () => {
      await importDevices([
        {
          deviceIdentifier: 'dev-1',
          userId: 'u1',
          lastSeen: '2024-01-02T03:04:05.000Z',
          injected: 'x',
        },
      ]);

      const [created] = deviceRepo.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(created.lastSeen).toEqual(new Date('2024-01-02T03:04:05.000Z'));
      expect(created).not.toHaveProperty('injected');
    });
  });

  describe('importing preferences', () => {
    const importPreferences = (preferences: unknown[]) =>
      importing({ data: { userPreferences: preferences } });

    it('creates a preference that is not on file', async () => {
      await expect(
        importPreferences([{ userId: 'u1', defaultBlock: true }]),
      ).resolves.toEqual(counts(1, 0));
      expect(preferenceRepo.create).toHaveBeenCalled();
    });

    it('never trusts an imported primary key', async () => {
      await importPreferences([{ id: 3, userId: 'u1' }]);

      expect(preferenceRepo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ id: expect.anything() as unknown }),
      );
    });

    it('turns a missing allowed list into an empty one', async () => {
      await importPreferences([{ userId: 'u1', allowedIPs: null }]);

      expect(preferenceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ allowedIPs: [] }),
      );
    });

    it.each([[], null, undefined])(
      'opens a restricted policy whose allowed list is %p',
      async (allowedIPs) => {
        await importPreferences([
          { userId: 'u1', ipAccessPolicy: 'restricted', allowedIPs },
        ]);

        expect(preferenceRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ ipAccessPolicy: 'all' }),
        );
      },
    );

    it('keeps a restricted policy that lists addresses', async () => {
      await importPreferences([
        {
          userId: 'u1',
          ipAccessPolicy: 'restricted',
          allowedIPs: ['10.0.0.0/8'],
        },
      ]);

      expect(preferenceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAccessPolicy: 'restricted',
          allowedIPs: ['10.0.0.0/8'],
        }),
      );
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
  });

  describe('importing an exported file', () => {
    it('accepts what the export writes', async () => {
      const exported = JSON.stringify({
        exportedAt: '2024-01-01T00:00:00.000Z',
        version: '1.3.5',
        data: {
          settings: [
            {
              id: 1,
              key: 'DEFAULT_PAGE',
              value: 'devices',
              type: 'string',
              private: false,
              updatedAt: new Date(),
            },
          ],
          userDevices: [
            {
              id: 4,
              userId: 'u1',
              username: null,
              avatarUrl: null,
              deviceIdentifier: 'dev-1',
              deviceName: 'Living room',
              devicePlatform: null,
              deviceProduct: null,
              deviceVersion: null,
              status: 'approved',
              firstSeen: new Date(),
              lastSeen: new Date(),
              sessionCount: 3,
              currentSessionKey: null,
              ipAddress: '192.0.2.1',
              temporaryAccessUntil: null,
              temporaryAccessGrantedAt: null,
              temporaryAccessDurationMinutes: null,
              temporaryAccessBypassPolicies: false,
              excludeFromConcurrentLimit: false,
              requestDescription: null,
              requestSubmittedAt: null,
              requestNoteReadAt: null,
            },
          ],
          userPreferences: [
            {
              id: 2,
              userId: 'u1',
              username: 'testuser',
              avatarUrl: null,
              defaultBlock: null,
              hidden: false,
              networkPolicy: 'both',
              ipAccessPolicy: 'all',
              allowedIPs: null,
              concurrentStreamLimit: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      });
      settingsFindOne.mockResolvedValue({ key: 'DEFAULT_PAGE', value: 'x' });

      await expect(importing(JSON.parse(exported))).resolves.toEqual(
        counts(3, 0),
      );
    });
  });
});
