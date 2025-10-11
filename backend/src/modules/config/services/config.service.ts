import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '../../../entities/app-settings.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import * as http from 'http';
import * as https from 'https';
import { 
  PlexErrorCode, 
  PlexResponse, 
  createPlexError, 
  createPlexSuccess 
} from '../../../types/plex-errors';

// App version
const CURRENT_APP_VERSION = '1.2.0';

export interface ConfigSettingDto {
  key: string;
  value: string;
  description?: string;
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
  ) {
    this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    const defaultSettings = [
      {
      key: 'PLEX_TOKEN',
      value: '',
      description: 'Plex server authentication token',
      type: 'string' as const,
      private: true,
      },
      {
      key: 'PLEX_SERVER_IP',
      value: '',
      description: 'Plex server IP address',
      type: 'string' as const,
      },
      {
      key: 'PLEX_SERVER_PORT',
      value: '32400',
      description: 'Plex server port',
      type: 'string' as const,
      },
      {
      key: 'USE_SSL',
      value: 'false',
      description: 'Use SSL for Plex connection',
      type: 'boolean' as const,
      },
      {
      key: 'IGNORE_CERT_ERRORS',
      value: 'true',
      description: 'Ignore SSL certificate errors',
      type: 'boolean' as const,
      },
      {
      key: 'PLEXGUARD_REFRESH_INTERVAL',
      value: '10',
      description: 'Refresh interval for fetching session info and enforcing bans (seconds)',
      type: 'number' as const,
      },
      {
      key: 'PLEX_GUARD_DEFAULT_BLOCK',
      value: 'true',
      description: 'Block new devices by default',
      type: 'boolean' as const,
      },
      {
      key: 'PLEXGUARD_STOPMSG',
      value:
        'This device must be approved by the server owner. Please contact the server administrator for more information.',
      description: 'Message shown when blocking streams',
      type: 'string' as const,
      },
      {
      key: 'DEVICE_CLEANUP_ENABLED',
      value: 'false',
      description: 'Automatically remove inactive devices',
      type: 'boolean' as const,
      },
      {
      key: 'DEVICE_CLEANUP_INTERVAL_DAYS',
      value: '30',
      description: 'Days of inactivity before device removal',
      type: 'number' as const,
      },
      {
      key: 'DEFAULT_PAGE',
      value: 'devices',
      description: 'Default page to show when app loads',
      type: 'string' as const,
      },
      {
      key: 'AUTO_CHECK_UPDATES',
      value: 'false',
      description: 'Automatically check for updates on app launch',
      type: 'boolean' as const,
      },
      {
      key: 'APP_VERSION',
      value: CURRENT_APP_VERSION,
      description: 'Current application version',
      type: 'string' as const,
      private: false,
      },
      {
      key: 'AUTO_MARK_NOTIFICATION_READ',
      value: 'true',
      description: 'Automatically mark notifications as read when clicked',
      type: 'boolean' as const,
      },
      {
      key: 'ENABLE_MEDIA_THUMBNAILS',
      value: 'true',
      description: 'Enable media thumbnails',
      type: 'boolean' as const,
      },
      {
      key: 'ENABLE_MEDIA_ARTWORK',
      value: 'true',
      description: 'Enable background artwork',
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
      } else {
        // Always update description in case it changed
        existing.description = setting.description;
        await this.settingsRepository.save(existing);
        this.logger.log(`Updated description for existing setting: ${setting.key}`);
      }
    }

    await this.loadCache();
  }

  private async loadCache() {
    const settings = await this.settingsRepository.find();
    for (const setting of settings) {
      let value: any = setting.value;

      // Parse value based on type
      if (setting.type === 'boolean') {
        value = value === 'true';
      } else if (setting.type === 'number') {
        value = parseFloat(value);
      } else if (setting.type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          this.logger.warn(`Failed to parse JSON for ${setting.key}: ${value}`);
        }
      }

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
      listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          this.logger.error(`Error calling config change listener for ${key}:`, error);
        }
      });
    }
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
      description: setting.description,
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

    let value: any = setting.value;
    if (setting.type === 'boolean') {
      value = value === 'true';
    } else if (setting.type === 'number') {
      value = parseFloat(value);
    } else if (setting.type === 'json') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        this.logger.warn(`Failed to parse JSON for ${key}: ${value}`);
      }
    }

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
        throw new Error('Device cleanup interval must be a whole number (no decimals)');
      }
      if (numValue < 1) {
        throw new Error('Device cleanup interval must be at least 1 day');
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

    this.logger.log(`Updated setting: ${key}`);

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

  async testPlexConnection(): Promise<PlexResponse> {
    try {
      const ip = await this.getSetting('PLEX_SERVER_IP');
      const port = await this.getSetting('PLEX_SERVER_PORT');
      const token = await this.getSetting('PLEX_TOKEN');
      const useSSL = await this.getSetting('USE_SSL');
      const ignoreCertErrors = await this.getSetting('IGNORE_CERT_ERRORS');

      if (!ip || !port || !token) {
        return createPlexError(
          PlexErrorCode.NOT_CONFIGURED,
          'Missing required Plex configuration (IP, Port, or Token)'
        );
      }

      // Create a HTTP/HTTPS request to test the connection
      const protocol = useSSL ? 'https' : 'http';
      const testUrl = `${protocol}://${ip}:${port}/?X-Plex-Token=${token}`;

      const httpModule = protocol === 'https' ? https : http;

      return new Promise((resolve) => {
        const urlObj = new URL(testUrl);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          timeout: 10000,
          rejectUnauthorized: !ignoreCertErrors,
        };

        const req = httpModule.request(options, (res: any) => {
          if (res.statusCode === 200) {
            resolve(createPlexSuccess('Successfully connected to Plex server'));
          } else if (res.statusCode === 401) {
            resolve(createPlexError(
              PlexErrorCode.AUTH_FAILED,
              'Authentication failed - check your Plex token',
              `HTTP ${res.statusCode}: ${res.statusMessage}`
            ));
          } else {
            resolve(createPlexError(
              PlexErrorCode.SERVER_ERROR,
              `Plex server returned an error: ${res.statusCode} ${res.statusMessage}`,
              `HTTP ${res.statusCode}: ${res.statusMessage}`
            ));
          }
        });

        req.on('error', (error: any) => {
          // Handle specific error types with appropriate error codes
          if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
            resolve(createPlexError(
              PlexErrorCode.CERT_ERROR,
              'SSL certificate error: Hostname/IP does not match certificate',
              'Enable "Ignore SSL certificate errors" or use HTTP instead'
            ));
          } else if (error.code && error.code.startsWith('ERR_TLS_')) {
            resolve(createPlexError(
              PlexErrorCode.SSL_ERROR,
              'SSL/TLS connection error',
              'Consider enabling "Ignore SSL certificate errors" or using HTTP'
            ));
          } else if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            resolve(createPlexError(
              PlexErrorCode.CONNECTION_REFUSED,
              'Plex server is unreachable',
              'Check if Plex server is running and accessible'
            ));
          } else if (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.message.includes('timeout')
          ) {
            resolve(createPlexError(
              PlexErrorCode.CONNECTION_TIMEOUT,
              'Connection timeout',
              'Check server address, port and network settings'
            ));
          } else {
            resolve(createPlexError(
              PlexErrorCode.NETWORK_ERROR,
              'Network error connecting to Plex server',
              error.message
            ));
          }
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(createPlexError(
              PlexErrorCode.CONNECTION_REFUSED,
              'Plex server is unreachable',
              'Check if Plex server is running and accessible'
          ));
        });

        req.setTimeout(10000);
        req.end();
      });
    } catch (error) {
      this.logger.error('Error testing Plex connection:', error);
      return createPlexError(
        PlexErrorCode.UNKNOWN_ERROR,
        'Unexpected error testing Plex connection',
        error.message
      );
    }
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
    try {
      this.logger.log('Starting database export...');
      // Get all data from all tables 



      const [settings, userDevices, userPreferences] = await Promise.all([
        this.settingsRepository.find(),
        this.settingsRepository.manager.getRepository(UserDevice).find(),
        this.settingsRepository.manager.getRepository(UserPreference).find(),
      ]);

      // Get current app version from settings database
      const appVersion = await this.getSetting('APP_VERSION');

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: appVersion,
        data: {
          settings,
          userDevices,
          userPreferences,
        },
      };

      this.logger.log(`Database export completed: ${settings.length} settings, ${userDevices.length} devices, ${userPreferences.length} preferences`);
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.logger.error('Error exporting database:', error);
      throw new Error('Failed to export database');
    }
  }

  async importDatabase(importData: any): Promise<{ imported: number; skipped: number }> {
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
        for (const setting of data.settings) {
          try {
            const existing = await this.settingsRepository.findOne({
              where: { key: setting.key }
            });

            // Skip importing APP_VERSION if the import file has an older version than the current code
            if (setting.key === 'APP_VERSION' && this.compareVersions(setting.value, CURRENT_APP_VERSION) < 0) {
              this.logger.log(`Skipping import of APP_VERSION (${setting.value}) to avoid downgrading from current version (${CURRENT_APP_VERSION})`);
              skipped++;
              continue;
            }

            this.logger.debug('Importing setting:', setting.key, 'Existing:', !!existing);

            if (existing) {
              existing.value = setting.value;
              existing.description = setting.description || existing.description;
              await this.settingsRepository.save(existing);
              imported++;
            }else{
              this.logger.warn(`Skipping unknown setting ${setting.key}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to import setting ${setting.key}:`, error);
            skipped++;
          }
        }
      }

      // Import user devices
      if (data.userDevices && Array.isArray(data.userDevices)) {
        const deviceRepo = this.settingsRepository.manager.getRepository(UserDevice);
        for (const device of data.userDevices) {
          try {
            const existing = await deviceRepo.findOne({
              where: { 
                userId: device.userId, 
                deviceIdentifier: device.deviceIdentifier 
              }
            });

            this.logger.debug(`Importing device ${device.deviceIdentifier} for user ${device.userId}, existing:`, !!existing);

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
              this.logger.debug(`Updated existing device: ${device.deviceIdentifier}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to import device ${device.deviceIdentifier}:`, error);
            skipped++;
          }
        }
      }

      // Import user preferences
      if (data.userPreferences && Array.isArray(data.userPreferences)) {
        const prefRepo = this.settingsRepository.manager.getRepository(UserPreference);
        for (const pref of data.userPreferences) {
          try {
            const existing = await prefRepo.findOne({
              where: { userId: pref.userId }
            });

            this.logger.debug(`Importing preference for user ${pref.userId}, existing:`, !!existing);

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
              this.logger.debug(`Updated existing preference for user: ${pref.userId}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to import preference for user ${pref.userId}:`, error);
            skipped++;
          }
        }
      }

      // Refresh cache after import
      await this.loadCache();

      this.logger.log(`Database import completed: ${imported} items imported, ${skipped} items skipped`);
      
      return { 
        imported, 
        skipped
      };
    } catch (error) {
      this.logger.error('Error importing database:', error);
      throw new Error(`Failed to import database: ${error.message}`);
    }
  }

  private async updateAppVersionIfNewer(): Promise<void> {
    try {
      const versionSetting = await this.settingsRepository.findOne({
        where: { key: 'APP_VERSION' },
      });

      if (versionSetting && this.compareVersions(CURRENT_APP_VERSION, versionSetting.value) > 0) {
        this.logger.log(`Updating app version from ${versionSetting.value} to: ${CURRENT_APP_VERSION}`);
        versionSetting.value = CURRENT_APP_VERSION;
        await this.settingsRepository.save(versionSetting);
        this.logger.log('App version updated successfully');
      } else if (versionSetting && this.compareVersions(CURRENT_APP_VERSION, versionSetting.value) < 0) {
        this.logger.error(`WARNING: Current app version ${CURRENT_APP_VERSION} is older than your data version ${versionSetting.value}. Please check your installation.`);
      } else {
        this.logger.log(`App version is up to date: ${CURRENT_APP_VERSION}`);
      }
    } catch (error) {
      this.logger.warn('Failed to update app version:', error);
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const parseVersion = (version: string): number[] => {
      return version.split('.').map(v => parseInt(v) || 0);
    };

    const v1Parts = parseVersion(version1);
    const v2Parts = parseVersion(version2);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0; // versions are equal
  }

  async getVersionInfo(): Promise<{ 
    version: string; 
    databaseVersion: string; 
    codeVersion: string;
    isVersionMismatch: boolean;
  }> {
    const dbVersion = await this.getSetting('APP_VERSION') || CURRENT_APP_VERSION;
    // Version mismatch occurs when database version > current code version (downgrade scenario)
    const isVersionMismatch = this.compareVersions(dbVersion, CURRENT_APP_VERSION) > 0;
    
    return {
      version: CURRENT_APP_VERSION,
      databaseVersion: dbVersion,
      codeVersion: CURRENT_APP_VERSION,
      isVersionMismatch,
    };
  }

  // Database management scripts
  async resetDatabase(): Promise<void> {
    try {
      this.logger.warn('RESETTING ALL DATABASE TABLES');
      
      // Clear all tables
      await this.settingsRepository.manager.getRepository(UserDevice).clear();
      await this.settingsRepository.manager.getRepository(UserPreference).clear();
      await this.settingsRepository.manager.getRepository(AppSettings).clear();
      
      // Reinitialize default settings
      await this.initializeDefaultSettings();
      
      // Clear cache
      this.cache.clear();
      
      this.logger.warn('Database reset completed - all data has been deleted');
    } catch (error) {
      this.logger.error('Failed to reset database:', error);
      throw new Error(`Database reset failed: ${error.message}`);
    }
  }

  async resetStreamCounts(): Promise<void> {
    try {
      this.logger.warn('Resetting all device stream counts');
      
      // Reset session count and clear current session keys for all devices
      const result = await this.settingsRepository.manager
        .getRepository(UserDevice)
        .createQueryBuilder()
        .update(UserDevice)
        .set({ 
          sessionCount: 0,
          currentSessionKey: () => 'NULL'
        })
        .execute();
      
      this.logger.log(`Stream counts reset for ${result.affected || 0} devices`);
    } catch (error) {
      this.logger.error('Failed to reset stream counts:', error);
      throw new Error(`Stream count reset failed: ${error.message}`);
    }
  }

  async deleteAllDevices(): Promise<void> {
    try {
      this.logger.warn('DELETING ALL DEVICES per user request');
      
      // Get count before deletion for logging
      const deviceCount = await this.settingsRepository.manager
        .getRepository(UserDevice)
        .count();
      
      // Delete all devices
      await this.settingsRepository.manager.getRepository(UserDevice).clear();
      
      this.logger.warn(`All ${deviceCount} devices have been deleted`);
    } catch (error) {
      this.logger.error('Failed to delete all devices:', error);
      throw new Error(`Device deletion failed: ${error.message}`);
    }
  }
}
