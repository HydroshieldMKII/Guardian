import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { Notification } from '@/entities/notification.entity';
import { serialTransaction } from '@/database/serial-transaction';

export interface ExportData {
  exportedAt: string;
  version: string;
  data: {
    settings: AppSettings[];
    userDevices: UserDevice[];
    userPreferences: UserPreference[];
  };
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface ClearableTable {
  target: EntityTarget<ObjectLiteral>;
  label: string;
}

const SESSION_HISTORY_TABLE: ClearableTable = {
  target: SessionHistory,
  label: 'Session history',
};
const NOTIFICATIONS_TABLE: ClearableTable = {
  target: Notification,
  label: 'Notifications',
};
const USER_DEVICES_TABLE: ClearableTable = {
  target: UserDevice,
  label: 'User devices',
};

const ALL_TABLES: ClearableTable[] = [
  SESSION_HISTORY_TABLE,
  NOTIFICATIONS_TABLE,
  { target: UserPreference, label: 'User preferences' },
  USER_DEVICES_TABLE,
  { target: AppSettings, label: 'App settings' },
  { target: 'sessions', label: 'Sessions' },
  { target: 'admin_users', label: 'Admin users' },
];

const DEVICE_TABLES: ClearableTable[] = [
  SESSION_HISTORY_TABLE,
  NOTIFICATIONS_TABLE,
  USER_DEVICES_TABLE,
];

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
  ) {}

  async exportDatabase(appVersion: string): Promise<string> {
    try {
      this.logger.log('Starting database export...');

      const [settings, userDevices, userPreferences] = await Promise.all([
        this.settingsRepository.find(),
        this.settingsRepository.manager.getRepository(UserDevice).find(),
        this.settingsRepository.manager.getRepository(UserPreference).find(),
      ]);

      const exportData: ExportData = {
        exportedAt: new Date().toISOString(),
        version: appVersion,
        data: {
          settings,
          userDevices,
          userPreferences,
        },
      };

      this.logger.log(
        `Database export completed: ${settings.length} settings, ${userDevices.length} devices, ${userPreferences.length} preferences`,
      );

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.logger.error('Error exporting database:', error);
      throw new Error('Failed to export database');
    }
  }

  async resetDatabase(): Promise<void> {
    try {
      this.logger.warn('RESETTING ALL DATABASE TABLES');
      await this.clearTables(ALL_TABLES);
      this.logger.warn(
        'Database reset completed - all data has been deleted and default settings restored',
      );
    } catch (error) {
      this.logger.error('Failed to reset database:', error);
      throw new Error(`Database reset failed: ${describeError(error)}`);
    }
  }

  async resetStreamCounts(): Promise<void> {
    try {
      this.logger.warn('Resetting all device stream counts');

      const result = await this.settingsRepository.manager
        .getRepository(UserDevice)
        .createQueryBuilder()
        .update(UserDevice)
        .set({
          sessionCount: 0,
          currentSessionKey: null,
        })
        .execute();

      this.logger.log(
        `Stream counts reset for ${result.affected || 0} devices`,
      );
    } catch (error) {
      this.logger.error('Failed to reset stream counts:', error);
      throw new Error(`Stream count reset failed: ${describeError(error)}`);
    }
  }

  async deleteAllDevices(): Promise<void> {
    try {
      this.logger.warn('DELETING ALL DEVICES per user request');

      const deviceCount = await this.settingsRepository.manager
        .getRepository(UserDevice)
        .count();
      await this.clearTables(DEVICE_TABLES);

      this.logger.warn(
        `All ${deviceCount} devices and related data have been deleted`,
      );
    } catch (error) {
      this.logger.error('Failed to delete all devices:', error);
      throw new Error(`Device deletion failed: ${describeError(error)}`);
    }
  }

  async clearAllSessionHistory(): Promise<void> {
    try {
      this.logger.warn('CLEARING ALL SESSION HISTORY per user request');

      const sessionCount = await this.settingsRepository.manager
        .getRepository(SessionHistory)
        .count();
      await this.clearTables([SESSION_HISTORY_TABLE]);

      this.logger.warn(
        `All ${sessionCount} session history records have been cleared`,
      );
    } catch (error) {
      this.logger.error('Failed to clear session history:', error);
      throw new Error(
        `Session history clearing failed: ${describeError(error)}`,
      );
    }
  }

  private async clearTables(tables: ClearableTable[]): Promise<void> {
    await serialTransaction(
      this.settingsRepository.manager,
      async (manager) => {
        for (const { target, label } of tables) {
          await manager.getRepository(target).clear();
          this.logger.debug(`${label} table cleared`);
        }
      },
    );
  }
}
