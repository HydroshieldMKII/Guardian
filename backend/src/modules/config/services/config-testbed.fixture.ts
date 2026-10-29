import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { Session } from '@/entities/session.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';
import { DatabaseMaintenanceService } from '@/modules/config/services/database-maintenance.service';
import { EmailService } from '@/modules/config/services/email.service';
import { EmailTemplateService } from '@/modules/config/services/email-template.service';
import { PlexConnectionService } from '@/modules/config/services/plex-connection.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import { DatabaseImportService } from '@/modules/config/services/database-import.service';
import { VersionService } from '@/modules/config/services/version.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import type { Mock } from 'vitest';

export interface ConfigTestbed {
  store: Map<string, AppSettings>;
  row: (
    key: string,
    value: string,
    type?: string,
    isPrivate?: boolean,
  ) => AppSettings;
  settingsRepo: Record<'find' | 'findOne' | 'save', Mock> & {
    manager: { transaction: Mock; getRepository: Mock };
  };
  sessionRepo: { delete: Mock };
  emailService: { loadSmtpSettings: Mock };
  emailTemplateService: { generateSMTPTestEmail: Mock };
  plexConnectionService: { testConnection: Mock };
  timezoneService: Record<'getCurrentTimeInTimezone' | 'formatTimestamp', Mock>;
  databaseService: Record<'exportDatabase' | 'resetDatabase', Mock>;
  databaseImportService: { importDatabase: Mock };
  versionService: Record<
    | 'getCurrentAppVersion'
    | 'compareVersions'
    | 'updateAppVersionIfNewer'
    | 'getVersionInfo',
    Mock
  >;
  appriseService: { testAppriseConnection: Mock };
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

  const snapshotStore = () =>
    [...store.values()].map((entry) => ({
      entry,
      value: entry.value,
      updatedAt: entry.updatedAt,
    }));

  const restoreStore = (snapshot: ReturnType<typeof snapshotStore>) => {
    for (const { entry, value, updatedAt } of snapshot) {
      entry.value = value;
      entry.updatedAt = updatedAt;
    }
  };

  const manager: ConfigTestbed['settingsRepo']['manager'] = {
    getRepository: vi.fn(() => settingsRepo),
    transaction: vi.fn(
      async (work: (entityManager: unknown) => Promise<unknown>) => {
        const snapshot = snapshotStore();
        try {
          return await work(manager);
        } catch (error) {
          restoreStore(snapshot);
          throw error;
        }
      },
    ),
  };

  const settingsRepo: ConfigTestbed['settingsRepo'] = {
    manager,
    find: vi.fn(() => Promise.resolve([...store.values()])),
    findOne: vi.fn(({ where }: { where: { key: string } }) =>
      Promise.resolve(store.get(where.key) ?? null),
    ),
    save: vi.fn((entity: AppSettings) => {
      const existing = store.get(entity.key);
      const saved = Object.assign(
        existing ?? new AppSettings(),
        existing ? {} : { id: store.size + 1, private: false },
        entity,
      );
      store.set(saved.key, saved);
      return Promise.resolve(saved);
    }),
  };

  const sessionRepo = {
    delete: vi.fn().mockResolvedValue({ affected: 2 }),
  };

  const emailService = {
    loadSmtpSettings: vi.fn().mockResolvedValue({
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
  };

  const emailTemplateService = {
    generateSMTPTestEmail: vi.fn().mockReturnValue('<p>test</p>'),
  };

  const plexConnectionService = {
    testConnection: vi
      .fn()
      .mockResolvedValue({ success: true, message: 'Connected' }),
  };

  const timezoneService = {
    getCurrentTimeInTimezone: vi
      .fn()
      .mockReturnValue(new Date('2026-08-21T12:00:00Z')),
    formatTimestamp: vi.fn().mockReturnValue('2026-08-21 12:00:00'),
  };

  const databaseService = {
    exportDatabase: vi.fn().mockResolvedValue('{"settings":[]}'),
    resetDatabase: vi.fn().mockResolvedValue(undefined),
  };

  const databaseImportService = {
    importDatabase: vi.fn().mockResolvedValue({
      imported: 5,
      skipped: 1,
      changedSettings: [],
    }),
  };

  const versionService = {
    getCurrentAppVersion: vi.fn().mockReturnValue('1.3.5'),
    compareVersions: vi.fn().mockReturnValue(0),
    updateAppVersionIfNewer: vi.fn().mockResolvedValue(undefined),
    getVersionInfo: vi.fn().mockReturnValue({
      version: '1.3.5',
      databaseVersion: '1.3.5',
      codeVersion: '1.3.5',
      isVersionMismatch: false,
    }),
  };

  const appriseService = {
    testAppriseConnection: vi
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
        { provide: EmailTemplateService, useValue: emailTemplateService },
        { provide: PlexConnectionService, useValue: plexConnectionService },
        { provide: TimezoneService, useValue: timezoneService },
        { provide: DatabaseService, useValue: databaseService },
        { provide: DatabaseImportService, useValue: databaseImportService },
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
    emailTemplateService,
    plexConnectionService,
    timezoneService,
    databaseService,
    databaseImportService,
    versionService,
    appriseService,
    compile,
    build,
  };
};
