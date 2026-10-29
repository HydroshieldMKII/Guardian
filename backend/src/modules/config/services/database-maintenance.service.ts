import { Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config/services/config.service';
import {
  DatabaseService,
  ImportPayload,
} from '@/modules/config/services/database.service';
import { VersionService } from '@/modules/config/services/version.service';
import { validateSettingValue } from '@/modules/config/services/setting-validation';
import { isSettingKey } from '@/modules/config/settings.catalog';

@Injectable()
export class DatabaseMaintenanceService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly versionService: VersionService,
  ) {}

  async exportDatabase(): Promise<string> {
    const appVersion = await this.configService.getSetting('APP_VERSION');
    return this.databaseService.exportDatabase(appVersion ?? '');
  }

  async importDatabase(
    importData: ImportPayload | null | undefined,
  ): Promise<{ imported: number; skipped: number }> {
    const result = await this.databaseService.importDatabase(
      importData,
      this.versionService.getCurrentAppVersion(),
      (v1: string, v2: string) => this.versionService.compareVersions(v1, v2),
      (key: string, value: string) => {
        if (isSettingKey(key)) validateSettingValue(key, value);
      },
    );

    await this.configService.reloadSettings();
    return result;
  }

  async resetDatabase(): Promise<void> {
    await this.databaseService.resetDatabase();
    await this.configService.restoreDefaultSettings();
  }
}
