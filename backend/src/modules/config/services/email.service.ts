import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailTemplateService } from './email-template.service';
import { StopCodeUtils } from '../../../common/utils/stop-code.utils';

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName?: string;
  useTLS: boolean;
  toEmails: string[];
}

export interface NotificationEmailData {
  type: 'block' | 'info' | 'warning' | 'error';
  text: string;
  username: string;
  deviceName?: string;
  stopCode?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  private createTransporter(config: SMTPConfig) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.useTLS && config.port === 465,
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });
  }

  private parseEmailAddresses(emailString: string): string[] {
    return emailString
      .split(/[,;\n]/)
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0);
  }

  private validateEmailAddresses(emails: string[]): string[] {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.filter((email) => !emailRegex.test(email));
  }

  private validateSMTPConfig(config: SMTPConfig): string | null {
    if (
      !config.host ||
      !config.port ||
      !config.user ||
      !config.password ||
      !config.fromEmail
    ) {
      return 'Missing required SMTP configuration (host, port, user, password, or from email)';
    }

    if (config.useTLS && config.port !== 465 && config.port !== 587) {
      return 'TLS is not supported on this port. Please use port 465 or 587.';
    }

    if (config.toEmails.length === 0) {
      return 'No recipient email addresses configured. Please provide at least one recipient.';
    }

    const invalidEmails = this.validateEmailAddresses(config.toEmails);
    if (invalidEmails.length > 0) {
      return `Invalid email format(s): ${invalidEmails.join(', ')}`;
    }

    return null;
  }

  async testSMTPConnection(
    config: SMTPConfig,
    enabled: boolean,
    timestamp: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!enabled) {
        return {
          success: false,
          message: 'SMTP email notifications are disabled',
        };
      }

      const validationError = this.validateSMTPConfig(config);
      if (validationError) {
        return {
          success: false,
          message: validationError,
        };
      }

      const transporter = this.createTransporter(config);
      await transporter.verify();

      const emailHtml = this.emailTemplateService.generateSMTPTestEmail(
        config.toEmails,
        timestamp,
      );

      const testMailOptions = {
        from: config.fromName
          ? `${config.fromName} <${config.fromEmail}>`
          : config.fromEmail,
        to: config.toEmails,
        subject: 'Guardian SMTP Test - Connection Successful',
        text: 'This is a test email from Guardian to verify SMTP configuration. If you received this email, your SMTP settings are working correctly.',
        html: emailHtml,
      };

      await transporter.sendMail(testMailOptions);

      const recipientCount = config.toEmails.length;
      const recipientText =
        recipientCount === 1
          ? config.toEmails[0]
          : `${recipientCount} recipients (${config.toEmails.join(', ')})`;

      this.logger.log(
        `SMTP test email sent successfully to ${recipientCount} recipient(s): ${config.toEmails.join(', ')}`,
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
        userMessage = 'Connection timed out. Please check your email settings.';
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
    config: SMTPConfig,
    data: NotificationEmailData,
    enabled: boolean,
    notifyOnNotifications: boolean,
    timestamp: string,
  ): Promise<void> {
    try {
      if (!enabled || !notifyOnNotifications) {
        return; // Email notifications are disabled
      }

      const validationError = this.validateSMTPConfig(config);
      if (validationError) {
        this.logger.warn(`SMTP notification email skipped: ${validationError}`);
        return;
      }

      const transporter = this.createTransporter(config);

      const { subject, statusLabel, statusColor, mainMessage } =
        this.getNotificationEmailContent(
          data.type,
          data.stopCode,
          data.username,
          data.deviceName,
        );

      const emailHtml = this.emailTemplateService.generateNotificationEmail(
        data.type,
        statusColor,
        statusLabel,
        mainMessage,
        data.username,
        data.deviceName,
        data.stopCode,
        timestamp,
      );

      const mailOptions = {
        from: config.fromName
          ? `${config.fromName} <${config.fromEmail}>`
          : config.fromEmail,
        to: config.toEmails,
        subject,
        text: `${subject}\n\n${mainMessage}\n\nUser: ${data.username}${data.deviceName ? `\nDevice: ${data.deviceName}` : ''}\nType: ${data.type.toUpperCase()}${data.stopCode ? `\nReason: ${data.stopCode}` : ''}\n\nNotification sent at: ${timestamp}`,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      this.logger.log(
        `Notification email sent successfully for ${data.type} event: ${data.username}${data.deviceName ? ` on ${data.deviceName}` : ''}`,
      );
    } catch (error) {
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
          mainMessage: stopCode
            ? StopCodeUtils.getStopCodeDescription(stopCode)
            : 'A streaming session has been blocked on your Plex server',
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
}
