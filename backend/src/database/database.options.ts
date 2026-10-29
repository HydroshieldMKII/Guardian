import * as path from 'path';
import { DataSourceOptions } from 'typeorm';
import { config } from '@/config/app.config';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { AppSettings } from '@/entities/app-settings.entity';
import { Notification } from '@/entities/notification.entity';
import { UserTimeRule } from '@/entities/user-time-rule.entity';
import { AdminUser } from '@/entities/admin-user.entity';
import { Session } from '@/entities/session.entity';
import { PasswordResetToken } from '@/entities/password-reset-token.entity';
import { RemoveOldSmtpSetting1729870958000 } from '@/migrations/20251025-remove-old-smtp-setting';
import { BaselineSchema1792972800000 } from '@/migrations/20261026-baseline-schema';
import { RaiseRefreshIntervalMinimum1793145600000 } from '@/migrations/20261028-raise-refresh-interval-minimum';
import { LowercaseAdminEmails1793232000000 } from '@/migrations/20261029-lowercase-admin-emails';
import { OpenEmptyIpAllowLists1793235600000 } from '@/migrations/20261029-open-empty-ip-allow-lists';

export const ENTITIES = [
  UserDevice,
  SessionHistory,
  UserPreference,
  AppSettings,
  Notification,
  UserTimeRule,
  AdminUser,
  Session,
  PasswordResetToken,
];

export const MIGRATIONS = [
  RemoveOldSmtpSetting1729870958000,
  BaselineSchema1792972800000,
  RaiseRefreshIntervalMinimum1793145600000,
  LowercaseAdminEmails1793232000000,
  OpenEmptyIpAllowLists1793235600000,
];

export function databasePath(): string {
  return (
    process.env.DATABASE_PATH || path.join(process.cwd(), config.database.path)
  );
}

export function databaseOptions(database: string): DataSourceOptions {
  return {
    type: 'sqlite',
    database,
    entities: ENTITIES,
    synchronize: false,
    logging: config.database.logging,
    migrations: MIGRATIONS,
    migrationsRun: true,
  };
}
