import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { serialTransaction } from '@/database/serial-transaction';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import {
  ImportedDevice,
  ImportedPreference,
  ImportedSetting,
  parseImportPayload,
} from '@/modules/config/services/import-payload';
import { isSecretMask } from '@/modules/config/services/public-setting';

export interface ImportResult {
  imported: number;
  skipped: number;
}

export interface AppliedSetting {
  key: string;
  value: string;
}

export interface ImportOutcome extends ImportResult {
  changedSettings: AppliedSetting[];
}

export interface ImportRules {
  currentAppVersion: string;
  compareVersions: (v1: string, v2: string) => number;
  prepareSetting: (key: string, value: string) => string;
}

type SettingOutcome = AppliedSetting | 'unchanged' | 'skipped';

@Injectable()
export class DatabaseImportService {
  private readonly logger = new Logger(DatabaseImportService.name);

  constructor(
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
  ) {}

  async importDatabase(
    rawPayload: unknown,
    rules: ImportRules,
  ): Promise<ImportOutcome> {
    this.logger.log('Starting database import...');

    const { settings, devices, preferences } = parseImportPayload(rawPayload);

    this.logger.debug('Import data contains:', {
      settings: settings.length,
      userDevices: devices.length,
      userPreferences: preferences.length,
    });

    const outcome = await serialTransaction(
      this.settingsRepository.manager,
      async (manager) => {
        const settingOutcomes: SettingOutcome[] = [];
        for (const setting of settings) {
          settingOutcomes.push(
            await this.importSetting(manager, setting, rules),
          );
        }
        for (const device of devices) {
          await this.importDevice(manager, device);
        }
        for (const preference of preferences) {
          await this.importPreference(manager, preference);
        }
        return settingOutcomes;
      },
    );

    const skipped = outcome.filter((entry) => entry === 'skipped').length;
    const imported =
      outcome.length - skipped + devices.length + preferences.length;
    const changedSettings = outcome.filter(
      (entry): entry is AppliedSetting => typeof entry === 'object',
    );

    this.logger.log(
      `Database import completed: ${imported} items imported, ${skipped} items skipped`,
    );

    return { imported, skipped, changedSettings };
  }

  private async importSetting(
    manager: EntityManager,
    setting: ImportedSetting,
    rules: ImportRules,
  ): Promise<SettingOutcome> {
    if (
      setting.key === 'APP_VERSION' &&
      rules.compareVersions(setting.value, rules.currentAppVersion) < 0
    ) {
      this.logger.log(
        `Skipping import of APP_VERSION (${setting.value}) to avoid downgrading from current version (${rules.currentAppVersion})`,
      );
      return 'skipped';
    }

    const repository = manager.getRepository(AppSettings);
    const existing = await repository.findOne({ where: { key: setting.key } });

    if (!existing) {
      this.logger.warn(`Skipping unknown setting ${setting.key}`);
      return 'skipped';
    }

    if (isSecretMask(existing, setting.value)) {
      return 'unchanged';
    }

    let value: string;
    try {
      value = rules.prepareSetting(setting.key, setting.value);
    } catch (error) {
      this.logger.warn(`Skipping invalid setting ${setting.key}:`, error);
      return 'skipped';
    }

    if (value !== setting.value) {
      this.logger.warn(
        `Adjusted ${setting.key} from ${setting.value} to ${value} to fit the allowed range`,
      );
    }

    const changed = existing.value !== value;
    existing.value = value;
    await repository.save(existing);
    return changed ? { key: setting.key, value } : 'unchanged';
  }

  private async importDevice(
    manager: EntityManager,
    device: ImportedDevice,
  ): Promise<void> {
    const repository = manager.getRepository(UserDevice);
    const existing = await repository.findOne({
      where: {
        userId: device.userId,
        deviceIdentifier: device.deviceIdentifier,
      },
    });

    await repository.save(
      existing ? Object.assign(existing, device) : repository.create(device),
    );
    this.logger.debug(
      `${existing ? 'Updated' : 'Created'} device ${device.deviceIdentifier} for user ${device.userId}`,
    );
  }

  private async importPreference(
    manager: EntityManager,
    preference: ImportedPreference,
  ): Promise<void> {
    const repository = manager.getRepository(UserPreference);
    const existing = await repository.findOne({
      where: { userId: preference.userId },
    });

    if (existing) {
      existing.defaultBlock = preference.defaultBlock ?? null;
      existing.username = preference.username || existing.username;
    }

    await repository.save(existing ?? repository.create(preference));
    this.logger.debug(
      `${existing ? 'Updated' : 'Created'} preference for user ${preference.userId}`,
    );
  }
}
