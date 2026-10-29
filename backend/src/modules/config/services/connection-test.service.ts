import { Injectable, Logger } from '@nestjs/common';
import { PlexResponse, PlexErrorCode } from '@/types/plex-errors';
import { ConfigService } from '@/modules/config/services/config.service';
import { EmailService } from '@/modules/config/services/email.service';
import { PlexConnectionService } from '@/modules/config/services/plex-connection.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import { errorMessage } from '@/common/utils/error-types';

export interface PlexConfigurationStatus {
  configured: boolean;
  hasValidCredentials: boolean;
  connectionStatus: string;
}

@Injectable()
export class ConnectionTestService {
  private readonly logger = new Logger(ConnectionTestService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly plexConnectionService: PlexConnectionService,
    private readonly emailService: EmailService,
    private readonly timezoneService: TimezoneService,
    private readonly appriseService: AppriseService,
  ) {}

  async testPlexConnection(): Promise<PlexResponse> {
    try {
      const [ip, port, token, useSSL, ignoreCertErrors] = await Promise.all([
        this.configService.getSetting('PLEX_SERVER_IP'),
        this.configService.getSetting('PLEX_SERVER_PORT'),
        this.configService.getSetting('PLEX_TOKEN'),
        this.configService.getSetting('USE_SSL'),
        this.configService.getSetting('IGNORE_CERT_ERRORS'),
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

      const currentTimeInTimezone =
        await this.configService.getCurrentTimeInTimezone();
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

  async getPlexConfigurationStatus(): Promise<PlexConfigurationStatus> {
    try {
      const [ip, port, token] = await Promise.all([
        this.configService.getSetting('PLEX_SERVER_IP'),
        this.configService.getSetting('PLEX_SERVER_PORT'),
        this.configService.getSetting('PLEX_TOKEN'),
      ]);

      if (!(ip && port && token)) {
        return {
          configured: false,
          hasValidCredentials: false,
          connectionStatus: 'Not configured',
        };
      }

      const connectionResult = await this.testPlexConnection();

      return {
        configured: true,
        hasValidCredentials: connectionResult.success,
        connectionStatus: connectionResult.success
          ? connectionResult.message || 'Connected successfully'
          : `${connectionResult.errorCode}: ${connectionResult.message}`,
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
}
