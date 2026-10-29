import { Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config/services/config.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import {
  DatabaseImportService,
  ImportPayload,
  ImportResult,
} from '@/modules/config/services/database-import.service';
import { VersionService } from '@/modules/config/services/version.service';
import { validateSettingValue } from '@/modules/config/services/setting-validation';
import { isSettingKey } from '@/modules/config/settings.catalog';

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

  async importDatabase(
    importData: ImportPayload | null | undefined,
  ): Promise<ImportResult> {
    const result = await this.databaseImportService.importDatabase(importData, {
      currentAppVersion: this.versionService.getCurrentAppVersion(),
      compareVersions: (v1, v2) => this.versionService.compareVersions(v1, v2),
      validateSetting: (key, value) => {
        if (isSettingKey(key)) validateSettingValue(key, value);
      },
    });

    await this.configService.reloadSettings();
    return result;
  }

  async resetDatabase(): Promise<void> {
    await this.databaseService.resetDatabase();
    await this.configService.restoreDefaultSettings();
  }
}
