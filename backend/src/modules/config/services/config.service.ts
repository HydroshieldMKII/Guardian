import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { Session } from '@/entities/session.entity';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { VersionService } from '@/modules/config/services/version.service';
import {
  parseSettingValue,
  toStoredValue,
} from '@/modules/config/services/setting-values';
import {
  isReadOnlySetting,
  validateSettingValue,
} from '@/modules/config/services/setting-validation';
import {
  isSecretMask,
  toPublicSetting,
} from '@/modules/config/services/public-setting';
import { serialTransaction } from '@/database/serial-transaction';
import {
  SETTINGS_CATALOG,
  SETTING_KEYS,
  SettingKey,
  SettingValue,
  SettingValues,
  isSettingKey,
} from '@/modules/config/settings.catalog';

export interface SettingWrite {
  key: string;
  value: unknown;
}

interface PendingWrite {
  key: SettingKey;
  stringValue: string;
}

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private cache = new Map<SettingKey, SettingValue>();
  private configChangeListeners = new Map<string, Array<() => void>>();

  constructor(
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private readonly timezoneService: TimezoneService,
    private readonly versionService: VersionService,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultSettings();
  }

  async reloadSettings(): Promise<void> {
    await this.loadCache();
  }

  async restoreDefaultSettings(): Promise<void> {
    this.cache.clear();
    await this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    await this.updateAppVersionIfNewer();

    for (const key of SETTING_KEYS) {
      const existing = await this.settingsRepository.findOne({
        where: { key },
      });

      if (!existing) {
        await this.settingsRepository.save({ key, ...this.defaultFor(key) });
        this.logger.log(`Initialized default setting: ${key}`);
      }
    }

    await this.loadCache();
  }

  private defaultFor(key: SettingKey) {
    const definition = SETTINGS_CATALOG[key];
    return {
      ...definition,
      value:
        key === 'APP_VERSION'
          ? this.versionService.getCurrentAppVersion()
          : definition.value,
    };
  }

  private async loadCache() {
    const settings = await this.settingsRepository.find();
    for (const setting of settings) {
      if (!isSettingKey(setting.key)) {
        continue;
      }
      this.cache.set(
        setting.key,
        parseSettingValue(setting.value, setting.type, setting.key),
      );
    }
  }

  addConfigChangeListener(key: string, callback: () => void) {
    if (!this.configChangeListeners.has(key)) {
      this.configChangeListeners.set(key, []);
    }
    this.configChangeListeners.get(key)!.push(callback);
  }

  removeConfigChangeListener(key: string, callback: () => void) {
    const listeners = this.configChangeListeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyConfigChange(key: string) {
    const listeners = this.configChangeListeners.get(key);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          this.logger.error(
            `Error calling config change listener for ${key}:`,
            error,
          );
        }
      });
    }
  }

  async getAllSettings(): Promise<AppSettings[]> {
    return this.settingsRepository.find({
      order: { key: 'ASC' },
    });
  }

  async getPublicSettings(): Promise<AppSettings[]> {
    const settings = await this.settingsRepository.find({
      order: { key: 'ASC' },
    });

    return settings.map(toPublicSetting);
  }

  async getPublicSetting(key: SettingKey): Promise<AppSettings | null> {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    return setting ? toPublicSetting(setting) : null;
  }

  async getSetting<K extends SettingKey>(
    key: K,
  ): Promise<SettingValues[K] | null> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached as SettingValues[K];
    }

    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) return null;

    const value = parseSettingValue(setting.value, setting.type, key);
    this.cache.set(key, value);
    return value as SettingValues[K];
  }

  async updateSetting(key: SettingKey, value: unknown): Promise<AppSettings> {
    const [updated] = await this.updateMultipleSettings([{ key, value }]);
    return updated;
  }

  async updateMultipleSettings(
    settings: SettingWrite[],
  ): Promise<AppSettings[]> {
    const pending = this.prepareWrites(settings);
    const written = await serialTransaction(
      this.settingsRepository.manager,
      async (manager) => {
        const repository = manager.getRepository(AppSettings);
        const rows: Array<{
          row: AppSettings;
          stringValue: string;
          changed: boolean;
        }> = [];
        for (const { key, stringValue } of pending) {
          const row = await repository.findOne({ where: { key } });
          if (!row) {
            throw new NotFoundException(`Setting ${key} not found`);
          }
          if (isSecretMask(row, stringValue)) {
            rows.push({ row, stringValue, changed: false });
            continue;
          }
          row.value = stringValue;
          row.updatedAt = new Date();
          rows.push({
            row: await repository.save(row),
            stringValue,
            changed: true,
          });
        }
        return rows;
      },
    );

    for (const { row, stringValue, changed } of written) {
      if (changed) await this.applyWrittenSetting(row, stringValue);
    }

    return written.map(({ row }) => toPublicSetting(row));
  }

  private prepareWrites(settings: SettingWrite[]): PendingWrite[] {
    const seen = new Set<string>();
    return settings.map(({ key, value }) => {
      if (!isSettingKey(key)) {
        throw new BadRequestException('Unknown setting');
      }
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate setting ${key}`);
      }
      seen.add(key);
      if (isReadOnlySetting(key)) {
        throw new BadRequestException(`Setting ${key} is read-only`);
      }
      if (typeof value === 'object' || value === undefined) {
        throw new BadRequestException(
          'Setting value must be a string, number or boolean',
        );
      }
      const stringValue = toStoredValue(value);
      validateSettingValue(key, stringValue);
      return { key, stringValue };
    });
  }

  private async applyWrittenSetting(
    row: AppSettings,
    stringValue: string,
  ): Promise<void> {
    const key = row.key as SettingKey;
    this.cache.set(key, parseSettingValue(stringValue, row.type, key));

    if (key === 'TIMEZONE') {
      this.logTimezoneChange(stringValue);
    } else {
      this.logger.log(`Updated setting: ${key}`);
    }

    if (key === 'USER_PORTAL_ENABLED' && stringValue === 'false') {
      const revokedCount = await this.revokeAllPlexUserSessions();
      if (revokedCount > 0) {
        this.logger.log(
          `User portal disabled - revoked ${revokedCount} Plex user session(s)`,
        );
      }
    }

    this.notifyConfigChange(key);
  }

  private logTimezoneChange(timezoneOffset: string): void {
    const currentTime =
      this.timezoneService.getCurrentTimeInTimezone(timezoneOffset);
    this.logger.log(
      `Timezone updated to ${timezoneOffset}. Current time in this timezone: ${currentTime.toLocaleString(
        'en-US',
        {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'UTC',
        },
      )}`,
    );
  }

  private async revokeAllPlexUserSessions(): Promise<number> {
    const result = await this.sessionRepository.delete({
      userType: 'plex_user',
    });

    return result.affected || 0;
  }

  async getTimezone(): Promise<string> {
    const timezone = await this.getSetting('TIMEZONE');
    return timezone || '+00:00';
  }

  async getCurrentTimeInTimezone(): Promise<Date> {
    const timezoneOffset = await this.getTimezone();
    return this.timezoneService.getCurrentTimeInTimezone(timezoneOffset);
  }

  private async updateAppVersionIfNewer(): Promise<void> {
    const versionSetting = await this.settingsRepository.findOne({
      where: { key: 'APP_VERSION' },
    });

    if (versionSetting) {
      await this.versionService.updateAppVersionIfNewer(
        versionSetting.value,
        async (newVersion: string) => {
          versionSetting.value = newVersion;
          await this.settingsRepository.save(versionSetting);
        },
      );
    }
  }

  async getVersionInfo(): Promise<{
    version: string;
    databaseVersion: string;
    codeVersion: string;
    isVersionMismatch: boolean;
  }> {
    const dbVersion =
      (await this.getSetting('APP_VERSION')) ||
      this.versionService.getCurrentAppVersion();
    return this.versionService.getVersionInfo(dbVersion);
  }
}
