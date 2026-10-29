import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@/modules/config/services/config.service';
import { errorMessage } from '@/common/utils/error-types';
import { StopCode } from '@/common/utils/stop-codes';
import {
  AppriseNotificationData,
  AppriseResult,
  runApprise,
} from '@/modules/config/services/apprise-cli';
import {
  blockedStreamMessage,
  deviceNoteMessage,
  locationChangeMessage,
  newDeviceMessage,
  testMessage,
} from '@/modules/config/services/apprise-messages';

export interface AppriseConfig {
  enabled: boolean;
  urls: string[];
}

type AppriseEventSetting =
  | 'APPRISE_NOTIFY_ON_NEW_DEVICE'
  | 'APPRISE_NOTIFY_ON_BLOCK'
  | 'APPRISE_NOTIFY_ON_LOCATION_CHANGE'
  | 'APPRISE_NOTIFY_ON_DEVICE_NOTE';

const APPRISE_URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*:\/\/.+$/;

const isValidAppriseUrl = (url: string): boolean =>
  url.length >= 5 && APPRISE_URL_PATTERN.test(url);

@Injectable()
export class AppriseService {
  private readonly logger = new Logger(AppriseService.name);

  constructor(private configService: ConfigService) {}

  async sendNotification(
    appriseData: AppriseNotificationData,
  ): Promise<AppriseResult> {
    const appriseConfiguration = await this.getAppriseConfig();

    if ('success' in appriseConfiguration) {
      return { success: false, message: appriseConfiguration.message };
    }

    try {
      const result = await runApprise(
        appriseConfiguration.urls,
        appriseData,
        this.logger,
      );

      if (result.success) {
        this.logger.log(
          `Apprise notification sent successfully to ${appriseConfiguration.urls.length} service(s)`,
        );
      } else {
        this.logger.error(`Apprise notification failed: ${result.message}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Error sending Apprise notification:', error);
      return {
        success: false,
        message: `Apprise notification error: ${errorMessage(error)}`,
      };
    }
  }

  sendNewDeviceNotification(
    username: string,
    deviceName: string,
    ipAddress: string,
  ): Promise<AppriseResult> {
    return this.sendIfEnabled(
      'APPRISE_NOTIFY_ON_NEW_DEVICE',
      'new devices',
      newDeviceMessage(username, deviceName, ipAddress),
    );
  }

  sendBlockedNotification(
    username: string,
    deviceName: string,
    ipAddress?: string,
    stopCode?: StopCode,
  ): Promise<AppriseResult> {
    return this.sendIfEnabled(
      'APPRISE_NOTIFY_ON_BLOCK',
      'blocked streams',
      blockedStreamMessage(username, deviceName, ipAddress, stopCode),
    );
  }

  sendLocationChangeNotification(
    username: string,
    deviceName: string,
    oldIpAddress: string,
    newIpAddress: string,
  ): Promise<AppriseResult> {
    return this.sendIfEnabled(
      'APPRISE_NOTIFY_ON_LOCATION_CHANGE',
      'location changes',
      locationChangeMessage(username, deviceName, oldIpAddress, newIpAddress),
    );
  }

  sendDeviceNoteNotification(
    username: string,
    deviceName: string,
    note: string,
  ): Promise<AppriseResult> {
    return this.sendIfEnabled(
      'APPRISE_NOTIFY_ON_DEVICE_NOTE',
      'device notes',
      deviceNoteMessage(username, deviceName, note),
    );
  }

  async getAppriseConfig(): Promise<AppriseConfig | AppriseResult> {
    const [appriseEnabled, appriseUrls] = await Promise.all([
      this.configService.getSetting('APPRISE_ENABLED'),
      this.configService.getSetting('APPRISE_URLS'),
    ]);

    if (appriseEnabled !== true) {
      this.logger.warn('Apprise is disabled');
      return { success: false, message: 'Apprise is disabled' };
    }

    if (!appriseUrls || appriseUrls.trim().length === 0) {
      this.logger.warn('No Apprise URLs configured');
      return { success: false, message: 'No Apprise URLs configured' };
    }

    const urlList = appriseUrls
      .split(/[,;\n]+/)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    const invalidUrls = urlList.filter((url) => !isValidAppriseUrl(url));

    if (invalidUrls.length > 0) {
      this.logger.warn(`Invalid Apprise URLs found: ${invalidUrls.join(', ')}`);
      return {
        success: false,
        message: `Invalid service URLs found: ${invalidUrls.join(', ')}. Please check the URL format.`,
      };
    }

    if (urlList.length === 0) {
      this.logger.warn('No valid Apprise URLs found');
      return { success: false, message: 'No valid Apprise URLs found' };
    }

    return { enabled: appriseEnabled, urls: urlList };
  }

  async testAppriseConnection(): Promise<AppriseResult> {
    const appriseConfig = await this.getAppriseConfig();

    if ('success' in appriseConfig) {
      return { success: false, message: appriseConfig.message };
    }

    const result = await this.sendNotification(testMessage);

    return result.success
      ? {
          success: true,
          message: `Test notification sent successfully to ${appriseConfig.urls.length} service(s)`,
        }
      : { success: false, message: result.message };
  }

  private async sendIfEnabled(
    setting: AppriseEventSetting,
    eventLabel: string,
    data: AppriseNotificationData,
  ): Promise<AppriseResult> {
    if ((await this.configService.getSetting(setting)) !== true) {
      const message = `Apprise notification for ${eventLabel} is disabled`;
      this.logger.log(message);
      return { success: false, message };
    }

    return this.sendNotification(data);
  }
}
