import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '../../../entities/app-settings.entity';
import { Session } from '../../../entities/session.entity';
import { PlexErrorCode } from '../../../types/plex-errors';
import { ConfigService } from './config.service';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { PlexConnectionService } from './plex-connection.service';
import { TimezoneService } from './timezone.service';
import { DatabaseService } from './database.service';
import { VersionService } from './version.service';
import { AppriseService } from './apprise.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ConfigService', () => {
  let service: ConfigService;
  let store: Map<string, AppSettings>;
  let settingsRepo: Record<string, jest.Mock>;
  let sessionRepo: { delete: jest.Mock };
  let emailService: { testSMTPConnection: jest.Mock };
  let plexConnectionService: { testConnection: jest.Mock };
  let timezoneService: Record<string, jest.Mock>;
  let databaseService: Record<string, jest.Mock>;
  let versionService: Record<string, jest.Mock>;
  let appriseService: { testAppriseConnection: jest.Mock };

  const row = (
    key: string,
    value: string,
    type = 'string',
    isPrivate = false,
  ): AppSettings =>
    Object.assign(new AppSettings(), {
      id: store.size + 1,
      key,
      value,
      type,
      private: isPrivate,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

  const build = async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: getRepositoryToken(AppSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: EmailService, useValue: emailService },
        { provide: EmailTemplateService, useValue: {} },
        { provide: PlexConnectionService, useValue: plexConnectionService },
        { provide: TimezoneService, useValue: timezoneService },
        { provide: DatabaseService, useValue: databaseService },
        { provide: VersionService, useValue: versionService },
        { provide: AppriseService, useValue: appriseService },
      ],
    }).compile();

    const created = module.get(ConfigService);
    await flush();
    return created;
  };

  beforeEach(async () => {
    store = new Map();

    settingsRepo = {
      find: jest.fn(() => Promise.resolve([...store.values()])),
      findOne: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(store.get(where.key) ?? null),
      ),
      save: jest.fn((entity: AppSettings) => {
        const saved = Object.assign(
          store.get(entity.key) ?? new AppSettings(),
          { id: store.size + 1, private: false },
          entity,
        );
        store.set(saved.key, saved);
        return Promise.resolve(saved);
      }),
    };

    sessionRepo = { delete: jest.fn().mockResolvedValue({ affected: 2 }) };

    emailService = {
      testSMTPConnection: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'sent' }),
    };

    plexConnectionService = {
      testConnection: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Connected' }),
    };

    timezoneService = {
      getCurrentTimeInTimezone: jest
        .fn()
        .mockReturnValue(new Date('2026-08-21T12:00:00Z')),
      formatTimestamp: jest.fn().mockReturnValue('2026-08-21 12:00:00'),
    };

    databaseService = {
      exportDatabase: jest.fn().mockResolvedValue('{"settings":[]}'),
      importDatabase: jest.fn().mockResolvedValue({ imported: 5, skipped: 1 }),
      resetDatabase: jest.fn().mockResolvedValue(undefined),
      resetStreamCounts: jest.fn().mockResolvedValue(undefined),
      deleteAllDevices: jest.fn().mockResolvedValue(undefined),
      clearAllSessionHistory: jest.fn().mockResolvedValue(undefined),
    };

    versionService = {
      getCurrentAppVersion: jest.fn().mockReturnValue('1.3.5'),
      compareVersions: jest.fn().mockReturnValue(0),
      updateAppVersionIfNewer: jest.fn().mockResolvedValue(undefined),
      getVersionInfo: jest.fn().mockReturnValue({
        version: '1.3.5',
        databaseVersion: '1.3.5',
        codeVersion: '1.3.5',
        isVersionMismatch: false,
      }),
    };

    appriseService = {
      testAppriseConnection: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'ok' }),
    };

    service = await build();
  });

  describe('default settings', () => {
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

    it('parses a json setting', async () => {
      store.set('EXTRA', row('EXTRA', '{"a":1}', 'json'));
      const fresh = await build();
      await expect(fresh.getSetting('EXTRA')).resolves.toEqual({ a: 1 });
    });

    it('falls back to the raw string when json will not parse', async () => {
      store.set('EXTRA', row('EXTRA', 'not json', 'json'));
      const fresh = await build();
      await expect(fresh.getSetting('EXTRA')).resolves.toBe('not json');
    });

    it('returns null for a key that does not exist', async () => {
      await expect(service.getSetting('NOPE')).resolves.toBeNull();
    });

    it('serves repeat reads from the cache', async () => {
      settingsRepo.findOne.mockClear();
      await service.getSetting('DEFAULT_PAGE');
      await service.getSetting('DEFAULT_PAGE');
      expect(settingsRepo.findOne).not.toHaveBeenCalled();
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
    ])('rejects %s = %p', async (key, value, message) => {
      await expect(service.updateSetting(key, value)).rejects.toThrow(message);
    });

    it.each([
      ['DEVICE_CLEANUP_INTERVAL_DAYS', 30],
      ['SMTP_PORT', 465],
      ['SMTP_FROM_EMAIL', 'guardian@example.com'],
      ['SMTP_FROM_EMAIL', ''],
      ['SMTP_TO_EMAILS', 'a@example.com; b@example.com\nc@example.com'],
      ['SMTP_TO_EMAILS', ''],
      ['DEFAULT_PAGE', 'streams'],
    ])('accepts %s = %p', async (key, value) => {
      await expect(service.updateSetting(key, value)).resolves.toBeDefined();
    });

    it('refuses to create a setting that was never declared', async () => {
      await expect(service.updateSetting('MADE_UP', 'x')).rejects.toThrow(
        'Setting MADE_UP not found',
      );
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
      store.set('EXTRA', row('EXTRA', '{}', 'json'));
      const fresh = await build();

      await fresh.updateSetting('EXTRA', { a: 1 });

      expect(store.get('EXTRA')?.value).toBe('{"a":1}');
      await expect(fresh.getSetting('EXTRA')).resolves.toEqual({ a: 1 });
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

  describe('testPlexConnection', () => {
    it('passes the stored server details through', async () => {
      await service.updateSetting('PLEX_SERVER_IP', '10.0.0.5');
      await service.updateSetting('PLEX_TOKEN', 'plex-token');
      await service.updateSetting('USE_SSL', true);

      await service.testPlexConnection();

      expect(plexConnectionService.testConnection).toHaveBeenCalledWith(
        '10.0.0.5',
        '32400',
        'plex-token',
        true,
        false,
      );
    });

    it('reports an unexpected failure as an unknown error', async () => {
      plexConnectionService.testConnection.mockRejectedValue(
        new Error('socket hang up'),
      );

      await expect(service.testPlexConnection()).resolves.toEqual({
        success: false,
        errorCode: PlexErrorCode.UNKNOWN_ERROR,
        message: 'Unexpected error testing Plex connection',
        details: 'socket hang up',
      });
    });
  });

  describe('testSMTPConnection', () => {
    it('builds the SMTP config from the stored settings', async () => {
      await service.updateMultipleSettings([
        { key: 'SMTP_HOST', value: 'smtp.example.com' },
        { key: 'SMTP_PORT', value: '465' },
        { key: 'SMTP_USER', value: 'guardian' },
        { key: 'SMTP_FROM_EMAIL', value: 'from@example.com' },
      ]);

      await service.testSMTPConnection();

      expect(emailService.testSMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 465,
          user: 'guardian',
          fromEmail: 'from@example.com',
        }),
        false,
        '2026-08-21 12:00:00',
      );
    });

    it('honours the boolean TLS setting', async () => {
      await service.testSMTPConnection();

      expect(emailService.testSMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({ useTLS: true }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('splits the recipient list on commas, semicolons and newlines', async () => {
      await service.updateSetting(
        'SMTP_TO_EMAILS',
        'a@example.com, b@example.com;c@example.com\nd@example.com',
      );

      await service.testSMTPConnection();

      expect(emailService.testSMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmails: [
            'a@example.com',
            'b@example.com',
            'c@example.com',
            'd@example.com',
          ],
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('sends an empty recipient list when none are configured', async () => {
      await service.testSMTPConnection();

      expect(emailService.testSMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({ toEmails: [] }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('reports an unexpected failure rather than throwing', async () => {
      emailService.testSMTPConnection.mockRejectedValue(new Error('no route'));

      await expect(service.testSMTPConnection()).resolves.toEqual({
        success: false,
        message: 'Unexpected error: no route',
      });
    });
  });

  describe('testAppriseConnection', () => {
    it('delegates to the Apprise service', async () => {
      await expect(service.testAppriseConnection()).resolves.toEqual({
        success: true,
        message: 'ok',
      });
    });
  });

  describe('getPlexConfigurationStatus', () => {
    const configure = async () => {
      await service.updateSetting('PLEX_SERVER_IP', '10.0.0.5');
      await service.updateSetting('PLEX_TOKEN', 'plex-token');
    };

    it('reports an unconfigured server without testing the connection', async () => {
      await expect(service.getPlexConfigurationStatus()).resolves.toEqual({
        configured: false,
        hasValidCredentials: false,
        connectionStatus: 'Not configured',
      });
      expect(plexConnectionService.testConnection).not.toHaveBeenCalled();
    });

    it('reports a working connection', async () => {
      await configure();

      await expect(service.getPlexConfigurationStatus()).resolves.toEqual({
        configured: true,
        hasValidCredentials: true,
        connectionStatus: 'Connected',
      });
    });

    it('falls back to a generic message when the probe says nothing', async () => {
      await configure();
      plexConnectionService.testConnection.mockResolvedValue({ success: true });

      const status = await service.getPlexConfigurationStatus();
      expect(status.connectionStatus).toBe('Connected successfully');
    });

    it('prefixes a failure with its error code so the UI can parse it', async () => {
      await configure();
      plexConnectionService.testConnection.mockResolvedValue({
        success: false,
        errorCode: PlexErrorCode.INVALID_TOKEN,
        message: 'Bad token',
      });

      await expect(service.getPlexConfigurationStatus()).resolves.toEqual({
        configured: true,
        hasValidCredentials: false,
        connectionStatus: `${PlexErrorCode.INVALID_TOKEN}: Bad token`,
      });
    });

    it('reports a failed probe rather than throwing', async () => {
      await configure();
      plexConnectionService.testConnection.mockRejectedValue(
        new Error('socket hang up'),
      );

      await expect(service.getPlexConfigurationStatus()).resolves.toMatchObject(
        {
          configured: true,
          hasValidCredentials: false,
          connectionStatus: `${PlexErrorCode.UNKNOWN_ERROR}: Unexpected error testing Plex connection`,
        },
      );
    });
  });

  describe('database management', () => {
    it('exports with the stored app version', async () => {
      await expect(service.exportDatabase()).resolves.toBe('{"settings":[]}');
      expect(databaseService.exportDatabase).toHaveBeenCalledWith('1.3.5');
    });

    it('imports and reloads the cache', async () => {
      settingsRepo.find.mockClear();

      await expect(service.importDatabase({ settings: [] })).resolves.toEqual({
        imported: 5,
        skipped: 1,
      });
      expect(settingsRepo.find).toHaveBeenCalled();
    });

    it('hands the importer the running version and a comparator', async () => {
      await service.importDatabase({ settings: [] });

      const [, version, compare] = databaseService.importDatabase.mock.calls[0];
      expect(version).toBe('1.3.5');
      expect(typeof compare).toBe('function');
    });

    it('re-seeds the defaults after a reset', async () => {
      store.clear();
      await service.resetDatabase();

      expect(databaseService.resetDatabase).toHaveBeenCalled();
      expect(store.has('PLEX_TOKEN')).toBe(true);
    });

    it.each([
      ['resetStreamCounts', 'resetStreamCounts'],
      ['deleteAllDevices', 'deleteAllDevices'],
      ['clearAllSessionHistory', 'clearAllSessionHistory'],
    ] as const)(
      'delegates %s to the database service',
      async (method, target) => {
        await service[method]();
        expect(databaseService[target]).toHaveBeenCalled();
      },
    );
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
});
