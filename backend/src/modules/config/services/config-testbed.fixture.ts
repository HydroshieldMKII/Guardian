import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { Session } from '@/entities/session.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';
import { DatabaseMaintenanceService } from '@/modules/config/services/database-maintenance.service';
import { EmailService } from '@/modules/config/services/email.service';
import { PlexConnectionService } from '@/modules/config/services/plex-connection.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import { VersionService } from '@/modules/config/services/version.service';
import { AppriseService } from '@/modules/config/services/apprise.service';

export interface ConfigTestbed {
  store: Map<string, AppSettings>;
  row: (
    key: string,
    value: string,
    type?: string,
    isPrivate?: boolean,
  ) => AppSettings;
  settingsRepo: Record<'find' | 'findOne' | 'save', jest.Mock>;
  sessionRepo: { delete: jest.Mock };
  emailService: Record<
    'testSMTPConnection' | 'loadSmtpSettings' | 'toSmtpConfig',
    jest.Mock
  >;
  plexConnectionService: { testConnection: jest.Mock };
  timezoneService: Record<
    'getCurrentTimeInTimezone' | 'formatTimestamp',
    jest.Mock
  >;
  databaseService: Record<
    'exportDatabase' | 'importDatabase' | 'resetDatabase',
    jest.Mock
  >;
  versionService: Record<
    | 'getCurrentAppVersion'
    | 'compareVersions'
    | 'updateAppVersionIfNewer'
    | 'getVersionInfo',
    jest.Mock
  >;
  appriseService: { testAppriseConnection: jest.Mock };
  compile: () => Promise<TestingModule>;
  build: () => Promise<TestingModule>;
}

export const createConfigTestbed = (): ConfigTestbed => {
  const store = new Map<string, AppSettings>();

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

  const settingsRepo = {
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

  const sessionRepo = {
    delete: jest.fn().mockResolvedValue({ affected: 2 }),
  };

  const emailService = {
    testSMTPConnection: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'sent' }),
    loadSmtpSettings: jest.fn().mockResolvedValue({
      SMTP_ENABLED: false,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 465,
      SMTP_USER: 'guardian',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM_EMAIL: 'from@example.com',
      SMTP_FROM_NAME: 'Guardian',
      SMTP_USE_TLS: true,
      SMTP_TO_EMAILS: '',
    }),
    toSmtpConfig: jest.fn().mockReturnValue({
      host: 'smtp.example.com',
      port: 465,
      user: 'guardian',
      password: 'secret',
      fromEmail: 'from@example.com',
      fromName: 'Guardian',
      useTLS: true,
      toEmails: [],
    }),
  };

  const plexConnectionService = {
    testConnection: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Connected' }),
  };

  const timezoneService = {
    getCurrentTimeInTimezone: jest
      .fn()
      .mockReturnValue(new Date('2026-08-21T12:00:00Z')),
    formatTimestamp: jest.fn().mockReturnValue('2026-08-21 12:00:00'),
  };

  const databaseService = {
    exportDatabase: jest.fn().mockResolvedValue('{"settings":[]}'),
    importDatabase: jest.fn().mockResolvedValue({ imported: 5, skipped: 1 }),
    resetDatabase: jest.fn().mockResolvedValue(undefined),
  };

  const versionService = {
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

  const appriseService = {
    testAppriseConnection: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'ok' }),
  };

  const compile = () =>
    Test.createTestingModule({
      providers: [
        ConfigService,
        ConnectionTestService,
        DatabaseMaintenanceService,
        { provide: getRepositoryToken(AppSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: EmailService, useValue: emailService },
        { provide: PlexConnectionService, useValue: plexConnectionService },
        { provide: TimezoneService, useValue: timezoneService },
        { provide: DatabaseService, useValue: databaseService },
        { provide: VersionService, useValue: versionService },
        { provide: AppriseService, useValue: appriseService },
      ],
    }).compile();

  const build = async () => {
    const module = await compile();
    await module.get(ConfigService).onModuleInit();
    return module;
  };

  return {
    store,
    row,
    settingsRepo,
    sessionRepo,
    emailService,
    plexConnectionService,
    timezoneService,
    databaseService,
    versionService,
    appriseService,
    compile,
    build,
  };
};
