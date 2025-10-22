import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '../../../entities/app-settings.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { Notification } from '../../../entities/notification.entity';

export interface ExportData {
  exportedAt: string;
  version: string;
  data: {
    settings: AppSettings[];
    userDevices: UserDevice[];
    userPreferences: UserPreference[];
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

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

  async importDatabase(
    importData: any,
    currentAppVersion: string,
    compareVersions: (v1: string, v2: string) => number,
  ): Promise<ImportResult> {
    try {
      this.logger.log('Starting database import...');

      if (!importData || !importData.data) {
        throw new Error('Invalid import data format');
      }

      const { data } = importData;
      let imported = 0;
      let skipped = 0;

      this.logger.debug('Import data contains:', {
        settings: data.settings?.length || 0,
        userDevices: data.userDevices?.length || 0,
        userPreferences: data.userPreferences?.length || 0,
      });

      // Import settings
      if (data.settings && Array.isArray(data.settings)) {
        const settingsResult = await this.importSettings(
          data.settings,
          currentAppVersion,
          compareVersions,
        );
        imported += settingsResult.imported;
        skipped += settingsResult.skipped;
      }

      // Import user devices
      if (data.userDevices && Array.isArray(data.userDevices)) {
        const devicesResult = await this.importUserDevices(data.userDevices);
        imported += devicesResult.imported;
        skipped += devicesResult.skipped;
      }

      // Import user preferences
      if (data.userPreferences && Array.isArray(data.userPreferences)) {
        const preferencesResult = await this.importUserPreferences(
          data.userPreferences,
        );
        imported += preferencesResult.imported;
        skipped += preferencesResult.skipped;
      }

      this.logger.log(
        `Database import completed: ${imported} items imported, ${skipped} items skipped`,
      );

      return { imported, skipped };
    } catch (error) {
      this.logger.error('Error importing database:', error);
      throw new Error(`Failed to import database: ${error.message}`);
    }
  }

  private async importSettings(
    settings: any[],
    currentAppVersion: string,
    compareVersions: (v1: string, v2: string) => number,
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;

    for (const setting of settings) {
      try {
        const existing = await this.settingsRepository.findOne({
          where: { key: setting.key },
        });

        // Skip importing APP_VERSION if the import file has an older version than the current code
        if (
          setting.key === 'APP_VERSION' &&
          compareVersions(setting.value, currentAppVersion) < 0
        ) {
          this.logger.log(
            `Skipping import of APP_VERSION (${setting.value}) to avoid downgrading from current version (${currentAppVersion})`,
          );
          skipped++;
          continue;
        }

        this.logger.debug(
          'Importing setting:',
          setting.key,
          'Existing:',
          !!existing,
        );

        if (existing) {
          existing.value = setting.value;
          await this.settingsRepository.save(existing);
          imported++;
        } else {
          this.logger.warn(`Skipping unknown setting ${setting.key}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to import setting ${setting.key}:`, error);
        skipped++;
      }
    }

    return { imported, skipped };
  }

  private async importUserDevices(devices: any[]): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;

    const deviceRepo =
      this.settingsRepository.manager.getRepository(UserDevice);

    for (const device of devices) {
      try {
        const existing = await deviceRepo.findOne({
          where: {
            userId: device.userId,
            deviceIdentifier: device.deviceIdentifier,
          },
        });

        this.logger.debug(
          `Importing device ${device.deviceIdentifier} for user ${device.userId}, existing:`,
          !!existing,
        );

        if (!existing) {
          const newDevice = deviceRepo.create(device);
          await deviceRepo.save(newDevice);
          imported++;
          this.logger.debug(`Created new device: ${device.deviceIdentifier}`);
        } else {
          // Update existing device with new data
          Object.assign(existing, device);
          await deviceRepo.save(existing);
          imported++;
          this.logger.debug(
            `Updated existing device: ${device.deviceIdentifier}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to import device ${device.deviceIdentifier}:`,
          error,
        );
        skipped++;
      }
    }

    return { imported, skipped };
  }

  private async importUserPreferences(
    preferences: any[],
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;

    const prefRepo =
      this.settingsRepository.manager.getRepository(UserPreference);

    for (const pref of preferences) {
      try {
        const existing = await prefRepo.findOne({
          where: { userId: pref.userId },
        });

        this.logger.debug(
          `Importing preference for user ${pref.userId}, existing:`,
          !!existing,
        );

        if (!existing) {
          const newPref = prefRepo.create(pref);
          await prefRepo.save(newPref);
          imported++;
          this.logger.debug(`Created new preference for user: ${pref.userId}`);
        } else {
          // Update existing preference
          existing.defaultBlock = pref.defaultBlock;
          existing.username = pref.username || existing.username;
          await prefRepo.save(existing);
          imported++;
          this.logger.debug(
            `Updated existing preference for user: ${pref.userId}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to import preference for user ${pref.userId}:`,
          error,
        );
        skipped++;
      }
    }

    return { imported, skipped };
  }

  async resetDatabase(): Promise<void> {
    try {
      this.logger.warn('RESETTING ALL DATABASE TABLES');

      await this.settingsRepository.manager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .clear();
          this.logger.debug('Session history table cleared');

          await transactionalEntityManager.getRepository(Notification).clear();
          this.logger.debug('Notifications table cleared');

          await transactionalEntityManager
            .getRepository(UserPreference)
            .clear();
          this.logger.debug('User preferences table cleared');

          await transactionalEntityManager.getRepository(UserDevice).clear();
          this.logger.debug('User devices table cleared');

          await transactionalEntityManager.getRepository(AppSettings).clear();
          this.logger.debug('App settings table cleared');
        },
      );

      this.logger.warn(
        'Database reset completed - all data has been deleted and default settings restored',
      );
    } catch (error) {
      this.logger.error('Failed to reset database:', error);
      throw new Error(`Database reset failed: ${error.message}`);
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
          currentSessionKey: () => 'NULL',
        })
        .execute();

      this.logger.log(
        `Stream counts reset for ${result.affected || 0} devices`,
      );
    } catch (error) {
      this.logger.error('Failed to reset stream counts:', error);
      throw new Error(`Stream count reset failed: ${error.message}`);
    }
  }

  async deleteAllDevices(): Promise<void> {
    try {
      this.logger.warn('DELETING ALL DEVICES per user request');

      const deviceCount = await this.settingsRepository.manager
        .getRepository(UserDevice)
        .count();

      await this.settingsRepository.manager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .clear();
          this.logger.debug('Session history cleared');

          await transactionalEntityManager.getRepository(Notification).clear();
          this.logger.debug('Notifications cleared');

          await transactionalEntityManager.getRepository(UserDevice).clear();
          this.logger.debug('User devices cleared');
        },
      );

      this.logger.warn(
        `All ${deviceCount} devices and related data have been deleted`,
      );
    } catch (error) {
      this.logger.error('Failed to delete all devices:', error);
      throw new Error(`Device deletion failed: ${error.message}`);
    }
  }

  async clearAllSessionHistory(): Promise<void> {
    try {
      this.logger.warn('CLEARING ALL SESSION HISTORY per user request');

      const sessionCount = await this.settingsRepository.manager
        .getRepository(SessionHistory)
        .count();

      await this.settingsRepository.manager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .clear();
          this.logger.debug('Session history cleared');
        },
      );

      this.logger.warn(
        `All ${sessionCount} session history records have been cleared`,
      );
    } catch (error) {
      this.logger.error('Failed to clear session history:', error);
      throw new Error(`Session history clearing failed: ${error.message}`);
    }
  }
}
