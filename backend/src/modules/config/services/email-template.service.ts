import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EMAIL_PALETTE } from '@/common/utils/email-palette';

@Injectable()
export class EmailTemplateService {
  /**
   * Escapes HTML entities for email content
   */
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
  private getLogoBase64(): string {
    try {
      const possiblePaths = [
        // If repo root is CWD
        join(process.cwd(), 'backend', 'src', 'assets', 'logo_dark.svg'),
        join(process.cwd(), 'src', 'assets', 'logo_dark.svg'),
        // When running from dist
        join(__dirname, '..', 'assets', 'logo_dark.svg'),
        join(__dirname, '..', '..', 'assets', 'logo_dark.svg'),
        join(__dirname, '..', '..', '..', 'assets', 'logo_dark.svg'),
      ];

      for (const logoPath of possiblePaths) {
        try {
          const logoContent = readFileSync(logoPath, 'utf8');
          const base64Logo = Buffer.from(logoContent).toString('base64');
          return `data:image/svg+xml;base64,${base64Logo}`;
        } catch {
          // Try next path
          continue;
        }
      }

      // If not found, fall back to empty string (text fallback will be used)
      throw new Error('Logo file not found in any expected location');
    } catch (error) {
      console.warn(
        'Logo file not found, using text fallback:',
        error instanceof Error ? error.message : String(error),
      );
      return '';
    }
  }
  private getBaseEmailStyles(): string {
    return `
      @media only screen and (max-width: 600px) {
        .container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
        .email-wrapper { padding: 0 !important; }
        .header, .content, .footer { padding-left: 24px !important; padding-right: 24px !important; }
        .details { margin: 20px 0 !important; padding: 16px !important; }
        .detail-label { min-width: 0 !important; }
      }
      @media (prefers-color-scheme: dark) {
        body { background-color: #f1f5f9 !important; }
        .email-wrapper { background-color: #f1f5f9 !important; }
        .container { background-color: #ffffff !important; background: #ffffff !important; }
        .header { background-color: #ffffff !important; background: #ffffff !important; color: #0f172a !important; }
        .header h1 { color: #0f172a !important; }
      }
      [data-ogsc] .header {
        background-color: #ffffff !important;
        background: #ffffff !important;
      }
      [data-ogsc] .header h1 {
        color: #0f172a !important;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        background-color: #f1f5f9;
        color: #0f172a;
        line-height: 1.6;
      }
      .email-wrapper {
        background-color: #f1f5f9;
        padding: 32px 16px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
      }
      .header {
        padding: 24px 32px 20px;
        text-align: center;
        background-color: #ffffff;
        color: #0f172a;
        border-bottom: 1px solid #e2e8f0;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
        color: #0f172a;
      }
      .logo {
        width: 220px;
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .accent-bar {
        height: 3px;
        font-size: 0;
        line-height: 0;
      }
      .content {
        padding: 32px 32px 8px;
        background-color: #ffffff;
      }
      .badge {
        display: inline-block;
        padding: 6px 12px;
        color: #ffffff !important;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        border-radius: 6px;
        margin-bottom: 20px;
      }
      .main-message {
        margin: 0 0 8px 0;
        font-size: 16px;
        line-height: 1.65;
        color: #0f172a;
      }
      .details {
        margin: 24px 0;
        padding: 20px;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
      }
      .details h3 {
        margin: 0 0 12px 0;
        font-size: 12px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      .detail-row {
        margin: 0;
        padding: 10px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .detail-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .detail-label {
        display: inline-block;
        font-weight: 600;
        color: #64748b;
        min-width: 110px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        vertical-align: top;
      }
      .detail-value {
        display: inline-block;
        color: #0f172a;
        font-weight: 500;
        font-size: 14px;
        max-width: 340px;
        vertical-align: top;
        word-break: break-word;
      }
      .action {
        margin: 24px 0 8px;
        text-align: center;
      }
      .action a.button {
        display: inline-block;
        padding: 14px 28px;
        border-radius: 8px;
        color: #ffffff !important;
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
      }
      .action .fallback {
        margin: 16px 0 0 0;
        font-size: 12px;
        line-height: 1.6;
        color: #64748b;
        word-break: break-all;
      }
      .footer {
        padding: 20px 32px 24px;
        text-align: center;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      .footer p {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 600;
      }
      .timestamp {
        display: inline-block;
        margin-top: 8px;
        padding: 5px 10px;
        border-radius: 6px;
        background-color: #e2e8f0;
        font-size: 12px;
        color: #334155;
      }
      .stop-code {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        background-color: #e2e8f0;
        padding: 3px 7px;
        border-radius: 4px;
        font-size: 12px;
        color: #0f172a;
      }
      .notification-type {
        display: inline-block;
        color: #ffffff;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
    `;
  }

  private generateBaseEmailHtml(
    badgeColor: string,
    badgeText: string,
    mainMessage: string,
    detailsTitle: string,
    detailsContent: string,
    footerText: string,
    timestamp: string,
    actionContent = '',
  ): string {
    const logoBase64 = this.getLogoBase64();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${this.getBaseEmailStyles()}
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="accent-bar" style="background-color: ${badgeColor};">&nbsp;</div>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Guardian Logo" class="logo" />` : '<h1>Guardian</h1>'}
          </div>
          <div class="content">
            <div class="badge" style="background-color: ${badgeColor};">${badgeText}</div>
            <p class="main-message">${mainMessage}</p>
            ${actionContent}
            <div class="details">
              <h3>${detailsTitle}</h3>
              ${detailsContent}
            </div>
          </div>
          <div class="footer">
            <p>${footerText}</p>
            <div class="timestamp">${timestamp}</div>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }

  private ipDetailRow(label: string, address: string): string {
    return `
      <div class="detail-row">
        <span class="detail-label">${label}</span>
        <span class="detail-value"><a href="https://ipinfo.io/${address}" target="_blank" rel="noopener noreferrer" style="color: #4488ff; text-decoration: underline;">${address}</a></span>
      </div>
    `;
  }

  generatePasswordResetEmail(
    username: string,
    resetUrl: string,
    expiresInMinutes: number,
    timestamp: string,
  ): string {
    const safeUsername = this.escapeHtml(username);
    const safeUrl = this.escapeHtml(resetUrl);
    const badgeColor = EMAIL_PALETTE.accent;

    const actionContent = `
      <div class="action">
        <a class="button" href="${safeUrl}" style="background-color: ${badgeColor};">Choose a new password</a>
        <p class="fallback">If the button does not work, paste this address into your browser:<br />${safeUrl}</p>
      </div>
    `;

    const detailsContent = `
      <div class="detail-row">
        <span class="detail-label">Account</span>
        <span class="detail-value">${safeUsername}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Link expires</span>
        <span class="detail-value">${expiresInMinutes} minutes after this email was sent</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Single use</span>
        <span class="detail-value">The link stops working once a new password is set</span>
      </div>
    `;

    return this.generateBaseEmailHtml(
      badgeColor,
      'Password Reset',
      'Someone asked to reset the password for your Guardian account. If that was not you, ignore this email and nothing changes.',
      'Reset Details',
      detailsContent,
      'Password Reset',
      timestamp,
      actionContent,
    );
  }

  generateSMTPTestEmail(recipientEmails: string[], timestamp: string): string {
    const detailsContent = `
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">SMTP Verified</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Recipients</span>
        <span class="detail-value">${recipientEmails
          .map((email) => this.escapeHtml(email))
          .join(', ')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Test Type</span>
        <span class="detail-value">Connection & Delivery</span>
      </div>
    `;

    return this.generateBaseEmailHtml(
      EMAIL_PALETTE.positive,
      'Test Successful',
      'SMTP configuration test completed successfully. Your email settings are working correctly and Guardian is ready to send notifications.',
      'Test Details',
      detailsContent,
      'SMTP Test',
      timestamp,
    );
  }

  generateNotificationEmail(
    notificationType:
      | 'block'
      | 'info'
      | 'warning'
      | 'error'
      | 'new-device'
      | 'location-change'
      | 'device-note',
    statusColor: string,
    statusLabel: string,
    mainMessage: string,
    username: string,
    deviceName?: string,
    stopCode?: string,
    timestamp?: string,
    ipAddress?: string,
    oldIpAddress?: string,
    note?: string,
  ): string {
    const safeUsername = this.escapeHtml(username);
    const safeDeviceName = deviceName ? this.escapeHtml(deviceName) : undefined;
    const safeNote = note ? this.escapeHtml(note) : undefined;
    const safeStopCode = stopCode ? this.escapeHtml(stopCode) : undefined;
    const safeMessage = this.escapeHtml(mainMessage);
    const safeIpAddress = ipAddress ? encodeURIComponent(ipAddress) : undefined;
    const safeOldIpAddress = oldIpAddress
      ? encodeURIComponent(oldIpAddress)
      : undefined;

    let detailsContent = `
      <div class="detail-row">
        <span class="detail-label">User</span>
        <span class="detail-value">${safeUsername}</span>
      </div>
    `;

    if (safeDeviceName) {
      detailsContent += `
        <div class="detail-row">
          <span class="detail-label">Device</span>
          <span class="detail-value">${safeDeviceName}</span>
        </div>
      `;
    }

    // Special handling for location change - show both old and new IP
    if (safeOldIpAddress && safeIpAddress) {
      detailsContent += `
        ${this.ipDetailRow('Old IP', safeOldIpAddress)}
        ${this.ipDetailRow('New IP', safeIpAddress)}
      `;
    } else if (safeIpAddress) {
      detailsContent += this.ipDetailRow('IP Address', safeIpAddress);
    }

    detailsContent += `
      <div class="detail-row">
        <span class="detail-label">Type</span>
        <span class="detail-value"><span class="notification-type" style="background-color: ${statusColor};">${notificationType.toUpperCase()}</span></span>
      </div>
    `;

    if (safeStopCode) {
      detailsContent += `
        <div class="detail-row">
          <span class="detail-label">Code</span>
          <span class="detail-value"><span class="stop-code">${safeStopCode}</span></span>
        </div>
      `;
    }

    if (safeNote && notificationType === 'device-note') {
      detailsContent += `
        <div class="detail-row">
          <span class="detail-label">Note</span>
          <span class="detail-value" style="white-space: pre-wrap;">${safeNote}</span>
        </div>
      `;
    }

    return this.generateBaseEmailHtml(
      statusColor,
      statusLabel,
      safeMessage,
      'Event Details',
      detailsContent,
      'Notification System',
      timestamp || '',
    );
  }
}
