import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '@/entities/app-settings.entity';
import { Session } from '@/entities/session.entity';
import { PlexResponse, PlexErrorCode } from '@/types/plex-errors';
import { EmailService } from '@/modules/config/services/email.service';
import { EmailTemplateService } from '@/modules/config/services/email-template.service';
import { PlexConnectionService } from '@/modules/config/services/plex-connection.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import {
  DatabaseService,
  ImportPayload,
} from '@/modules/config/services/database.service';
import { VersionService } from '@/modules/config/services/version.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import {
  SETTINGS_CATALOG,
  SETTING_KEYS,
  SettingKey,
  SettingValue,
  SettingValues,
  isSettingKey,
} from '@/modules/config/settings.catalog';
import { errorMessage } from '@/common/utils/error-types';

export interface ConfigSettingDto {
  key: SettingKey;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  private?: boolean;
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private cache = new Map<SettingKey, SettingValue>();
  private configChangeListeners = new Map<string, Array<() => void>>();

  constructor(
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly plexConnectionService: PlexConnectionService,
    private readonly timezoneService: TimezoneService,
    private readonly databaseService: DatabaseService,
    private readonly versionService: VersionService,
    private readonly appriseService: AppriseService,
  ) {
    void this.initializeDefaultSettings();
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

  private parseSettingValue(
    value: string | null,
    type: string,
    key?: string,
  ): SettingValue {
    if (type === 'boolean') {
      return value === 'true';
    } else if (type === 'number') {
      return parseFloat(value ?? '');
    } else if (type === 'json') {
      try {
        return JSON.parse(value ?? 'null') as SettingValue;
      } catch {
        if (key) {
          this.logger.warn(`Failed to parse JSON for ${key}: ${value}`);
        }
        return value ?? '';
      }
    }
    return value ?? '';
  }

  private validateEmailFormat(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private async loadCache() {
    const settings = await this.settingsRepository.find();
    for (const setting of settings) {
      if (!isSettingKey(setting.key)) {
        continue;
      }
      this.cache.set(
        setting.key,
        this.parseSettingValue(setting.value, setting.type, setting.key),
      );
    }
  }

  // Add listener for config changes
  addConfigChangeListener(key: string, callback: () => void) {
    if (!this.configChangeListeners.has(key)) {
      this.configChangeListeners.set(key, []);
    }
    this.configChangeListeners.get(key)!.push(callback);
  }

  // Remove listener for config changes
  removeConfigChangeListener(key: string, callback: () => void) {
    const listeners = this.configChangeListeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Notify listeners of config changes
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

    // Timezone changes are now logged directly in updateSetting method
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
      value: setting.private ? '••••••••' : setting.value,
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

    const value = this.parseSettingValue(setting.value, setting.type, key);
    this.cache.set(key, value);
    return value as SettingValues[K];
  }

  private validateInteger(
    value: string,
    messages: { notANumber: string; notWhole: string; outOfRange: string },
    range: { min: number; max?: number },
  ): void {
    const parsed = Number(value);

    if (isNaN(parsed)) {
      throw new Error(messages.notANumber);
    }
    if (!Number.isInteger(parsed)) {
      throw new Error(messages.notWhole);
    }
    if (parsed < range.min || (range.max !== undefined && parsed > range.max)) {
      throw new Error(messages.outOfRange);
    }
  }

  private validateSettingValue(key: SettingKey, value: string): void {
    const validators: Partial<Record<SettingKey, () => void>> = {
      DEVICE_CLEANUP_INTERVAL_DAYS: () =>
        this.validateInteger(
          value,
          {
            notANumber: 'Device cleanup interval must be a number',
            notWhole:
              'Device cleanup interval must be a whole number (no decimals)',
            outOfRange: 'Device cleanup interval must be at least 1 day',
          },
          { min: 1 },
        ),
      SMTP_PORT: () =>
        this.validateInteger(
          value,
          {
            notANumber: 'SMTP port must be a valid number',
            notWhole: 'SMTP port must be a whole number (no decimals)',
            outOfRange: 'SMTP port must be between 1 and 65535',
          },
          { min: 1, max: 65535 },
        ),
      SMTP_FROM_EMAIL: () => {
        if (value && !this.validateEmailFormat(value)) {
          throw new Error('SMTP from email must be a valid email address');
        }
      },
      SMTP_TO_EMAILS: () => {
        const emails = value
          .split(/[,;\n]/)
          .map((email) => email.trim())
          .filter((email) => email.length > 0);

        for (const email of emails) {
          if (!this.validateEmailFormat(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        }
      },
      DEFAULT_PAGE: () => {
        if (!['devices', 'streams'].includes(value)) {
          throw new Error('Default page must be either "devices" or "streams"');
        }
      },
    };

    validators[key]?.();
  }

  async updateSetting(key: SettingKey, value: unknown): Promise<AppSettings> {
    const stringValue =
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value);

    this.validateSettingValue(key, stringValue);

    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) {
      throw new Error(`Setting ${key} not found`);
    }

    setting.value = stringValue;
    setting.updatedAt = new Date();

    const updated = await this.settingsRepository.save(setting);

    this.cache.set(key, this.parseSettingValue(stringValue, setting.type, key));

    // Special logging for timezone changes
    if (key === 'TIMEZONE') {
      const currentTime = this.getTimeInSpecificTimezone(stringValue);
      this.logger.log(
        `Timezone updated to ${stringValue}. Current time in this timezone: ${currentTime.toLocaleString(
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
    } else {
      this.logger.log(`Updated setting: ${key}`);
    }

    // If USER_PORTAL_ENABLED is set to false, revoke all Plex user sessions
    if (key === 'USER_PORTAL_ENABLED' && stringValue === 'false') {
      const revokedCount = await this.revokeAllPlexUserSessions();
      if (revokedCount > 0) {
        this.logger.log(
          `User portal disabled - revoked ${revokedCount} Plex user session(s)`,
        );
      }
    }

    // Notify listeners of the config change
    this.notifyConfigChange(key);

    return updated;
  }

  /**
   * Revoke all Plex user sessions (non-admin sessions)
   * Called when the user portal is disabled
   */
  private async revokeAllPlexUserSessions(): Promise<number> {
    const result = await this.sessionRepository.delete({
      userType: 'plex_user',
    });

    return result.affected || 0;
  }

  async updateMultipleSettings(
    settings: ConfigSettingDto[],
  ): Promise<AppSettings[]> {
    const results: AppSettings[] = [];

    for (const { key, value } of settings) {
      try {
        // Each updateSetting call will handle config change notifications
        const updated = await this.updateSetting(key, value);
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

  private getTimeInSpecificTimezone(timezoneOffset: string): Date {
    return this.timezoneService.getCurrentTimeInTimezone(timezoneOffset);
  }

  async testPlexConnection(): Promise<PlexResponse> {
    try {
      const [ip, port, token, useSSL, ignoreCertErrors] = await Promise.all([
        this.getSetting('PLEX_SERVER_IP'),
        this.getSetting('PLEX_SERVER_PORT'),
        this.getSetting('PLEX_TOKEN'),
        this.getSetting('USE_SSL'),
        this.getSetting('IGNORE_CERT_ERRORS'),
      ]);

      return await this.plexConnectionService.testConnection(
        ip ?? '',
        port ?? '',
        token ?? '',
        useSSL ?? false,
        ignoreCertErrors ?? false,
      );
    } catch (error) {
      this.logger.error('Error testing Plex connection:', error);
      return {
        success: false,
        errorCode: PlexErrorCode.UNKNOWN_ERROR,
        message: 'Unexpected error testing Plex connection',
        details: errorMessage(error),
      };
    }
  }

  async testSMTPConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const settings = await this.emailService.loadSmtpSettings();
      const smtpConfig = this.emailService.toSmtpConfig(settings);

      const currentTimeInTimezone = await this.getCurrentTimeInTimezone();
      const timestamp = this.timezoneService.formatTimestamp(
        currentTimeInTimezone,
      );

      return await this.emailService.testSMTPConnection(
        smtpConfig,
        settings.SMTP_ENABLED,
        timestamp,
      );
    } catch (error) {
      this.logger.error('Error in testSMTPConnection:', error);
      return {
        success: false,
        message: `Unexpected error: ${errorMessage(error)}`,
      };
    }
  }

  async testAppriseConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.appriseService.testAppriseConnection();
  }

  async getPlexConfigurationStatus(): Promise<{
    configured: boolean;
    hasValidCredentials: boolean;
    connectionStatus: string;
  }> {
    try {
      const [ip, port, token] = await Promise.all([
        this.getSetting('PLEX_SERVER_IP'),
        this.getSetting('PLEX_SERVER_PORT'),
        this.getSetting('PLEX_TOKEN'),
      ]);

      const configured = !!(ip && port && token);

      if (!configured) {
        return {
          configured: false,
          hasValidCredentials: false,
          connectionStatus: 'Not configured',
        };
      }

      // Test connection to determine status
      const connectionResult = await this.testPlexConnection();

      // Format the connection status to include error code for frontend parsing
      let connectionStatus: string;
      if (connectionResult.success) {
        connectionStatus = connectionResult.message || 'Connected successfully';
      } else {
        // Include the error code in the status for frontend parsing
        connectionStatus = `${connectionResult.errorCode}: ${connectionResult.message}`;
      }

      return {
        configured: true,
        hasValidCredentials: connectionResult.success,
        connectionStatus,
      };
    } catch (error) {
      this.logger.error('Error checking Plex configuration status:', error);
      return {
        configured: false,
        hasValidCredentials: false,
        connectionStatus: 'Error checking status',
      };
    }
  }

  async exportDatabase(): Promise<string> {
    const appVersion = await this.getSetting('APP_VERSION');
    return this.databaseService.exportDatabase(appVersion ?? '');
  }

  async importDatabase(
    importData: ImportPayload | null | undefined,
  ): Promise<{ imported: number; skipped: number }> {
    const result = await this.databaseService.importDatabase(
      importData,
      this.versionService.getCurrentAppVersion(),
      (v1: string, v2: string) => this.versionService.compareVersions(v1, v2),
    );

    // Refresh cache after import
    await this.loadCache();
    return result;
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

  // Database management scripts
  async resetDatabase(): Promise<void> {
    await this.databaseService.resetDatabase();
    // Reinitialize default settings
    await this.initializeDefaultSettings();
    // Clear cache
    this.cache.clear();
  }

  async resetStreamCounts(): Promise<void> {
    return this.databaseService.resetStreamCounts();
  }

  async deleteAllDevices(): Promise<void> {
    return this.databaseService.deleteAllDevices();
  }

  async clearAllSessionHistory(): Promise<void> {
    return this.databaseService.clearAllSessionHistory();
  }
}
