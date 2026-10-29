import { Injectable, Logger } from '@nestjs/common';
import { PlexResponse, PlexErrorCode } from '@/types/plex-errors';
import { ConfigService } from '@/modules/config/services/config.service';
import { EmailService } from '@/modules/config/services/email.service';
import { PlexConnectionService } from '@/modules/config/services/plex-connection.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import { EmailTemplateService } from '@/modules/config/services/email-template.service';
import { asHttpError, errorMessage } from '@/common/utils/error-types';
import {
  createSmtpTransport,
  senderAddress,
  SMTPConfig,
  smtpErrorMessage,
  toSmtpConfig,
  validateSmtpConfig,
} from '@/modules/config/services/smtp-config';

export interface PlexConfigurationStatus {
  configured: boolean;
  hasValidCredentials: boolean;
  connectionStatus: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
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
    private readonly emailTemplateService: EmailTemplateService,
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

  async testSMTPConnection(): Promise<ConnectionTestResult> {
    try {
      const settings = await this.emailService.loadSmtpSettings();
      if (!settings.SMTP_ENABLED) {
        return {
          success: false,
          message: 'SMTP email notifications are disabled',
        };
      }

      const smtpConfig = toSmtpConfig(settings);
      const validationError = validateSmtpConfig(smtpConfig);
      if (validationError) {
        return { success: false, message: validationError };
      }

      const currentTimeInTimezone =
        await this.configService.getCurrentTimeInTimezone();
      const timestamp = this.timezoneService.formatTimestamp(
        currentTimeInTimezone,
      );

      return await this.sendSmtpTestEmail(smtpConfig, timestamp);
    } catch (error) {
      this.logger.error('Error in testSMTPConnection:', error);
      return {
        success: false,
        message: `Unexpected error: ${errorMessage(error)}`,
      };
    }
  }

  private async sendSmtpTestEmail(
    config: SMTPConfig,
    timestamp: string,
  ): Promise<ConnectionTestResult> {
    try {
      const transporter = createSmtpTransport(config);
      await transporter.verify();
      await transporter.sendMail({
        from: senderAddress(config),
        to: config.toEmails,
        subject: 'Guardian SMTP Test - Connection Successful',
        text: 'This is a test email from Guardian to verify SMTP configuration. If you received this email, your SMTP settings are working correctly.',
        html: this.emailTemplateService.generateSMTPTestEmail(timestamp),
      });

      const recipients = config.toEmails.join(', ');
      this.logger.log(
        `SMTP test email sent successfully to ${config.toEmails.length} recipient(s): ${recipients}`,
      );

      const recipientText =
        config.toEmails.length === 1
          ? config.toEmails[0]
          : `${config.toEmails.length} recipients (${recipients})`;
      return {
        success: true,
        message: `SMTP connection successful! Test email sent to ${recipientText}`,
      };
    } catch (caught) {
      const error = asHttpError(caught);
      this.logger.error('SMTP Connection Test Failed', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack,
      });
      return { success: false, message: smtpErrorMessage(error) };
    }
  }

  async testAppriseConnection(): Promise<ConnectionTestResult> {
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
