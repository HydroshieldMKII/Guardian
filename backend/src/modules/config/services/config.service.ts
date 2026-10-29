import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { validateSettingValue } from '@/modules/config/services/setting-validation';
import {
  SETTINGS_CATALOG,
  SETTING_KEYS,
  SettingKey,
  SettingValue,
  SettingValues,
  isSettingKey,
} from '@/modules/config/settings.catalog';

export interface ConfigSettingDto {
  key: SettingKey;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  private?: boolean;
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

    return settings.map((setting) => ({
      id: setting.id,
      key: setting.key,
      type: setting.type,
      private: setting.private,
      updatedAt: setting.updatedAt,
      value: setting.private && setting.value ? '••••••••' : setting.value,
    }));
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
    const stringValue = toStoredValue(value);
    validateSettingValue(key, stringValue);
    return this.writeSetting(key, stringValue);
  }

  private async writeSetting(
    key: SettingKey,
    stringValue: string,
  ): Promise<AppSettings> {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) {
      throw new Error(`Setting ${key} not found`);
    }

    setting.value = stringValue;
    setting.updatedAt = new Date();

    const updated = await this.settingsRepository.save(setting);

    this.cache.set(key, parseSettingValue(stringValue, setting.type, key));

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

    return updated;
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

  async updateMultipleSettings(
    settings: ConfigSettingDto[],
  ): Promise<AppSettings[]> {
    const pending = settings.map(({ key, value }) => {
      const stringValue = toStoredValue(value);
      validateSettingValue(key, stringValue);
      return { key, stringValue };
    });

    const results: AppSettings[] = [];

    for (const { key, stringValue } of pending) {
      try {
        const updated = await this.writeSetting(key, stringValue);
        results.push(updated);
      } catch (error) {
        this.logger.error(`Failed to update setting ${key}:`, error);
        throw error;
      }
    }

    return results;
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
