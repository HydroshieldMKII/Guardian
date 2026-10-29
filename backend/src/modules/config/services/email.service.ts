import { Injectable, Logger } from '@nestjs/common';
import { EmailTemplateService } from '@/modules/config/services/email-template.service';
import { describeStopCode, StopCode } from '@/common/utils/stop-codes';
import { ConfigService } from '@/modules/config/services/config.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { asHttpError } from '@/common/utils/error-types';
import {
  createSmtpTransport,
  senderAddress,
  SMTPConfig,
  SmtpSettings,
  toSmtpConfig,
  validateSmtpConfig,
} from '@/modules/config/services/smtp-config';
import {
  NotificationEmailData,
  notificationEmailContent,
  notificationEmailText,
} from '@/modules/config/services/notification-email-content';

interface OutgoingMail {
  subject: string;
  text: (timestamp: string) => string;
  html: (timestamp: string) => string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly emailTemplateService: EmailTemplateService,
    private readonly configService: ConfigService,
    private readonly timezoneService: TimezoneService,
  ) {}

  async sendBlockedEmail(
    username: string,
    deviceName: string,
    stopCode: StopCode | undefined,
    ipAddress?: string,
  ): Promise<void> {
    await this.sendEmail({
      type: 'block',
      text: describeStopCode(stopCode),
      username,
      deviceName,
      stopCode,
      ipAddress,
    });
  }

  async sendNewDeviceEmail(
    notificationText: string,
    username: string,
    deviceName?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.sendEmail({
      type: 'new-device',
      text: notificationText,
      username,
      deviceName,
      ipAddress,
    });
  }

  async sendLocationChangeEmail(
    username: string,
    deviceName: string,
    oldIpAddress: string,
    newIpAddress: string,
  ): Promise<void> {
    await this.sendEmail({
      type: 'location-change',
      text: `Device location changed for ${username} on ${deviceName} - ${oldIpAddress} → ${newIpAddress}`,
      username,
      deviceName,
      ipAddress: newIpAddress,
      oldIpAddress,
    });
  }

  async sendDeviceNoteEmail(
    username: string,
    deviceName: string,
    note: string,
  ): Promise<void> {
    await this.sendEmail({
      type: 'device-note',
      text: `${username} left a note on device ${deviceName}`,
      username,
      deviceName,
      note,
    });
  }

  async sendPasswordResetEmail(
    toEmail: string,
    username: string,
    resetUrl: string,
    expiresInMinutes: number,
  ): Promise<void> {
    try {
      const sent = await this.deliver('Password reset email', [toEmail], {
        subject: 'Guardian: Reset your password',
        text: (timestamp) =>
          `Someone asked to reset the password for your Guardian account (${username}).\n\nOpen this link to choose a new password:\n${resetUrl}\n\nThe link expires in ${expiresInMinutes} minutes and works once. If this was not you, you can safely ignore this email.\n\nSent at: ${timestamp}`,
        html: (timestamp) =>
          this.emailTemplateService.generatePasswordResetEmail(
            username,
            resetUrl,
            expiresInMinutes,
            timestamp,
          ),
      });
      if (sent) this.logger.log('Password reset email sent');
    } catch (caught) {
      const error = asHttpError(caught);
      this.logger.error('Failed to send password reset email', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async sendEmail(data: NotificationEmailData): Promise<void> {
    this.logger.debug('Preparing to send notification email with data:', data);

    try {
      const content = notificationEmailContent(data);
      const sent = await this.deliver('SMTP notification email', undefined, {
        subject: content.subject,
        text: (timestamp) => notificationEmailText(data, content, timestamp),
        html: (timestamp) =>
          this.emailTemplateService.generateNotificationEmail(
            data.type,
            content.statusColor,
            content.mainMessage,
            data.username,
            data.deviceName,
            data.stopCode,
            timestamp,
            data.ipAddress,
            data.oldIpAddress,
            data.note,
          ),
      });
      if (sent) {
        this.logger.log(
          `Notification email sent successfully for ${data.type} event: ${data.username}${data.deviceName ? ` on ${data.deviceName}` : ''}`,
        );
      }
    } catch (caught) {
      const error = asHttpError(caught);
      this.logger.error('Failed to send notification email', {
        error: error.message,
        notificationType: data.type,
        username: data.username,
        deviceName: data.deviceName,
        stopCode: data.stopCode,
        stack: error.stack,
      });
    }
  }

  async loadSmtpSettings(): Promise<SmtpSettings> {
    const [
      SMTP_ENABLED,
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASSWORD,
      SMTP_FROM_EMAIL,
      SMTP_FROM_NAME,
      SMTP_USE_TLS,
      SMTP_TO_EMAILS,
    ] = await Promise.all([
      this.configService.getSetting('SMTP_ENABLED'),
      this.configService.getSetting('SMTP_HOST'),
      this.configService.getSetting('SMTP_PORT'),
      this.configService.getSetting('SMTP_USER'),
      this.configService.getSetting('SMTP_PASSWORD'),
      this.configService.getSetting('SMTP_FROM_EMAIL'),
      this.configService.getSetting('SMTP_FROM_NAME'),
      this.configService.getSetting('SMTP_USE_TLS'),
      this.configService.getSetting('SMTP_TO_EMAILS'),
    ]);

    return {
      SMTP_ENABLED: SMTP_ENABLED ?? false,
      SMTP_HOST: SMTP_HOST ?? '',
      SMTP_PORT: SMTP_PORT ?? 0,
      SMTP_USER: SMTP_USER ?? '',
      SMTP_PASSWORD: SMTP_PASSWORD ?? '',
      SMTP_FROM_EMAIL: SMTP_FROM_EMAIL ?? '',
      SMTP_FROM_NAME: SMTP_FROM_NAME ?? '',
      SMTP_USE_TLS: SMTP_USE_TLS ?? false,
      SMTP_TO_EMAILS: SMTP_TO_EMAILS ?? '',
    };
  }

  private async currentTimestamp(): Promise<string> {
    return this.timezoneService.formatTimestamp(
      await this.configService.getCurrentTimeInTimezone(),
    );
  }

  private async deliver(
    label: string,
    recipients: string[] | undefined,
    mail: OutgoingMail,
  ): Promise<boolean> {
    const settings = await this.loadSmtpSettings();
    if (!settings.SMTP_ENABLED) {
      this.logger.log(
        `${label} skipped: SMTP email notifications are disabled`,
      );
      return false;
    }

    const config: SMTPConfig = {
      ...toSmtpConfig(settings),
      ...(recipients && { toEmails: recipients }),
    };
    const validationError = validateSmtpConfig(config);
    if (validationError) {
      this.logger.warn(`${label} skipped: ${validationError}`);
      return false;
    }

    const timestamp = await this.currentTimestamp();
    await createSmtpTransport(config).sendMail({
      from: senderAddress(config),
      to: config.toEmails,
      subject: mail.subject,
      text: mail.text(timestamp),
      html: mail.html(timestamp),
    });
    return true;
  }
}
