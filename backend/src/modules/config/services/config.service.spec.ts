import { AppSettings } from '@/entities/app-settings.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import {
  ConfigTestbed,
  createConfigTestbed,
} from '@/modules/config/services/config-testbed.fixture';

describe('ConfigService', () => {
  let testbed: ConfigTestbed;
  let service: ConfigService;
  let store: Map<string, AppSettings>;
  let row: ConfigTestbed['row'];
  let settingsRepo: ConfigTestbed['settingsRepo'];
  let sessionRepo: ConfigTestbed['sessionRepo'];
  let timezoneService: ConfigTestbed['timezoneService'];
  let versionService: ConfigTestbed['versionService'];

  const compile = async () => (await testbed.compile()).get(ConfigService);
  const build = async () => (await testbed.build()).get(ConfigService);

  beforeEach(async () => {
    testbed = createConfigTestbed();
    ({
      store,
      row,
      settingsRepo,
      sessionRepo,
      timezoneService,
      versionService,
    } = testbed);
    service = await build();
  });

  describe('default settings', () => {
    it('waits for module initialization before touching the database', async () => {
      settingsRepo.findOne.mockClear();
      const created = await compile();

      expect(settingsRepo.findOne).not.toHaveBeenCalled();

      await created.onModuleInit();

      expect(settingsRepo.findOne).toHaveBeenCalled();
    });

    it('seeds the Plex, SMTP, Apprise and portal defaults', async () => {
      expect(store.has('PLEX_TOKEN')).toBe(true);
      expect(store.has('SMTP_HOST')).toBe(true);
      expect(store.has('APPRISE_URLS')).toBe(true);
      expect(store.has('USER_PORTAL_ENABLED')).toBe(true);
    });

    it('stamps the running app version into the defaults', async () => {
      expect(store.get('APP_VERSION')?.value).toBe('1.3.5');
    });

    it('leaves an existing value alone on restart', async () => {
      store.set('TIMEZONE', row('TIMEZONE', '-05:00'));
      settingsRepo.save.mockClear();

      await build();

      expect(store.get('TIMEZONE')?.value).toBe('-05:00');
      expect(settingsRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'TIMEZONE' }),
      );
    });

    it('lets the version service bump a stale stored version', async () => {
      versionService.updateAppVersionIfNewer.mockImplementation(
        async (_stored: string, apply: (v: string) => Promise<void>) => {
          await apply('9.9.9');
        },
      );
      store.set('APP_VERSION', row('APP_VERSION', '1.0.0'));

      await build();

      expect(store.get('APP_VERSION')?.value).toBe('9.9.9');
    });

    it('skips the version bump when no version row exists yet', async () => {
      store.clear();
      versionService.updateAppVersionIfNewer.mockClear();

      await build();

      expect(versionService.updateAppVersionIfNewer).not.toHaveBeenCalled();
    });
  });

  describe('getSetting', () => {
    it('parses a boolean setting', async () => {
      await expect(service.getSetting('IN_APP_ENABLED')).resolves.toBe(true);
      await expect(service.getSetting('SMTP_ENABLED')).resolves.toBe(false);
    });

    it('parses a number setting', async () => {
      await expect(service.getSetting('SMTP_PORT')).resolves.toBe(587);
    });

    it('returns a string setting verbatim', async () => {
      await expect(service.getSetting('DEFAULT_PAGE')).resolves.toBe('devices');
    });

    it('parses a row stored as json', async () => {
      store.set('CUSTOM_PLEX_URL', row('CUSTOM_PLEX_URL', '{"a":1}', 'json'));
      const fresh = await build();
      await expect(fresh.getSetting('CUSTOM_PLEX_URL')).resolves.toEqual({
        a: 1,
      });
    });

    it('falls back to the raw string when json will not parse', async () => {
      store.set('CUSTOM_PLEX_URL', row('CUSTOM_PLEX_URL', 'not json', 'json'));
      const fresh = await build();
      await expect(fresh.getSetting('CUSTOM_PLEX_URL')).resolves.toBe(
        'not json',
      );
    });

    it('returns null for a declared key with no stored row', async () => {
      settingsRepo.find.mockResolvedValueOnce([]);
      const fresh = await build();

      settingsRepo.findOne.mockResolvedValueOnce(null);
      await expect(fresh.getSetting('CUSTOM_PLEX_URL')).resolves.toBeNull();
    });

    it('reads a row written after startup from the database', async () => {
      settingsRepo.find.mockResolvedValueOnce([]);
      const fresh = await build();
      settingsRepo.findOne.mockResolvedValueOnce(
        row('SMTP_PORT', '2525', 'number'),
      );

      await expect(fresh.getSetting('SMTP_PORT')).resolves.toBe(2525);
    });

    it('serves repeat reads from the cache', async () => {
      settingsRepo.findOne.mockClear();
      await service.getSetting('DEFAULT_PAGE');
      await service.getSetting('DEFAULT_PAGE');
      expect(settingsRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('rows the database returns oddly', () => {
    it('ignores a stored key this build no longer declares', async () => {
      settingsRepo.find.mockResolvedValueOnce([
        row('DEFAULT_PAGE', 'devices'),
        row('RETIRED_SETTING', 'x'),
      ]);
      const fresh = await build();

      settingsRepo.findOne.mockResolvedValueOnce(null);
      await expect(fresh.getSetting('DEFAULT_PAGE')).resolves.toBe('devices');
    });

    it.each<[string, string | number | boolean]>([
      ['string', ''],
      ['boolean', false],
      ['number', Number.NaN],
    ])('reads a null %s column as %p', async (type, expected) => {
      const nulled = row('CUSTOM_PLEX_URL', '', type);
      nulled.value = null;
      settingsRepo.find.mockResolvedValueOnce([nulled]);
      const fresh = await build();

      await expect(fresh.getSetting('CUSTOM_PLEX_URL')).resolves.toBe(expected);
    });

    it('reads a null json column as null', async () => {
      const nulled = row('CUSTOM_PLEX_URL', '', 'json');
      nulled.value = null;
      settingsRepo.find.mockResolvedValueOnce([nulled]);
      const fresh = await build();

      await expect(fresh.getSetting('CUSTOM_PLEX_URL')).resolves.toBeNull();
    });
  });

  describe('config change listeners', () => {
    it('does nothing when removing a listener that was never added', () => {
      const listener = jest.fn();
      service.addConfigChangeListener('TIMEZONE', listener);

      expect(() =>
        service.removeConfigChangeListener('TIMEZONE', jest.fn()),
      ).not.toThrow();
    });

    it('does nothing when removing from a key with no listeners', () => {
      expect(() =>
        service.removeConfigChangeListener('DEFAULT_PAGE', jest.fn()),
      ).not.toThrow();
    });

    it('removes a listener that was added', async () => {
      const listener = jest.fn();
      service.addConfigChangeListener('TIMEZONE', listener);
      service.removeConfigChangeListener('TIMEZONE', listener);

      await service.updateSetting('TIMEZONE', '+02:00');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getPublicSettings', () => {
    it('masks the value of a private setting', async () => {
      store.set(
        'PLEX_TOKEN',
        row('PLEX_TOKEN', 'super-secret', 'string', true),
      );
      const settings = await service.getPublicSettings();

      const token = settings.find((setting) => setting.key === 'PLEX_TOKEN');
      expect(token).toMatchObject({ value: '••••••••', private: true });
    });

    it('leaves an unset private setting empty so the client knows nothing is saved', async () => {
      store.set('PLEX_TOKEN', row('PLEX_TOKEN', '', 'string', true));
      const settings = await service.getPublicSettings();

      const token = settings.find((setting) => setting.key === 'PLEX_TOKEN');
      expect(token).toMatchObject({ value: '', private: true });
    });

    it('leaves a public setting readable', async () => {
      const settings = await service.getPublicSettings();
      const page = settings.find((setting) => setting.key === 'DEFAULT_PAGE');
      expect(page?.value).toBe('devices');
    });

    it('asks the database for settings ordered by key', async () => {
      await service.getAllSettings();
      expect(settingsRepo.find).toHaveBeenCalledWith({
        order: { key: 'ASC' },
      });
    });
  });

  describe('updateSetting validation', () => {
    it.each([
      ['PLEXGUARD_REFRESH_INTERVAL', 'abc', 'must be a number'],
      ['PLEXGUARD_REFRESH_INTERVAL', 7.5, 'whole number of seconds'],
      ['PLEXGUARD_REFRESH_INTERVAL', 4, 'at least 5 seconds'],
      ['PLEXGUARD_REFRESH_INTERVAL', 0, 'at least 5 seconds'],
      ['PLEXGUARD_REFRESH_INTERVAL', -10, 'at least 5 seconds'],
      ['DEVICE_CLEANUP_INTERVAL_DAYS', 'abc', 'must be a number'],
      ['DEVICE_CLEANUP_INTERVAL_DAYS', 1.5, 'whole number'],
      ['DEVICE_CLEANUP_INTERVAL_DAYS', 0, 'at least 1 day'],
      ['SMTP_PORT', 'abc', 'valid number'],
      ['SMTP_PORT', 25.5, 'whole number'],
      ['SMTP_PORT', 0, 'between 1 and 65535'],
      ['SMTP_PORT', 70000, 'between 1 and 65535'],
      ['SMTP_FROM_EMAIL', 'not-an-email', 'valid email address'],
      ['SMTP_TO_EMAILS', 'ok@example.com, bad', 'Invalid email address: bad'],
      ['DEFAULT_PAGE', 'settings', 'devices" or "streams'],
    ] as const)('rejects %s = %p', async (key, value, message) => {
      await expect(service.updateSetting(key, value)).rejects.toThrow(message);
    });

    it.each([
      ['PLEXGUARD_REFRESH_INTERVAL', 5],
      ['PLEXGUARD_REFRESH_INTERVAL', 30],
      ['DEVICE_CLEANUP_INTERVAL_DAYS', 30],
      ['SMTP_PORT', 465],
      ['SMTP_FROM_EMAIL', 'guardian@example.com'],
      ['SMTP_FROM_EMAIL', ''],
      ['SMTP_TO_EMAILS', 'a@example.com; b@example.com\nc@example.com'],
      ['SMTP_TO_EMAILS', ''],
      ['DEFAULT_PAGE', 'streams'],
    ] as const)('accepts %s = %p', async (key, value) => {
      await expect(service.updateSetting(key, value)).resolves.toBeDefined();
    });

    it('refuses to write a declared setting with no stored row', async () => {
      store.delete('CUSTOM_PLEX_URL');
      settingsRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateSetting('CUSTOM_PLEX_URL', 'x'),
      ).rejects.toThrow('Setting CUSTOM_PLEX_URL not found');
    });
  });

  describe('updateSetting persistence', () => {
    it('stores a boolean as a string and caches it as a boolean', async () => {
      await service.updateSetting('SMTP_ENABLED', true);

      expect(store.get('SMTP_ENABLED')?.value).toBe('true');
      await expect(service.getSetting('SMTP_ENABLED')).resolves.toBe(true);
    });

    it('caches a number setting as a number', async () => {
      await service.updateSetting('SMTP_PORT', '465');
      await expect(service.getSetting('SMTP_PORT')).resolves.toBe(465);
    });

    it('serialises an object value as json', async () => {
      store.set('CUSTOM_PLEX_URL', row('CUSTOM_PLEX_URL', '{}', 'json'));
      const fresh = await build();

      await fresh.updateSetting('CUSTOM_PLEX_URL', { a: 1 });

      expect(store.get('CUSTOM_PLEX_URL')?.value).toBe('{"a":1}');
      await expect(fresh.getSetting('CUSTOM_PLEX_URL')).resolves.toEqual({
        a: 1,
      });
    });

    it('bumps the updated timestamp', async () => {
      const before = Date.now();
      await service.updateSetting('DEFAULT_PAGE', 'streams');
      expect(
        store.get('DEFAULT_PAGE')!.updatedAt.getTime(),
      ).toBeGreaterThanOrEqual(before);
    });

    it('logs the local time when the timezone changes', async () => {
      await service.updateSetting('TIMEZONE', '-05:00');
      expect(timezoneService.getCurrentTimeInTimezone).toHaveBeenCalledWith(
        '-05:00',
      );
    });

    it('revokes every Plex user session when the portal is switched off', async () => {
      await service.updateSetting('USER_PORTAL_ENABLED', false);
      expect(sessionRepo.delete).toHaveBeenCalledWith({
        userType: 'plex_user',
      });
    });

    it('leaves sessions alone when the portal is switched on', async () => {
      await service.updateSetting('USER_PORTAL_ENABLED', true);
      expect(sessionRepo.delete).not.toHaveBeenCalled();
    });

    it('tolerates the portal being disabled with no sessions to revoke', async () => {
      sessionRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(
        service.updateSetting('USER_PORTAL_ENABLED', false),
      ).resolves.toBeDefined();
    });
  });

  describe('change listeners', () => {
    it('calls a listener registered for that key', async () => {
      const listener = jest.fn();
      service.addConfigChangeListener('DEFAULT_PAGE', listener);

      await service.updateSetting('DEFAULT_PAGE', 'streams');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls every listener registered for the key', async () => {
      const first = jest.fn();
      const second = jest.fn();
      service.addConfigChangeListener('DEFAULT_PAGE', first);
      service.addConfigChangeListener('DEFAULT_PAGE', second);

      await service.updateSetting('DEFAULT_PAGE', 'streams');
      expect(first).toHaveBeenCalled();
      expect(second).toHaveBeenCalled();
    });

    it('ignores listeners registered for a different key', async () => {
      const listener = jest.fn();
      service.addConfigChangeListener('TIMEZONE', listener);

      await service.updateSetting('DEFAULT_PAGE', 'streams');
      expect(listener).not.toHaveBeenCalled();
    });

    it('stops calling a removed listener', async () => {
      const listener = jest.fn();
      service.addConfigChangeListener('DEFAULT_PAGE', listener);
      service.removeConfigChangeListener('DEFAULT_PAGE', listener);

      await service.updateSetting('DEFAULT_PAGE', 'streams');
      expect(listener).not.toHaveBeenCalled();
    });

    it('tolerates removing a listener that was never added', () => {
      expect(() =>
        service.removeConfigChangeListener('DEFAULT_PAGE', jest.fn()),
      ).not.toThrow();
    });

    it('keeps notifying the others when one listener throws', async () => {
      const survivor = jest.fn();
      service.addConfigChangeListener('DEFAULT_PAGE', () => {
        throw new Error('listener blew up');
      });
      service.addConfigChangeListener('DEFAULT_PAGE', survivor);

      await expect(
        service.updateSetting('DEFAULT_PAGE', 'streams'),
      ).resolves.toBeDefined();
      expect(survivor).toHaveBeenCalled();
    });
  });

  describe('updateMultipleSettings', () => {
    it('applies each setting in turn', async () => {
      const result = await service.updateMultipleSettings([
        { key: 'DEFAULT_PAGE', value: 'streams' },
        { key: 'SMTP_HOST', value: 'smtp.example.com' },
      ]);

      expect(result).toHaveLength(2);
      expect(store.get('SMTP_HOST')?.value).toBe('smtp.example.com');
    });

    it('aborts the batch on the first invalid setting', async () => {
      await expect(
        service.updateMultipleSettings([
          { key: 'DEFAULT_PAGE', value: 'streams' },
          { key: 'SMTP_PORT', value: '0' },
          { key: 'SMTP_HOST', value: 'smtp.example.com' },
        ]),
      ).rejects.toThrow('between 1 and 65535');

      expect(store.get('SMTP_HOST')?.value).toBe('');
    });

    it('saves nothing when any setting in the batch is invalid', async () => {
      const pageBefore = store.get('DEFAULT_PAGE')?.value;

      await expect(
        service.updateMultipleSettings([
          { key: 'DEFAULT_PAGE', value: 'streams' },
          { key: 'PLEXGUARD_REFRESH_INTERVAL', value: '2' },
        ]),
      ).rejects.toThrow('at least 5 seconds');

      expect(store.get('DEFAULT_PAGE')?.value).toBe(pageBefore);
    });
  });

  describe('timezone', () => {
    it('returns the configured offset', async () => {
      await service.updateSetting('TIMEZONE', '-05:00');
      await expect(service.getTimezone()).resolves.toBe('-05:00');
    });

    it('falls back to UTC when the offset is blank', async () => {
      await service.updateSetting('TIMEZONE', '');
      await expect(service.getTimezone()).resolves.toBe('+00:00');
    });

    it('asks the timezone service for the current local time', async () => {
      await expect(service.getCurrentTimeInTimezone()).resolves.toEqual(
        new Date('2026-08-21T12:00:00Z'),
      );
      expect(timezoneService.getCurrentTimeInTimezone).toHaveBeenCalledWith(
        '+00:00',
      );
    });
  });

  describe('getVersionInfo', () => {
    it('compares the stored version against the running one', async () => {
      await expect(service.getVersionInfo()).resolves.toMatchObject({
        version: '1.3.5',
      });
      expect(versionService.getVersionInfo).toHaveBeenCalledWith('1.3.5');
    });

    it('falls back to the running version when none is stored', async () => {
      store.delete('APP_VERSION');
      settingsRepo.findOne.mockResolvedValue(null);

      await service.getVersionInfo();
      expect(versionService.getVersionInfo).toHaveBeenCalledWith('1.3.5');
    });
  });

  describe('settings that were never written', () => {
    it('reports the build version when none is stored', async () => {
      settingsRepo.find.mockResolvedValueOnce([]);
      const fresh = await build();
      settingsRepo.findOne.mockResolvedValue(null);
      versionService.getCurrentAppVersion.mockReturnValue('9.9.9');

      await fresh.getVersionInfo();

      expect(versionService.getVersionInfo).toHaveBeenCalledWith('9.9.9');
    });
  });
});
