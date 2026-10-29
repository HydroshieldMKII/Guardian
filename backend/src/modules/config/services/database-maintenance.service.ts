import { Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config/services/config.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import {
  DatabaseImportService,
  ImportResult,
} from '@/modules/config/services/database-import.service';
import { VersionService } from '@/modules/config/services/version.service';
import {
  clampSettingValue,
  validateSettingValue,
} from '@/modules/config/services/setting-validation';
import { isSettingKey, SETTING_KEYS } from '@/modules/config/settings.catalog';

@Injectable()
export class DatabaseMaintenanceService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly databaseImportService: DatabaseImportService,
    private readonly versionService: VersionService,
  ) {}

  async exportDatabase(): Promise<string> {
    const appVersion = await this.configService.getSetting('APP_VERSION');
    return this.databaseService.exportDatabase(appVersion ?? '');
  }

  async importDatabase(importData: unknown): Promise<ImportResult> {
    const { changedSettings, ...result } =
      await this.databaseImportService.importDatabase(importData, {
        currentAppVersion: this.versionService.getCurrentAppVersion(),
        compareVersions: (v1, v2) =>
          this.versionService.compareVersions(v1, v2),
        prepareSetting: (key, value) => {
          if (!isSettingKey(key)) return value;
          const clamped = clampSettingValue(key, value);
          validateSettingValue(key, clamped);
          return clamped;
        },
      });

    await this.configService.applyStoredSettings(
      changedSettings.map(({ key }) => key),
    );
    return result;
  }

  async resetDatabase(): Promise<void> {
    await this.databaseService.resetDatabase();
    await this.configService.restoreDefaultSettings();
    await this.configService.applyStoredSettings(SETTING_KEYS);
  }
}
