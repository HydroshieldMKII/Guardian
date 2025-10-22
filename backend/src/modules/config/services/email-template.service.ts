import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTemplateService {
  private getBaseEmailStyles(): string {
    return `
      @media only screen and (max-width: 600px) {
        .container { width: 100% !important; margin: 0 !important; }
        .header, .content, .footer { padding-left: 20px !important; padding-right: 20px !important; }
        .details { margin: 20px 0 !important; padding: 16px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .header {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .header h1 {
          color: #000000 !important;
        }
        .container {
          background-color: #ffffff !important;
          background: #ffffff !important;
        }
        body {
          background-color: #f5f5f5 !important;
        }
        .email-wrapper {
          background-color: #f5f5f5 !important;
        }
      }
      [data-ogsc] .header {
        background-color: #ffffff !important;
        background: #ffffff !important;
      }
      [data-ogsc] .header h1 {
        color: #000000 !important;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        background-color: #f5f5f5;
        color: #000000;
        line-height: 1.6;
      }
      .email-wrapper {
        background-color: #f5f5f5;
        padding: 40px 20px;
        min-height: 100vh;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }
      .header {
        padding: 50px 40px 30px;
        text-align: center;
        background-color: #ffffff;
        color: #000000;
        position: relative;
      }
      .header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #ff0000, #ff6600, #ffcc00, #00cc66, #0066cc, #6600cc);
      }
      .header h1 {
        margin: 0;
        font-size: 36px;
        font-weight: 800;
        letter-spacing: -1.5px;
        color: #000000;
        text-transform: uppercase;
        text-shadow: none;
      }
      .content {
        padding: 40px 40px 30px;
        background-color: #ffffff;
      }
      .badge {
        display: inline-block;
        padding: 8px 16px;
        color: #ffffff !important;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-radius: 20px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      .main-message {
        margin: 0 0 32px 0;
        font-size: 18px;
        line-height: 1.7;
        color: #000000;
        font-weight: 500;
      }
      .details {
        margin: 32px 0;
        padding: 24px;
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        border: 1px solid #e9ecef;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      .details h3 {
        margin: 0 0 20px 0;
        font-size: 14px;
        font-weight: 700;
        color: #000000;
        text-transform: uppercase;
        letter-spacing: 1px;
        display: flex;
        align-items: center;
      }
      .detail-row {
        display: flex;
        margin: 12px 0;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-label {
        font-weight: 700;
        color: #666666;
        min-width: 100px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .detail-value {
        color: #000000;
        font-weight: 500;
        font-size: 14px;
        flex: 1;
      }
      .footer {
        padding: 30px 40px 40px;
        text-align: center;
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        border-top: 1px solid #e9ecef;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #666666;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 500;
      }
      .timestamp {
        display: inline-block;
        background-color: #f1f3f4;
        padding: 6px 12px;
        border-radius: 6px;
        margin-top: 8px;
      }
      .stop-code {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        background-color: #f1f3f4;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        color: #000000;
      }
      .notification-type {
        display: inline-block;
        color: #ffffff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
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
  ): string {
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
          <div class="header">
            <h1>Guardian</h1>
          </div>
          <div class="content">
            <div class="badge" style="background-color: ${badgeColor};">${badgeText}</div>
            <p class="main-message">${mainMessage}</p>
            
            <div class="details" style="border-left: 4px solid ${badgeColor};">
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

  generateSMTPTestEmail(recipientEmails: string[], timestamp: string): string {
    const detailsContent = `
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">SMTP Verified</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Recipients</span>
        <span class="detail-value">${recipientEmails.join(', ')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Test Type</span>
        <span class="detail-value">Connection & Delivery</span>
      </div>
    `;

    return this.generateBaseEmailHtml(
      '#00aa00',
      'Test Successful',
      'SMTP configuration test completed successfully. Your email settings are working correctly and Guardian is ready to send notifications.',
      'Test Details',
      detailsContent,
      'SMTP Test',
      timestamp,
    );
  }

  generateNotificationEmail(
    notificationType: 'block' | 'info' | 'warning' | 'error',
    statusColor: string,
    statusLabel: string,
    mainMessage: string,
    username: string,
    deviceName?: string,
    stopCode?: string,
    timestamp?: string,
  ): string {
    let detailsContent = `
      <div class="detail-row">
        <span class="detail-label">User</span>
        <span class="detail-value">${username}</span>
      </div>
    `;

    if (deviceName) {
      detailsContent += `
        <div class="detail-row">
          <span class="detail-label">Device</span>
          <span class="detail-value">${deviceName}</span>
        </div>
      `;
    }

    detailsContent += `
      <div class="detail-row">
        <span class="detail-label">Type</span>
        <span class="detail-value"><span class="notification-type" style="background-color: ${statusColor};">${notificationType.toUpperCase()}</span></span>
      </div>
    `;

    if (stopCode) {
      detailsContent += `
        <div class="detail-row">
          <span class="detail-label">Stop Code</span>
          <span class="detail-value"><span class="stop-code">${stopCode}</span></span>
        </div>
      `;
    }

    return this.generateBaseEmailHtml(
      statusColor,
      statusLabel,
      mainMessage,
      'Event Details',
      detailsContent,
      'Notification System',
      timestamp || '',
    );
  }
}
