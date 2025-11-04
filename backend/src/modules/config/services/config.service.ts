import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '../../../entities/app-settings.entity';
import { Notification } from '../../../entities/notification.entity';
import { PlexResponse, PlexErrorCode } from '../../../types/plex-errors';
import { EmailService, SMTPConfig } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { PlexConnectionService } from './plex-connection.service';
import { TimezoneService } from './timezone.service';
import { DatabaseService } from './database.service';
import { VersionService } from './version.service';
import { AppriseService } from './apprise.service';

export interface ConfigSettingDto {
  key: string;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  private?: boolean;
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private cache = new Map<string, any>();
  private configChangeListeners = new Map<string, Array<() => void>>();

  constructor(
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly plexConnectionService: PlexConnectionService,
    private readonly timezoneService: TimezoneService,
    private readonly databaseService: DatabaseService,
    private readonly versionService: VersionService,
    private readonly appriseService: AppriseService,
  ) {
    this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    const defaultSettings = [
      {
        key: 'PLEX_TOKEN',
        value: '',
        type: 'string' as const,
        private: true,
      },
      {
        key: 'PLEX_SERVER_IP',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'PLEX_SERVER_PORT',
        value: '32400',
        type: 'string' as const,
      },
      {
        key: 'USE_SSL',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'IGNORE_CERT_ERRORS',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'PLEXGUARD_REFRESH_INTERVAL',
        value: '10',
        type: 'number' as const,
      },
      {
        key: 'PLEX_GUARD_DEFAULT_BLOCK',
        value: 'true',
        type: 'boolean' as const,
      },
      {
        key: 'MSG_DEVICE_PENDING',
        value:
          'Device Pending Approval. The server owner must approve this device before it can be used.',
        type: 'string' as const,
      },
      {
        key: 'MSG_DEVICE_REJECTED',
        value:
          'You are not authorized to use this device. Please contact the server administrator for more information.',
        type: 'string' as const,
      },
      {
        key: 'MSG_TIME_RESTRICTED',
        value:
          'Streaming is not allowed at this time due to scheduling restrictions',
        type: 'string' as const,
      },
      {
        key: 'MSG_IP_LAN_ONLY',
        value: 'Only LAN access is allowed',
        type: 'string' as const,
      },
      {
        key: 'MSG_IP_WAN_ONLY',
        value: 'Only WAN access is allowed',
        type: 'string' as const,
      },
      {
        key: 'MSG_IP_NOT_ALLOWED',
        value: 'Your current IP address is not in the allowed list',
        type: 'string' as const,
      },
      {
        key: 'DEVICE_CLEANUP_ENABLED',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'DEVICE_CLEANUP_INTERVAL_DAYS',
        value: '30',
        type: 'number' as const,
      },
      {
        key: 'DEFAULT_PAGE',
        value: 'devices',
        type: 'string' as const,
      },
      {
        key: 'AUTO_CHECK_UPDATES',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'APP_VERSION',
        value: this.versionService.getCurrentAppVersion(),
        type: 'string' as const,
        private: false,
      },
      {
        key: 'AUTO_MARK_NOTIFICATION_READ',
        value: 'true',
        type: 'boolean' as const,
      },
      {
        key: 'ENABLE_MEDIA_THUMBNAILS',
        value: 'true',
        type: 'boolean' as const,
      },
      {
        key: 'ENABLE_MEDIA_ARTWORK',
        value: 'true',
        type: 'boolean' as const,
      },
      {
        key: 'CUSTOM_PLEX_URL',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'TIMEZONE',
        value: '+00:00',
        type: 'string' as const,
      },
      // SMTP Email Configuration Settings
      {
        key: 'SMTP_ENABLED',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'SMTP_HOST',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'SMTP_PORT',
        value: '587',
        type: 'number' as const,
      },
      {
        key: 'SMTP_USER',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'SMTP_PASSWORD',
        value: '',
        type: 'string' as const,
        private: true,
      },
      {
        key: 'SMTP_FROM_EMAIL',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'SMTP_FROM_NAME',
        value: 'Guardian Notifications',
        type: 'string' as const,
      },
      {
        key: 'SMTP_USE_TLS',
        value: 'true',
        type: 'boolean' as const,
      },
      {
        key: 'SMTP_TO_EMAILS',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'SMTP_NOTIFY_ON_NEW_DEVICE',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'SMTP_NOTIFY_ON_BLOCK',
        value: 'false',
        type: 'boolean' as const,
      },
      // Apprise Configuration Settings
      {
        key: 'APPRISE_ENABLED',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'APPRISE_URLS',
        value: '',
        type: 'string' as const,
      },
      {
        key: 'APPRISE_NOTIFY_ON_NEW_DEVICE',
        value: 'false',
        type: 'boolean' as const,
      },
      {
        key: 'APPRISE_NOTIFY_ON_BLOCK',
        value: 'false',
        type: 'boolean' as const,
      },
    ];

    // Update version number on startup if current version is higher
    await this.updateAppVersionIfNewer();

    for (const setting of defaultSettings) {
      const existing = await this.settingsRepository.findOne({
        where: { key: setting.key },
      });

      if (!existing) {
        await this.settingsRepository.save(setting);
        this.logger.log(`Initialized default setting: ${setting.key}`);
      }
    }

    await this.loadCache();
  }

  private parseSettingValue(value: string, type: string, key?: string): any {
    if (type === 'boolean') {
      return value === 'true';
    } else if (type === 'number') {
      return parseFloat(value);
    } else if (type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        if (key) {
          this.logger.warn(`Failed to parse JSON for ${key}: ${value}`);
        }
        return value;
      }
    }
    return value;
  }

  private validateEmailFormat(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private async loadCache() {
    const settings = await this.settingsRepository.find();
    for (const setting of settings) {
      const value = this.parseSettingValue(
        setting.value,
        setting.type,
        setting.key,
      );
      this.cache.set(setting.key, value);
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

  async getPublicSettings(): Promise<Omit<AppSettings, 'value'>[]> {
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

  async getSetting(key: string): Promise<any> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) return null;

    const value = this.parseSettingValue(setting.value, setting.type, key);
    this.cache.set(key, value);
    return value;
  }

  async updateSetting(key: string, value: any): Promise<AppSettings> {
    // Validate DEVICE_CLEANUP_INTERVAL_DAYS setting
    if (key === 'DEVICE_CLEANUP_INTERVAL_DAYS') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error('Device cleanup interval must be a number');
      }
      if (!Number.isInteger(numValue)) {
        throw new Error(
          'Device cleanup interval must be a whole number (no decimals)',
        );
      }
      if (numValue < 1) {
        throw new Error('Device cleanup interval must be at least 1 day');
      }
    }

    // Validate SMTP_PORT setting
    if (key === 'SMTP_PORT') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error('SMTP port must be a valid number');
      }
      if (!Number.isInteger(numValue)) {
        throw new Error('SMTP port must be a whole number (no decimals)');
      }
      if (numValue < 1 || numValue > 65535) {
        throw new Error('SMTP port must be between 1 and 65535');
      }
    }

    if (key === 'SMTP_FROM_EMAIL') {
      if (value && !this.validateEmailFormat(String(value))) {
        throw new Error('SMTP from email must be a valid email address');
      }
    }

    if (key === 'SMTP_TO_EMAILS') {
      if (value) {
        const emails = String(value)
          .split(/[,;\n]/)
          .map((email) => email.trim())
          .filter((email) => email.length > 0);

        for (const email of emails) {
          if (!this.validateEmailFormat(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        }
      }
    }

    // Validate DEFAULT_PAGE setting
    if (key === 'DEFAULT_PAGE') {
      const validPages = ['devices', 'streams'];
      if (!validPages.includes(String(value))) {
        throw new Error('Default page must be either "devices" or "streams"');
      }
    }

    let stringValue = value;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) {
      throw new Error(`Setting ${key} not found`);
    }

    setting.value = stringValue;
    setting.updatedAt = new Date();

    const updated = await this.settingsRepository.save(setting);

    // Update cache
    let cacheValue = value;
    if (setting.type === 'boolean') {
      cacheValue = stringValue === 'true';
    } else if (setting.type === 'number') {
      cacheValue = parseFloat(stringValue);
    } else if (setting.type === 'json') {
      cacheValue = value;
    }

    this.cache.set(key, cacheValue);

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

    // Notify listeners of the config change
    this.notifyConfigChange(key);

    return updated;
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

      return this.plexConnectionService.testConnection(
        ip,
        port,
        token,
        useSSL,
        ignoreCertErrors,
      );
    } catch (error) {
      this.logger.error('Error testing Plex connection:', error);
      return {
        success: false,
        errorCode: PlexErrorCode.UNKNOWN_ERROR,
        message: 'Unexpected error testing Plex connection',
        details: error.message,
      };
    }
  }

  async testSMTPConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const [
        smtpEnabled,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpFromEmail,
        smtpFromName,
        smtpUseTLS,
        smtpToEmails,
      ] = await Promise.all([
        this.getSetting('SMTP_ENABLED'),
        this.getSetting('SMTP_HOST'),
        this.getSetting('SMTP_PORT'),
        this.getSetting('SMTP_USER'),
        this.getSetting('SMTP_PASSWORD'),
        this.getSetting('SMTP_FROM_EMAIL'),
        this.getSetting('SMTP_FROM_NAME'),
        this.getSetting('SMTP_USE_TLS'),
        this.getSetting('SMTP_TO_EMAILS'),
      ]);

      const smtpConfig: SMTPConfig = {
        host: smtpHost,
        port: parseInt(smtpPort),
        user: smtpUser,
        password: smtpPassword,
        fromEmail: smtpFromEmail,
        fromName: smtpFromName,
        useTLS: smtpUseTLS === 'true',
        toEmails: smtpToEmails
          ? smtpToEmails
              .split(/[,;\n]/)
              .map((email: string) => email.trim())
              .filter((email: string) => email.length > 0)
          : [],
      };

      const currentTimeInTimezone = await this.getCurrentTimeInTimezone();
      const timestamp = this.timezoneService.formatTimestamp(
        currentTimeInTimezone,
      );

      return this.emailService.testSMTPConnection(
        smtpConfig,
        smtpEnabled,
        timestamp,
      );
    } catch (error) {
      this.logger.error('Error in testSMTPConnection:', error);
      return {
        success: false,
        message: `Unexpected error: ${error.message}`,
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
    return this.databaseService.exportDatabase(appVersion);
  }

  async importDatabase(
    importData: any,
  ): Promise<{ imported: number; skipped: number }> {
    const result = await this.databaseService.importDatabase(
      importData,
      this.versionService.getCurrentAppVersion(),
      this.versionService.compareVersions.bind(this.versionService),
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
