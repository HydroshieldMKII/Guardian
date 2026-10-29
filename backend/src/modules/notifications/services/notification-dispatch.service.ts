import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@/entities/notification.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import { EmailService } from '@/modules/config/services/email.service';
import {
  CreateNotificationDto,
  NotificationsService,
} from '@/modules/notifications/services/notifications.service';
import {
  UNKNOWN_DEVICE,
  deviceNoteText,
  displayDeviceName,
  locationChangeText,
  newDeviceText,
  streamBlockedText,
} from '@/modules/notifications/services/notification-text';
import { StopCode } from '@/common/utils/stop-codes';

type NotificationChannel = 'IN_APP' | 'SMTP' | 'APPRISE';
type NotificationEvent =
  'NEW_DEVICE' | 'BLOCK' | 'LOCATION_CHANGE' | 'DEVICE_NOTE';

interface DispatchRequest {
  event: NotificationEvent;
  label: string;
  inApp: CreateNotificationDto;
  sendEmail: () => Promise<unknown>;
  sendApprise: () => Promise<unknown>;
}

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private appriseService: AppriseService,
    private emailService: EmailService,
  ) {}

  async createNewDeviceNotification(
    userId: string,
    username: string,
    deviceName: string,
    ipAddress: string,
    sessionHistoryId?: number,
  ): Promise<Notification | null> {
    const text = newDeviceText(username, deviceName, ipAddress);

    return this.dispatch({
      event: 'NEW_DEVICE',
      label: 'new device',
      inApp: { userId, text, type: 'info', sessionHistoryId },
      sendEmail: () =>
        this.emailService.sendNewDeviceEmail(
          text,
          username,
          deviceName,
          ipAddress,
        ),
      sendApprise: () =>
        this.appriseService.sendNewDeviceNotification(
          username,
          deviceName,
          ipAddress,
        ),
    });
  }

  async createStreamBlockedNotification(
    userId: string,
    username: string,
    deviceIdentifier: string,
    stopCode?: StopCode,
    sessionHistoryId?: number,
    ipAddress?: string,
  ): Promise<Notification | null> {
    const deviceName = await this.storedDeviceName(userId, deviceIdentifier);

    return this.dispatch({
      event: 'BLOCK',
      label: 'blocked stream',
      inApp: {
        userId,
        text: streamBlockedText(username, deviceName, stopCode),
        type: 'block',
        sessionHistoryId,
      },
      sendEmail: () =>
        this.emailService.sendBlockedEmail(
          username,
          deviceName,
          stopCode,
          ipAddress,
        ),
      sendApprise: () =>
        this.appriseService.sendBlockedNotification(
          username,
          deviceName,
          ipAddress,
          stopCode,
        ),
    });
  }

  async createLocationChangeNotification(
    userId: string,
    username: string,
    deviceName: string,
    oldIpAddress: string,
    newIpAddress: string,
    sessionHistoryId?: number,
  ): Promise<Notification | null> {
    return this.dispatch({
      event: 'LOCATION_CHANGE',
      label: 'location change',
      inApp: {
        userId,
        text: locationChangeText(
          username,
          deviceName,
          oldIpAddress,
          newIpAddress,
        ),
        type: 'info',
        sessionHistoryId,
      },
      sendEmail: () =>
        this.emailService.sendLocationChangeEmail(
          username,
          deviceName,
          oldIpAddress,
          newIpAddress,
        ),
      sendApprise: () =>
        this.appriseService.sendLocationChangeNotification(
          username,
          deviceName,
          oldIpAddress,
          newIpAddress,
        ),
    });
  }

  async createDeviceNoteNotification(
    userId: string,
    username: string,
    deviceName: string | null,
    note: string,
  ): Promise<Notification | null> {
    const resolvedDeviceName = deviceName ?? UNKNOWN_DEVICE;

    return this.dispatch({
      event: 'DEVICE_NOTE',
      label: 'device note',
      inApp: {
        userId,
        text: deviceNoteText(username, resolvedDeviceName, note),
        type: 'info',
      },
      sendEmail: () =>
        this.emailService.sendDeviceNoteEmail(
          username,
          resolvedDeviceName,
          note,
        ),
      sendApprise: () =>
        this.appriseService.sendDeviceNoteNotification(
          username,
          resolvedDeviceName,
          note,
        ),
    });
  }

  private async dispatch(
    request: DispatchRequest,
  ): Promise<Notification | null> {
    let notification: Notification | null = null;
    if (await this.isEnabled('IN_APP', request.event)) {
      notification = await this.notificationsService.createNotification(
        request.inApp,
      );
    } else {
      this.logger.log(`In-app notification for ${request.label} is disabled.`);
    }

    await this.send('SMTP', 'Email', request, request.sendEmail);
    await this.send('APPRISE', 'Apprise', request, request.sendApprise);

    return notification;
  }

  private async send(
    channel: NotificationChannel,
    channelLabel: string,
    { event, label }: DispatchRequest,
    deliver: () => Promise<unknown>,
  ): Promise<void> {
    try {
      if (await this.isEnabled(channel, event)) {
        await deliver();
      } else {
        this.logger.log(
          `${channelLabel} notification for ${label} is disabled.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send ${channelLabel} notification for ${label}:`,
        error,
      );
    }
  }

  private async isEnabled(
    channel: NotificationChannel,
    event: NotificationEvent,
  ): Promise<boolean> {
    const [channelEnabled, eventEnabled] = await Promise.all([
      this.configService.getSetting(`${channel}_ENABLED`),
      this.configService.getSetting(`${channel}_NOTIFY_ON_${event}`),
    ]);
    return Boolean(channelEnabled && eventEnabled);
  }

  private async storedDeviceName(
    userId: string,
    deviceIdentifier: string,
  ): Promise<string> {
    try {
      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });
      return displayDeviceName(device?.deviceName);
    } catch (error) {
      this.logger.warn('Failed to lookup custom device name:', error);
      return displayDeviceName(null);
    }
  }
}
