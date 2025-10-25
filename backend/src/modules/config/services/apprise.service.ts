import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { spawn } from 'child_process';
import { ConfigService } from './config.service';

export interface AppriseConfig {
  enabled: boolean;
  urls: string[];
}

export interface AppriseNotificationData {
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  tag?: string;
}

@Injectable()
export class AppriseService {
  private readonly logger = new Logger(AppriseService.name);

  constructor(
      @Inject(forwardRef(() => ConfigService))
      private configService: ConfigService,
    ) {}

  async sendNotification(
    appriseData: AppriseNotificationData,
  ): Promise<{ success: boolean; message: string }> {
    const appriseConfiguration = await this.getAppriseConfig();

    // Check if we got a valid configuration or an error message
    if ('success' in appriseConfiguration) {
      return {
        success: false,
        message: appriseConfiguration.message,
      };
    }

    try {
      const result = await this.executeApprise(appriseConfiguration.urls, appriseData);

      if (result.success) {
        this.logger.log(`Apprise notification sent successfully to ${appriseConfiguration.urls.length} service(s)`);
      } else {
        this.logger.error(`Apprise notification failed: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error sending Apprise notification:', error);
      return {
        success: false,
        message: `Apprise notification error: ${error.message}`,
      };
    }
  }

  async sendNewDeviceNotification(
    username: string,
    deviceName: string,
    devicePlatform: string,
    ipAddress: string,
  ): Promise<{ success: boolean; message: string }> {
    
    const notificationData: AppriseNotificationData = {
      title: 'New Device Detected - Guardian',
      body: `A new device has been detected and requires approval:\n\n` +
            `👤 User: ${username}\n` +
            `Device: ${deviceName}${devicePlatform}\n` +
            `IP Address: ${ipAddress}\n` +
            `⏰ Status: Pending Approval\n\n` +
            `Please review and approve/reject this device in Guardian.`,
      type: 'warning',
      tag: 'new-device',
    };

    return this.sendNotification(notificationData);
  }

  async getAppriseConfig(): Promise<AppriseConfig | { success: boolean; message: string }> {
    const [appriseEnabled, appriseUrls, notifyOnNewDevices] = await Promise.all([
      this.configService.getSetting('APPRISE_ENABLED'),
      this.configService.getSetting('APPRISE_URLS'),
      this.configService.getSetting('APPRISE_NOTIFY_ON_NEW_DEVICES'),
    ]);

    // Handle case where Apprise is disabled
    if (appriseEnabled !== 'true') {
      this.logger.warn('Apprise is disabled in configuration');
      return { success: false, message: 'Apprise is disabled' };
    }

    // Validate urls
    const validUrls = appriseUrls
      .split(/[,:\n]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (validUrls.length === 0) {
      this.logger.warn('No valid Apprise URLs found');
      return { success: false, message: 'No valid Apprise URLs found' };
    }

    const config: AppriseConfig = {
      enabled: appriseEnabled === 'true',
      urls: validUrls
    };

    return config;
  }

  async testAppriseConnection(
  ): Promise<{ success: boolean; message: string }> {   

    // Get current Apprise configuration
    const appriseConfig = await this.getAppriseConfig();

    // Check if we got a valid configuration or an error message
    if ('success' in appriseConfig) {
      return {
        success: false,
        message: appriseConfig.message,
      };
    }

    const testData: AppriseNotificationData = {
      title: 'Guardian Apprise Test',
      body: `This is a test notification from Guardian.\n\n` +
            `Apprise integration is working correctly!\n` +
            `Sent at: ${new Date().toISOString()}\n\n` +
            `You should receive this notification on all configured services.`,
      type: 'info',
      tag: 'test',
    };

    try {
      const result = await this.sendNotification(testData);
      
      if (result.success) {
        return {
          success: true,
          message: `Test notification sent successfully to ${appriseConfig.urls.length} service(s)`,
        };
      } else {
        return {
          success: false,
          message: `Test notification failed: ${result.message}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Test notification error: ${error.message}`,
      };
    }
  }

  private async executeApprise(
    urls: string[],
    data: AppriseNotificationData,
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const args = [
        '-vv', // Verbose output for debugging
        '--title', data.title,
        '--body', data.body,
      ];

      // Add notification type if specified
      if (data.type) {
        args.push('--type', data.type);
      }

      // Add tag if specified
      if (data.tag) {
        args.push('--tag', data.tag);
      }

      // Add all URLs
      urls.forEach(url => {
        args.push(url);
      });

      this.logger.debug(`Executing apprise with args: ${args.join(' ')}`);

      const appriseProcess = spawn('apprise', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      appriseProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      appriseProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      appriseProcess.on('close', (code) => {
        this.logger.debug(`Apprise process exited with code ${code}`);
        this.logger.debug(`Apprise stdout: ${stdout}`);
        
        if (stderr) {
          this.logger.debug(`Apprise stderr: ${stderr}`);
        }

        if (code === 0) {
          resolve({
            success: true,
            message: 'Notification sent successfully',
          });
        } else {
          resolve({
            success: false,
            message: `Apprise exited with code ${code}: ${stderr || stdout}`,
          });
        }
      });

      appriseProcess.on('error', (error) => {
        this.logger.error('Apprise process error:', error);
        resolve({
          success: false,
          message: `Failed to spawn apprise process: ${error.message}`,
        });
      });

      // Set a timeout for the process
      setTimeout(() => {
        if (!appriseProcess.killed) {
          appriseProcess.kill();
          resolve({
            success: false,
            message: 'Apprise process timed out after 30 seconds',
          });
        }
      }, 30000);
    });
  }
}