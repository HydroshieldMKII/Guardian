import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EMAIL_PALETTE } from '@/common/utils/email-palette';
import { NotificationEmailType } from '@/common/utils/notification-email-type';

type TemplateVars = Record<string, string>;

const LOGO_VIEW_BOX = '0 250 1024 266';

const ASSET_DIRECTORIES = [
  () => join(process.cwd(), 'backend', 'src', 'assets'),
  () => join(process.cwd(), 'src', 'assets'),
  () => join(__dirname, '..', 'assets'),
  () => join(__dirname, '..', '..', 'assets'),
  () => join(__dirname, '..', '..', '..', 'assets'),
];

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  private readAsset(...segments: string[]): string | null {
    for (const directory of ASSET_DIRECTORIES) {
      try {
        return readFileSync(join(directory(), ...segments), 'utf8');
      } catch {
        continue;
      }
    }
    return null;
  }

  private template(name: string, vars: TemplateVars = {}): string {
    const source = this.readAsset('email', name);
    if (source === null) {
      this.logger.error(`Email template not found: ${name}`);
      return '';
    }
    return this.fill(source, vars);
  }

  private fill(source: string, vars: TemplateVars): string {
    return source.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => vars[key] ?? '',
    );
  }

  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
  }

  private renderLogo(): string {
    const contents = this.readAsset('logo_dark.svg');
    if (contents === null) {
      this.logger.warn('Logo file not found, using text fallback');
      return this.template('logo-fallback.html');
    }

    const cropped = contents.replace(
      /viewBox="[^"]*"/,
      `viewBox="${LOGO_VIEW_BOX}"`,
    );

    return this.template('logo.html', {
      logoDataUri: `data:image/svg+xml;base64,${Buffer.from(cropped).toString('base64')}`,
    });
  }

  private detailRow(
    label: string,
    value: string,
    valueAttributes = '',
  ): string {
    return this.template('detail-row.html', {
      label,
      value,
      valueAttributes,
    });
  }

  private ipDetailRow(label: string, address: string): string {
    return this.detailRow(
      label,
      `<a href="https://ipinfo.io/${address}" target="_blank" rel="noopener noreferrer" style="color: #4488ff; text-decoration: underline;">${address}</a>`,
    );
  }

  private renderLayout(options: {
    accentColor: string;
    mainMessage: string;
    timestamp: string;
    footerText?: string;
    detailsTitle?: string;
    detailRows?: string;
    action?: string;
  }): string {
    const footerTag = options.footerText
      ? this.template('footer-tag.html', { footerText: options.footerText })
      : '';

    const details =
      options.detailsTitle && options.detailRows
        ? this.template('details.html', {
            detailsTitle: options.detailsTitle,
            detailRows: options.detailRows,
          })
        : '';

    return this.template('layout.html', {
      styles: this.readAsset('email', 'styles.css') ?? '',
      accentColor: options.accentColor,
      logo: this.renderLogo(),
      mainMessage: options.mainMessage,
      action: options.action ?? '',
      details,
      footerTag,
      timestamp: options.timestamp,
    });
  }

  generatePasswordResetEmail(
    username: string,
    resetUrl: string,
    expiresInMinutes: number,
    timestamp: string,
  ): string {
    const safeUsername = this.escapeHtml(username);
    const safeUrl = this.escapeHtml(resetUrl);
    const accentColor = EMAIL_PALETTE.accent;

    return this.renderLayout({
      accentColor,
      mainMessage: `Someone asked to reset the password for <strong>${safeUsername}</strong>. If that was not you, you can safely ignore this email.`,
      timestamp,
      action: this.template('action.html', {
        accentColor,
        url: safeUrl,
        label: 'Choose a new password',
        fallbackText: `This link works once and expires in ${expiresInMinutes} minutes. If the button does not work, paste this address into your browser:`,
      }),
    });
  }

  generateSMTPTestEmail(timestamp: string): string {
    return this.renderLayout({
      accentColor: EMAIL_PALETTE.positive,
      mainMessage:
        'SMTP configuration test completed successfully. Your email settings are working correctly and notifications are ready to send.',
      footerText: 'SMTP Test',
      timestamp,
    });
  }

  generateNotificationEmail(
    notificationType: NotificationEmailType,
    statusColor: string,
    mainMessage: string,
    username: string,
    deviceName?: string,
    stopCode?: string,
    timestamp?: string,
    ipAddress?: string,
    oldIpAddress?: string,
    note?: string,
  ): string {
    const safeDeviceName = deviceName ? this.escapeHtml(deviceName) : undefined;
    const safeNote = note ? this.escapeHtml(note) : undefined;
    const safeStopCode = stopCode ? this.escapeHtml(stopCode) : undefined;
    const safeIpAddress = ipAddress ? encodeURIComponent(ipAddress) : undefined;
    const safeOldIpAddress = oldIpAddress
      ? encodeURIComponent(oldIpAddress)
      : undefined;

    const rows = [this.detailRow('User', this.escapeHtml(username))];

    if (safeDeviceName) {
      rows.push(this.detailRow('Device', safeDeviceName));
    }

    if (safeOldIpAddress && safeIpAddress) {
      rows.push(this.ipDetailRow('Old IP', safeOldIpAddress));
      rows.push(this.ipDetailRow('New IP', safeIpAddress));
    } else if (safeIpAddress) {
      rows.push(this.ipDetailRow('IP Address', safeIpAddress));
    }

    rows.push(
      this.detailRow(
        'Type',
        `<span class="notification-type" style="background-color: ${statusColor};">${notificationType.toUpperCase()}</span>`,
      ),
    );

    if (safeStopCode) {
      rows.push(
        this.detailRow(
          'Code',
          `<span class="stop-code">${safeStopCode}</span>`,
        ),
      );
    }

    if (safeNote && notificationType === 'device-note') {
      rows.push(
        this.detailRow('Note', safeNote, ' style="white-space: pre-wrap;"'),
      );
    }

    return this.renderLayout({
      accentColor: statusColor,
      mainMessage: this.escapeHtml(mainMessage),
      detailsTitle: 'Event Details',
      detailRows: rows.join(''),
      footerText: 'Notification System',
      timestamp: timestamp || '',
    });
  }
}
