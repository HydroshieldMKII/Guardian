import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '../../../entities/app-settings.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import * as http from 'http';
import * as https from 'https';
import * as nodemailer from 'nodemailer';
import {
  PlexErrorCode,
  PlexResponse,
  createPlexError,
  createPlexSuccess,
} from '../../../types/plex-errors';
import { SessionHistory } from 'src/entities/session-history.entity';
import { Notification } from 'src/entities/notification.entity';

// App version
const CURRENT_APP_VERSION = '1.2.3';

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
        value: CURRENT_APP_VERSION,
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
        key: 'SMTP_NOTIFY_ON_NOTIFICATIONS',
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
        throw new Error(
          'Device cleanup interval must be a whole number (no decimals)',
        );
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
    try {
      // Parse UTC offset format (e.g., "+02:00", "-05:30")
      const offsetMatch = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (!offsetMatch) {
        this.logger.warn(
          `Invalid timezone offset format ${timezoneOffset}, falling back to UTC`,
        );
        return new Date();
      }

      const sign = offsetMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = parseInt(offsetMatch[3], 10);

      // Calculate total offset in milliseconds
      const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

      // Get current UTC time and apply the timezone offset
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const localTime = new Date(utcTime + offsetMs);

      return localTime;
    } catch (error) {
      this.logger.warn(
        `Invalid timezone offset ${timezoneOffset}, falling back to UTC: ${error.message}`,
      );
      return new Date();
    }
  }

  private getTimeInSpecificTimezone(timezoneOffset: string): Date {
    try {
      // Parse UTC offset format (e.g., "+02:00", "-05:30")
      const offsetMatch = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (!offsetMatch) {
        this.logger.warn(
          `Invalid timezone offset format ${timezoneOffset}, falling back to UTC`,
        );
        return new Date();
      }

      const sign = offsetMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = parseInt(offsetMatch[3], 10);

      // Calculate total offset in milliseconds
      const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

      // Get current UTC time and apply the timezone offset
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const localTime = new Date(utcTime + offsetMs);

      return localTime;
    } catch (error) {
      this.logger.warn(
        `Invalid timezone offset ${timezoneOffset}, falling back to UTC: ${error.message}`,
      );
      return new Date();
    }
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
          'Missing required Plex configuration (IP, Port, or Token)',
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
            resolve(
              createPlexError(
                PlexErrorCode.AUTH_FAILED,
                'Authentication failed - check your Plex token',
                `HTTP ${res.statusCode}: ${res.statusMessage}`,
              ),
            );
          } else {
            resolve(
              createPlexError(
                PlexErrorCode.SERVER_ERROR,
                `Plex server returned an error: ${res.statusCode} ${res.statusMessage}`,
                `HTTP ${res.statusCode}: ${res.statusMessage}`,
              ),
            );
          }
        });

        req.on('error', (error: any) => {
          // Handle specific error types with appropriate error codes
          if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
            resolve(
              createPlexError(
                PlexErrorCode.CERT_ERROR,
                'SSL certificate error: Hostname/IP does not match certificate',
                'Enable "Ignore SSL certificate errors" or use HTTP instead',
              ),
            );
          } else if (error.code && error.code.startsWith('ERR_TLS_')) {
            resolve(
              createPlexError(
                PlexErrorCode.SSL_ERROR,
                'SSL/TLS connection error',
                'Consider enabling "Ignore SSL certificate errors" or using HTTP',
              ),
            );
          } else if (
            error.code === 'ECONNREFUSED' ||
            error.code === 'EHOSTUNREACH'
          ) {
            resolve(
              createPlexError(
                PlexErrorCode.CONNECTION_REFUSED,
                'Plex server is unreachable',
                'Check if Plex server is running and accessible',
              ),
            );
          } else if (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.message.includes('timeout')
          ) {
            resolve(
              createPlexError(
                PlexErrorCode.CONNECTION_TIMEOUT,
                'Connection timeout',
                'Check server address, port and network settings',
              ),
            );
          } else {
            resolve(
              createPlexError(
                PlexErrorCode.NETWORK_ERROR,
                'Network error connecting to Plex server',
                error.message,
              ),
            );
          }
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(
            createPlexError(
              PlexErrorCode.CONNECTION_REFUSED,
              'Plex server is unreachable',
              'Check if Plex server is running and accessible',
            ),
          );
        });

        req.setTimeout(10000);
        req.end();
      });
    } catch (error) {
      this.logger.error('Error testing Plex connection:', error);
      return createPlexError(
        PlexErrorCode.UNKNOWN_ERROR,
        'Unexpected error testing Plex connection',
        error.message,
      );
    }
  }

  async testSMTPConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const smtpEnabled = await this.getSetting('SMTP_ENABLED');
      const smtpHost = await this.getSetting('SMTP_HOST');
      const smtpPort = await this.getSetting('SMTP_PORT');
      const smtpUser = await this.getSetting('SMTP_USER');
      const smtpPassword = await this.getSetting('SMTP_PASSWORD');
      const smtpFromEmail = await this.getSetting('SMTP_FROM_EMAIL');
      const smtpFromName = await this.getSetting('SMTP_FROM_NAME');
      const smtpUseTLS = await this.getSetting('SMTP_USE_TLS');
      const smtpToEmails = await this.getSetting('SMTP_TO_EMAILS');

      // Check if SMTP is enabled
      if (smtpEnabled !== true) {
        return {
          success: false,
          message: 'SMTP email notifications are disabled',
        };
      }

      // Check if all required settings are present
      if (
        !smtpHost ||
        !smtpPort ||
        !smtpUser ||
        !smtpPassword ||
        !smtpFromEmail
      ) {
        return {
          success: false,
          message:
            'Missing required SMTP configuration (host, port, user, password, or from email)',
        };
      }

      // Check if TLS is valid with port
      if (
        smtpUseTLS === true &&
        parseInt(smtpPort) !== 465 &&
        parseInt(smtpPort) !== 587
      ) {
        return {
          success: false,
          message:
            'TLS is not supported on this port. Please use port 465 or 587.',
        };
      }

      // Parse and validate recipient emails
      let recipientEmails: string[] = [];
      if (smtpToEmails && smtpToEmails.trim()) {
        // Split by comma, semicolon, or newline and clean up
        recipientEmails = smtpToEmails
          .split(/[,;\n]/)
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0);
      }

      // If no specific recipients configured
      if (recipientEmails.length === 0) {
        return {
          success: false,
          message:
            'No recipient email addresses configured. Please  provide at least one recipient.',
        };
      }

      // Validate email format for recipients
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = recipientEmails.filter(
        (email) => !emailRegex.test(email),
      );
      if (invalidEmails.length > 0) {
        return {
          success: false,
          message: `Invalid email format(s): ${invalidEmails.join(', ')}`,
        };
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpUseTLS === 'true' && parseInt(smtpPort) === 465, // Use secure for port 465
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates for testing
        },
      });

      // Verify the connection
      await transporter.verify();

      // Get the current time in the configured timezone for the email timestamp
      const currentTimeInTimezone = await this.getCurrentTimeInTimezone();

      // Format timestamp in French style (dd/mm/yyyy à 17h33)
      const day = currentTimeInTimezone.getDate().toString().padStart(2, '0');
      const month = (currentTimeInTimezone.getMonth() + 1)
        .toString()
        .padStart(2, '0');
      const year = currentTimeInTimezone.getFullYear();
      const hours = currentTimeInTimezone.getHours();
      const minutes = currentTimeInTimezone
        .getMinutes()
        .toString()
        .padStart(2, '0');

      const formattedTimestamp = `${day}/${month}/${year} ${hours}h${minutes}`;

      const testMailOptions = {
        from: smtpFromName
          ? `${smtpFromName} <${smtpFromEmail}>`
          : smtpFromEmail,
        to: recipientEmails,
        subject: 'Guardian SMTP Test - Connection Successful',
        text: 'This is a test email from Guardian to verify SMTP configuration. If you received this email, your SMTP settings are working correctly.',
        html: `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
              background-color: #ffffff;
              color: #000000;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border: 1px solid #e5e5e5;
            }
            .header {
              padding: 60px 40px 40px;
              text-align: center;
              background-color: #ffffff;
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 700;
              letter-spacing: -1px;
              color: #000000;
              text-transform: uppercase;
            }
            .content {
              padding: 0 40px 40px;
              background-color: #ffffff;
            }
            .content p {
              margin: 0 0 24px 0;
              font-size: 16px;
              line-height: 1.7;
              color: #000000;
              font-weight: 400;
            }
            .content p:last-child {
              margin-bottom: 0;
            }
            .status {
              display: inline-block;
              padding: 12px 24px;
              background-color: #f8f8f8;
              color: #000000 !important;
              border: 2px solid #000000;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin: 32px 0;
              border-radius: 0;
            }
            .recipients {
              margin: 40px 0;
              padding: 24px;
              background-color: #f8f8f8;
              border-left: 4px solid #000000;
            }
            .recipients h3 {
              margin: 0 0 16px 0;
              font-size: 14px;
              font-weight: 700;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .recipients p {
              margin: 0;
              font-size: 14px;
              color: #000000;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
              font-weight: 500;
            }
            .footer {
              padding: 40px 40px 60px;
              text-align: center;
              border-top: 1px solid #e5e5e5;
              margin-top: 40px;
              background-color: #ffffff;
            }
            .footer p {
              margin: 0;
              font-size: 12px;
              color: #000000;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 500;
            }
            .divider {
              height: 1px;
              background-color: #e5e5e5;
              margin: 40px 0;
              width: 60px;
              margin-left: auto;
              margin-right: auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Guardian</h1>
              <div class="divider"></div>
            </div>
            <div class="content">
              <p>This is a test email from Guardian to verify your SMTP configuration.</p>
              <div class="status">SMTP VERIFIED</div>
              <p>Your email settings are working correctly. Guardian is ready to send notifications.</p>
              <div class="recipients">
                <h3>Test Recipients</h3>
                <p>${recipientEmails.join(', ')}</p>
              </div>
            </div>
            <div class="footer">
              <p>Test sent at: ${formattedTimestamp}</p>
            </div>
          </div>
        </body>
        </html>`,
      };

      await transporter.sendMail(testMailOptions);

      const recipientCount = recipientEmails.length;
      const recipientText =
        recipientCount === 1
          ? recipientEmails[0]
          : `${recipientCount} recipients (${recipientEmails.join(', ')})`;

      this.logger.log(
        `SMTP test email sent successfully to ${recipientCount} recipient(s): ${recipientEmails.join(', ')}`,
      );

      return {
        success: true,
        message: `SMTP connection successful! Test email sent to ${recipientText}`,
      };
    } catch (error) {
      this.logger.error('SMTP Connection Test Failed', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack,
      });

      let userMessage = `SMTP error: ${error.message}`;

      if (error.code === 'EAUTH') {
        userMessage =
          'Authentication failed. Please check your username and password.';
      } else if (error.code === 'ECONNECTION') {
        userMessage =
          'Failed to connect to SMTP server. Please check the host and port.';
      } else if (error.code === 'ETIMEDOUT') {
        userMessage =
          'Connection timed out. Please check your network connection and server settings.';
      } else if (error.code === 'ENOTFOUND') {
        userMessage = 'SMTP server not found. Please check the hostname.';
      } else if (error.responseCode === 535) {
        userMessage = 'Authentication failed. Please verify your credentials.';
      } else if (error.responseCode === 550) {
        userMessage =
          'Email rejected by server. Please check recipient addresses.';
      }

      return {
        success: false,
        message: userMessage,
      };
    }
  }

  async sendNotificationEmail(
    notificationType: 'block' | 'info' | 'warning' | 'error',
    notificationText: string,
    username: string,
    deviceName?: string,
    stopCode?: string,
  ): Promise<void> {
    try {
      // Check if email notifications are enabled
      const smtpEnabled = await this.getSetting('SMTP_ENABLED');
      const notifyOnNotifications = await this.getSetting(
        'SMTP_NOTIFY_ON_NOTIFICATIONS',
      );

      if (!smtpEnabled || !notifyOnNotifications) {
        return; // Email notifications are disabled
      }

      // Get SMTP settings
      const [
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpFromEmail,
        smtpFromName,
        smtpUseTLS,
        smtpToEmails,
      ] = await Promise.all([
        this.getSetting('SMTP_HOST'),
        this.getSetting('SMTP_PORT'),
        this.getSetting('SMTP_USER'),
        this.getSetting('SMTP_PASSWORD'),
        this.getSetting('SMTP_FROM_EMAIL'),
        this.getSetting('SMTP_FROM_NAME'),
        this.getSetting('SMTP_USE_TLS'),
        this.getSetting('SMTP_TO_EMAILS'),
      ]);

      // Validate required settings
      if (
        !smtpHost ||
        !smtpPort ||
        !smtpUser ||
        !smtpPassword ||
        !smtpFromEmail ||
        !smtpToEmails
      ) {
        this.logger.warn(
          'SMTP notification email skipped: missing required configuration',
        );
        return;
      }

      // Parse recipient emails
      const recipientEmails = smtpToEmails
        .split(/[,;\n]/)
        .map((email: string) => email.trim())
        .filter((email: string) => email.length > 0);

      if (recipientEmails.length === 0) {
        this.logger.warn(
          'SMTP notification email skipped: no recipient addresses configured',
        );
        return;
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpUseTLS === 'true' && parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Get current time for timestamp
      const currentTimeInTimezone = await this.getCurrentTimeInTimezone();
      const day = currentTimeInTimezone.getDate().toString().padStart(2, '0');
      const month = (currentTimeInTimezone.getMonth() + 1)
        .toString()
        .padStart(2, '0');
      const year = currentTimeInTimezone.getFullYear();
      const hours = currentTimeInTimezone.getHours();
      const minutes = currentTimeInTimezone
        .getMinutes()
        .toString()
        .padStart(2, '0');
      const formattedTimestamp = `${day}/${month}/${year} ${hours}h${minutes}`;

      // Generate subject and email content based on notification type
      const { subject, statusLabel, statusColor, mainMessage } =
        this.getNotificationEmailContent(
          notificationType,
          stopCode,
          username,
          deviceName,
        );

      const emailHtml = `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
              background-color: #ffffff;
              color: #000000;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border: 1px solid #e5e5e5;
            }
            .header {
              padding: 60px 40px 40px;
              text-align: center;
              background-color: #ffffff;
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 700;
              letter-spacing: -1px;
              color: #000000;
              text-transform: uppercase;
            }
            .content {
              padding: 0 40px 40px;
              background-color: #ffffff;
            }
            .content p {
              margin: 0 0 24px 0;
              font-size: 16px;
              line-height: 1.7;
              color: #000000;
              font-weight: 400;
            }
            .content p:last-child {
              margin-bottom: 0;
            }
            .notification-details {
              margin: 40px 0;
              padding: 24px;
              background-color: #f8f8f8;
              border-left: 4px solid #000000;
            }
            .notification-details h3 {
              margin: 0 0 16px 0;
              font-size: 14px;
              font-weight: 700;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .notification-details p {
              margin: 8px 0;
              font-size: 14px;
              color: #000000;
            }
            .notification-details .detail-label {
              font-weight: 600;
              display: inline-block;
              min-width: 80px;
            }
            .footer {
              padding: 40px 40px 60px;
              text-align: center;
              border-top: 1px solid #e5e5e5;
              margin-top: 40px;
              background-color: #ffffff;
            }
            .footer p {
              margin: 0;
              font-size: 12px;
              color: #000000;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 500;
            }
            .divider {
              height: 1px;
              background-color: #e5e5e5;
              margin: 40px 0;
              width: 60px;
              margin-left: auto;
              margin-right: auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Guardian</h1>
              <div class="divider"></div>
            </div>
            <div class="content">
              <p>${mainMessage}</p>
              
              <div class="notification-details">
                <h3>Event Details</h3>
                <p><span class="detail-label">User:</span> ${username}</p>
                ${deviceName ? `<p><span class="detail-label">Device:</span> ${deviceName}</p>` : ''}
                <p><span class="detail-label">Type:</span> ${notificationType.toUpperCase()}</p>
                ${stopCode ? `<p><span class="detail-label">Internal Stop Code:</span> ${stopCode}</p>` : ''}
              </div>
            </div>
            <div class="footer">
              <p>Notification sent at: ${formattedTimestamp}</p>
            </div>
          </div>
        </body>
        </html>`;

      const mailOptions = {
        from: smtpFromName
          ? `${smtpFromName} <${smtpFromEmail}>`
          : smtpFromEmail,
        to: recipientEmails,
        subject,
        text: `${subject}\n\n${mainMessage}\n\nUser: ${username}${deviceName ? `\nDevice: ${deviceName}` : ''}\nType: ${notificationType.toUpperCase()}${stopCode ? `\nReason: ${stopCode}` : ''}\n\nNotification sent at: ${formattedTimestamp}`,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      this.logger.log(
        `Notification email sent successfully for ${notificationType} event: ${username}${deviceName ? ` on ${deviceName}` : ''}`,
      );
    } catch (error) {
      this.logger.error('Failed to send notification email', {
        error: error.message,
        notificationType,
        username,
        deviceName,
        stopCode,
        stack: error.stack,
      });
    }
  }

  private getNotificationEmailContent(
    notificationType: 'block' | 'info' | 'warning' | 'error',
    stopCode?: string,
    username?: string,
    deviceName?: string,
  ): {
    subject: string;
    statusLabel: string;
    statusColor: string;
    mainMessage: string;
  } {
    switch (notificationType) {
      case 'block':
        return {
          subject: `Guardian Alert: Stream Blocked${deviceName ? ` - ${deviceName}` : ''}`,
          statusLabel: 'STREAM BLOCKED',
          statusColor: '#ff4444',
          mainMessage: stopCode ? this.getStopCodeDescription(stopCode) : 'A streaming session has been blocked on your Plex server',
        };
      case 'warning':
        return {
          subject: `Guardian Warning${deviceName ? ` - ${deviceName}` : ''}`,
          statusLabel: 'WARNING',
          statusColor: '#ffaa00',
          mainMessage:
            'Guardian has detected an issue that requires your attention.',
        };
      case 'error':
        return {
          subject: `Guardian Error${deviceName ? ` - ${deviceName}` : ''}`,
          statusLabel: 'ERROR',
          statusColor: '#ff4444',
          mainMessage: 'Guardian has encountered an error during operation.',
        };
      case 'info':
      default:
        return {
          subject: `Guardian Notification${deviceName ? ` - ${deviceName}` : ''}`,
          statusLabel: 'NOTIFICATION',
          statusColor: '#4488ff',
          mainMessage: 'Guardian has a new notification for your Plex server.',
        };
    }
  }

  private getStopCodeDescription(stopCode: string): string {
    switch (stopCode) {
      case 'DEVICE_PENDING':
        return 'A streaming session was blocked because the device requires administrator approval';
      case 'DEVICE_REJECTED':
        return 'A streaming session was blocked because the device has been rejected by an administrator';
      case 'IP_POLICY_LAN_ONLY':
        return 'A streaming session was blocked because the device attempted external access but is restricted to local network only';
      case 'IP_POLICY_WAN_ONLY':
        return 'A streaming session was blocked because the device attempted local access but is restricted to external connections only';
      case 'IP_POLICY_NOT_ALLOWED':
        return 'A streaming session was blocked because the device IP address is not in the approved access list';
      case 'TIME_RESTRICTED':
        return 'A streaming session was blocked due to time-based scheduling restrictions';
      default:
        return `A streaming session was blocked: ${stopCode}`;
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

      this.logger.log(
        `Database export completed: ${settings.length} settings, ${userDevices.length} devices, ${userPreferences.length} preferences`,
      );

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.logger.error('Error exporting database:', error);
      throw new Error('Failed to export database');
    }
  }

  async importDatabase(
    importData: any,
  ): Promise<{ imported: number; skipped: number }> {
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
              where: { key: setting.key },
            });

            // Skip importing APP_VERSION if the import file has an older version than the current code
            if (
              setting.key === 'APP_VERSION' &&
              this.compareVersions(setting.value, CURRENT_APP_VERSION) < 0
            ) {
              this.logger.log(
                `Skipping import of APP_VERSION (${setting.value}) to avoid downgrading from current version (${CURRENT_APP_VERSION})`,
              );
              skipped++;
              continue;
            }

            this.logger.debug(
              'Importing setting:',
              setting.key,
              'Existing:',
              !!existing,
            );

            if (existing) {
              existing.value = setting.value;
              await this.settingsRepository.save(existing);
              imported++;
            } else {
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
        const deviceRepo =
          this.settingsRepository.manager.getRepository(UserDevice);
        for (const device of data.userDevices) {
          try {
            const existing = await deviceRepo.findOne({
              where: {
                userId: device.userId,
                deviceIdentifier: device.deviceIdentifier,
              },
            });

            this.logger.debug(
              `Importing device ${device.deviceIdentifier} for user ${device.userId}, existing:`,
              !!existing,
            );

            if (!existing) {
              const newDevice = deviceRepo.create(device);
              await deviceRepo.save(newDevice);
              imported++;
              this.logger.debug(
                `Created new device: ${device.deviceIdentifier}`,
              );
            } else {
              // Update existing device with new data
              Object.assign(existing, device);
              await deviceRepo.save(existing);
              imported++;
              this.logger.debug(
                `Updated existing device: ${device.deviceIdentifier}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to import device ${device.deviceIdentifier}:`,
              error,
            );
            skipped++;
          }
        }
      }

      // Import user preferences
      if (data.userPreferences && Array.isArray(data.userPreferences)) {
        const prefRepo =
          this.settingsRepository.manager.getRepository(UserPreference);
        for (const pref of data.userPreferences) {
          try {
            const existing = await prefRepo.findOne({
              where: { userId: pref.userId },
            });

            this.logger.debug(
              `Importing preference for user ${pref.userId}, existing:`,
              !!existing,
            );

            if (!existing) {
              const newPref = prefRepo.create(pref);
              await prefRepo.save(newPref);
              imported++;
              this.logger.debug(
                `Created new preference for user: ${pref.userId}`,
              );
            } else {
              // Update existing preference
              existing.defaultBlock = pref.defaultBlock;
              existing.username = pref.username || existing.username;
              await prefRepo.save(existing);
              imported++;
              this.logger.debug(
                `Updated existing preference for user: ${pref.userId}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to import preference for user ${pref.userId}:`,
              error,
            );
            skipped++;
          }
        }
      }

      // Refresh cache after import
      await this.loadCache();

      this.logger.log(
        `Database import completed: ${imported} items imported, ${skipped} items skipped`,
      );

      return {
        imported,
        skipped,
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

      if (
        versionSetting &&
        this.compareVersions(CURRENT_APP_VERSION, versionSetting.value) > 0
      ) {
        this.logger.log(
          `Updating app version from ${versionSetting.value} to: ${CURRENT_APP_VERSION}`,
        );
        versionSetting.value = CURRENT_APP_VERSION;
        await this.settingsRepository.save(versionSetting);
        this.logger.log('App version updated successfully');
      } else if (
        versionSetting &&
        this.compareVersions(CURRENT_APP_VERSION, versionSetting.value) < 0
      ) {
        this.logger.error(
          `WARNING: Current app version ${CURRENT_APP_VERSION} is older than your data version ${versionSetting.value}. Please check your installation.`,
        );
      } else {
        this.logger.log(`App version is up to date: ${CURRENT_APP_VERSION}`);
      }
    } catch (error) {
      this.logger.warn('Failed to update app version:', error);
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const parseVersion = (version: string): number[] => {
      return version.split('.').map((v) => parseInt(v) || 0);
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
    const dbVersion =
      (await this.getSetting('APP_VERSION')) || CURRENT_APP_VERSION;
    // Version mismatch occurs when database version > current code version (downgrade scenario)
    const isVersionMismatch =
      this.compareVersions(dbVersion, CURRENT_APP_VERSION) > 0;

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

      await this.settingsRepository.manager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .clear();
          this.logger.debug('Session history table cleared');

          await transactionalEntityManager.getRepository(Notification).clear();
          this.logger.debug('Notifications table cleared');

          await transactionalEntityManager
            .getRepository(UserPreference)
            .clear();
          this.logger.debug('User preferences table cleared');

          await transactionalEntityManager.getRepository(UserDevice).clear();
          this.logger.debug('User devices table cleared');

          await transactionalEntityManager.getRepository(AppSettings).clear();
          this.logger.debug('App settings table cleared');
        },
      );

      // Reinitialize default settings
      await this.initializeDefaultSettings();

      // Clear cache
      this.cache.clear();

      this.logger.warn(
        'Database reset completed - all data has been deleted and default settings restored',
      );
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
          currentSessionKey: () => 'NULL',
        })
        .execute();

      this.logger.log(
        `Stream counts reset for ${result.affected || 0} devices`,
      );
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

      await this.settingsRepository.manager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .clear();
          this.logger.debug('Session history cleared');

          await transactionalEntityManager.getRepository(Notification).clear();
          this.logger.debug('Notifications cleared');

          await transactionalEntityManager.getRepository(UserDevice).clear();
          this.logger.debug('User devices cleared');
        },
      );

      this.logger.warn(
        `All ${deviceCount} devices and related data have been deleted`,
      );
    } catch (error) {
      this.logger.error('Failed to delete all devices:', error);
      throw new Error(`Device deletion failed: ${error.message}`);
    }
  }

  async clearAllSessionHistory(): Promise<void> {
    try {
      this.logger.warn('CLEARING ALL SESSION HISTORY per user request');

      // Get count before deletion for logging
      const sessionCount = await this.settingsRepository.manager
        .getRepository(SessionHistory)
        .count();

      await this.settingsRepository.manager.transaction(
        async (transactionalEntityManager) => {
          // Clear all session history
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .clear();
          this.logger.debug('Session history cleared');
        },
      );

      this.logger.warn(
        `All ${sessionCount} session history records have been cleared`,
      );
    } catch (error) {
      this.logger.error('Failed to clear session history:', error);
      throw new Error(`Session history clearing failed: ${error.message}`);
    }
  }
}
