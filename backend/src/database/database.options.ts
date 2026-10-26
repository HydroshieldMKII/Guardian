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
    migrations: [path.join(__dirname, '..', 'migrations', '*{.ts,.js}')],
    migrationsRun: true,
  };
}
