import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';

export interface ImportResult {
  imported: number;
  skipped: number;
}

interface ImportedSetting {
  key: string;
  value: string;
}

export interface ImportPayload {
  data?: {
    settings?: ImportedSetting[];
    userDevices?: Partial<UserDevice>[];
    userPreferences?: Partial<UserPreference>[];
  };
}

export interface ImportRules {
  currentAppVersion: string;
  compareVersions: (v1: string, v2: string) => number;
  prepareSetting: (key: string, value: string) => string;
}

const asList = <T>(items: T[] | undefined): T[] =>
  Array.isArray(items) ? items : [];

@Injectable()
export class DatabaseImportService {
  private readonly logger = new Logger(DatabaseImportService.name);

  constructor(
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
  ) {}

  async importDatabase(
    importData: ImportPayload | null | undefined,
    rules: ImportRules,
  ): Promise<ImportResult> {
    this.logger.log('Starting database import...');

    if (!importData?.data) {
      this.logger.error('Error importing database: invalid import data format');
      throw new Error('Failed to import database: Invalid import data format');
    }

    const { data } = importData;
    const settings = asList(data.settings);
    const devices = asList(data.userDevices);
    const preferences = asList(data.userPreferences);

    this.logger.debug('Import data contains:', {
      settings: settings.length,
      userDevices: devices.length,
      userPreferences: preferences.length,
    });

    const results = [
      await this.importEach(
        settings,
        (setting) => `setting ${setting.key}`,
        (setting) => this.importSetting(setting, rules),
      ),
      await this.importEach(
        devices,
        (device) => `device ${device.deviceIdentifier}`,
        (device) => this.importDevice(device),
      ),
      await this.importEach(
        preferences,
        (preference) => `preference for user ${preference.userId}`,
        (preference) => this.importPreference(preference),
      ),
    ];

    const imported = results.reduce((sum, r) => sum + r.imported, 0);
    const skipped = results.reduce((sum, r) => sum + r.skipped, 0);

    this.logger.log(
      `Database import completed: ${imported} items imported, ${skipped} items skipped`,
    );

    return { imported, skipped };
  }

  private async importEach<T>(
    items: T[],
    describe: (item: T) => string,
    importOne: (item: T) => Promise<boolean>,
  ): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, skipped: 0 };

    for (const item of items) {
      try {
        if (await importOne(item)) {
          result.imported++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        this.logger.warn(`Failed to import ${describe(item)}:`, error);
        result.skipped++;
      }
    }

    return result;
  }

  private async importSetting(
    setting: ImportedSetting,
    rules: ImportRules,
  ): Promise<boolean> {
    const existing = await this.settingsRepository.findOne({
      where: { key: setting.key },
    });

    if (
      setting.key === 'APP_VERSION' &&
      rules.compareVersions(setting.value, rules.currentAppVersion) < 0
    ) {
      this.logger.log(
        `Skipping import of APP_VERSION (${setting.value}) to avoid downgrading from current version (${rules.currentAppVersion})`,
      );
      return false;
    }

    if (!existing) {
      this.logger.warn(`Skipping unknown setting ${setting.key}`);
      return false;
    }

    const value = rules.prepareSetting(setting.key, setting.value);
    if (value !== setting.value) {
      this.logger.warn(
        `Adjusted ${setting.key} from ${setting.value} to ${value} to fit the allowed range`,
      );
    }
    existing.value = value;
    await this.settingsRepository.save(existing);
    return true;
  }

  private async importDevice(device: Partial<UserDevice>): Promise<boolean> {
    const deviceRepo =
      this.settingsRepository.manager.getRepository(UserDevice);
    const existing = await deviceRepo.findOne({
      where: {
        userId: device.userId,
        deviceIdentifier: device.deviceIdentifier,
      },
    });

    await deviceRepo.save(
      existing ? Object.assign(existing, device) : deviceRepo.create(device),
    );
    this.logger.debug(
      `${existing ? 'Updated' : 'Created'} device ${device.deviceIdentifier} for user ${device.userId}`,
    );
    return true;
  }

  private async importPreference(
    preference: Partial<UserPreference>,
  ): Promise<boolean> {
    const prefRepo =
      this.settingsRepository.manager.getRepository(UserPreference);
    const existing = await prefRepo.findOne({
      where: { userId: preference.userId },
    });

    if (existing) {
      existing.defaultBlock = preference.defaultBlock ?? null;
      existing.username = preference.username || existing.username;
    }

    await prefRepo.save(existing ?? prefRepo.create(preference));
    this.logger.debug(
      `${existing ? 'Updated' : 'Created'} preference for user ${preference.userId}`,
    );
    return true;
  }
}
