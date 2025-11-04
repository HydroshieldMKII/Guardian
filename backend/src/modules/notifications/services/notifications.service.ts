import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';
import { AppriseService } from '../../config/services/apprise.service';
import { EmailService } from '../../config/services/email.service';
import { Logger } from '@nestjs/common';

export interface CreateNotificationDto {
  userId: string;
  text: string;
  type?: 'info' | 'warning' | 'error' | 'block';
  sessionHistoryId?: number;
}

export interface NotificationResponseDto {
  id: number;
  userId: string;
  username: string;
  deviceName?: string;
  text: string;
  type: string;
  read: boolean;
  createdAt: Date;
  sessionHistoryId?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private configService: ConfigService,
    private appriseService: AppriseService,
    private emailService: EmailService,
  ) {}

  async createNotification(
    createDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: createDto.userId,
      text: createDto.text,
      type: createDto.type || 'info',
      sessionHistoryId: createDto.sessionHistoryId,
      read: false,
    });

    return await this.notificationRepository.save(notification);
  }

  async createNewDeviceNotification(
    userId: string,
    username: string,
    deviceName: string,
    ipAddress: string,
    sessionHistoryId?: number,
  ): Promise<Notification> {
    const text = `New device detected for ${username} on ${deviceName} - ${ipAddress}`;
    const notification = await this.createNotification({
      userId,
      text,
      type: 'info',
      sessionHistoryId,
    });

    // Send email notification for new device if enabled
    try {
      const [smtpEnabled, smtpNotifyOnNewDevice] = await Promise.all([
        this.configService.getSetting('SMTP_ENABLED'),
        this.configService.getSetting('SMTP_NOTIFY_ON_NEW_DEVICE'),
      ]);

      if (smtpEnabled && smtpNotifyOnNewDevice) {
        await this.emailService.sendNewDeviceEmail(
          text,
          username,
          deviceName,
          ipAddress,
        );
      } else {
        this.logger.log('SMTP email notification for new device is disabled.');
      }
    } catch (error) {
      console.error('Failed to send new device notification email:', error);
    }

    // Send Apprise notification for new device if enabled
    try {
      const [appriseEnabled, appriseNotifyOnNewDevice] = await Promise.all([
        this.configService.getSetting('APPRISE_ENABLED'),
        this.configService.getSetting('APPRISE_NOTIFY_ON_NEW_DEVICE'),
      ]);

      if (appriseEnabled && appriseNotifyOnNewDevice) {
        await this.appriseService.sendNewDeviceNotification(
          username,
          deviceName,
          ipAddress,
        );
      } else {
        this.logger.log('Apprise notification for new device is disabled.');
      }
    } catch (error) {
      console.error('Failed to send Apprise new device notification:', error);
    }

    return notification;
  }

  async createStreamBlockedNotification(
    userId: string,
    username: string,
    deviceIdentifier: string,
    stopCode?: string,
    sessionHistoryId?: number,
    ipAddress?: string,
  ): Promise<Notification> {
    // Look up the custom device name from the database
    let deviceDisplayName = 'Unknown Device'; // Default if not found

    try {
      const userDevice = await this.userDeviceRepository.findOne({
        where: {
          userId: userId,
          deviceIdentifier: deviceIdentifier,
        },
      });

      if (userDevice && userDevice.deviceName) {
        deviceDisplayName = userDevice.deviceName; // Use custom name from database
      }
    } catch (error) {
      // If lookup fails, use default
      console.warn('Failed to lookup custom device name:', error);
    }

    let text: string;

    if (stopCode) {
      switch (stopCode) {
        case 'DEVICE_PENDING':
          text = `Stream blocked for ${username} on ${deviceDisplayName} - device needs approval`;
          break;
        case 'DEVICE_REJECTED':
          text = `Stream blocked for ${username} on ${deviceDisplayName} - device is not allowed`;
          break;
        case 'IP_POLICY_LAN_ONLY':
          text = `Stream blocked for ${username} on ${deviceDisplayName} - device attempted WAN access but is restricted to LAN only`;
          break;
        case 'IP_POLICY_WAN_ONLY':
          text = `Stream blocked for ${username} on ${deviceDisplayName} - device attempted LAN access but is restricted to WAN only`;
          break;
        case 'IP_POLICY_NOT_ALLOWED':
          text = `Stream blocked for ${username} on ${deviceDisplayName} - IP address is not in the allowed list`;
          break;
        case 'TIME_RESTRICTED':
          text = `Stream blocked for ${username} on ${deviceDisplayName} - user schedule doesn't allow streaming at this moment`;
          break;
        default:
          text = `Stream blocked for ${username} on ${deviceDisplayName} - ${stopCode}`;
          break;
      }
    } else {
      // Fallback to generic message if no stop code provided
      text = `Stream blocked for ${username} on ${deviceDisplayName}`;
    }
    const notification = await this.createNotification({
      userId,
      text,
      type: 'block',
      sessionHistoryId,
    });

    // Send email notification for stream blocking if enabled
    try {
      const [smtpEnabled, smtpNotifyOnBlock] = await Promise.all([
        this.configService.getSetting('SMTP_ENABLED'),
        this.configService.getSetting('SMTP_NOTIFY_ON_BLOCK'),
      ]);

      if (smtpEnabled && smtpNotifyOnBlock) {
        await this.emailService.sendBlockedEmail(
          username,
          deviceDisplayName,
          stopCode || 'N/A',
          ipAddress,
        );
      } else {
        this.logger.log(
          'SMTP email notification for stream blocking is disabled.',
        );
      }
    } catch (error) {
      console.error('Failed to send stream blocked notification email:', error);
    }

    // Send Apprise notification for stream blocking if enabled
    try {
      const [appriseEnabled, appriseNotifyOnBlock] = await Promise.all([
        this.configService.getSetting('APPRISE_ENABLED'),
        this.configService.getSetting('APPRISE_NOTIFY_ON_BLOCK'),
      ]);

      if (appriseEnabled && appriseNotifyOnBlock) {
        await this.appriseService.sendBlockedNotification(
          username,
          deviceDisplayName,
          ipAddress,
          stopCode,
        );
      } else {
        this.logger.log(
          'Apprise notification for stream blocking is disabled.',
        );
      }
    } catch (error) {
      console.error(
        'Failed to send Apprise stream blocked notification:',
        error,
      );
    }

    return notification;
  }

  async getNotificationsForUser(
    userId: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.sessionHistory', 'sessionHistory')
      .leftJoinAndSelect('sessionHistory.userPreference', 'userPreference')
      .leftJoinAndSelect('sessionHistory.userDevice', 'userDevice')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .getMany();

    return notifications.map((notification) => ({
      id: notification.id,
      userId: notification.userId,
      username:
        notification.sessionHistory?.userPreference?.username || 'Unknown User',
      deviceName:
        notification.sessionHistory?.userDevice?.deviceName || 'Unknown Device',
      text: notification.text,
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt,
      sessionHistoryId: notification.sessionHistoryId,
    }));
  }

  async getAllNotifications(): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.sessionHistory', 'sessionHistory')
      .leftJoinAndSelect('sessionHistory.userPreference', 'userPreference')
      .leftJoinAndSelect('sessionHistory.userDevice', 'userDevice')
      .orderBy('notification.createdAt', 'DESC')
      .getMany();

    return notifications.map((notification) => ({
      id: notification.id,
      userId: notification.userId,
      username:
        notification.sessionHistory?.userPreference?.username || 'Unknown User',
      deviceName:
        notification.sessionHistory?.userDevice?.deviceName || 'Unknown Device',
      text: notification.text,
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt,
      sessionHistoryId: notification.sessionHistoryId,
    }));
  }

  async markAsRead(
    notificationId: number,
    forced: boolean = false,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    // Check if auto-mark as read is enabled
    if (!forced) {
      const autoMarkRead = await this.configService.getSetting(
        'AUTO_MARK_NOTIFICATION_READ',
      );
      if (!autoMarkRead) {
        return notification;
      }
    }

    notification.read = true;
    return await this.notificationRepository.save(notification);
  }

  async deleteNotification(notificationId: number): Promise<void> {
    const result = await this.notificationRepository.delete(notificationId);

    if (result.affected === 0) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, read: false },
    });
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationRepository.update({ read: false }, { read: true });
  }

  async clearAll(): Promise<void> {
    await this.notificationRepository.clear();
  }

  async linkNotificationToSessionHistory(sessionKey: string): Promise<void> {
    try {
      // Find session history by session key
      const sessionHistory = await this.sessionHistoryRepository.findOne({
        where: { sessionKey },
        order: { startedAt: 'DESC' },
      });

      if (!sessionHistory) {
        this.logger.debug(
          `No session history found for session key: ${sessionKey}`,
        );
        return;
      }

      // Find recent notifications for the same user that don't have a session history link
      const recentNotifications = await this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', {
          userId: sessionHistory.userId,
        })
        .andWhere('notification.sessionHistoryId IS NULL')
        .andWhere('notification.createdAt > :fiveMinutesAgo', {
          fiveMinutesAgo: new Date(Date.now() - 5 * 60 * 1000),
        })
        .orderBy('notification.createdAt', 'DESC')
        .limit(5)
        .getMany();

      // Link the most recent device detection notification
      for (const notification of recentNotifications) {
        if (notification.text.includes('New device detected')) {
          await this.notificationRepository.update(notification.id, {
            sessionHistoryId: sessionHistory.id,
          });
          this.logger.debug(
            `Linked notification ${notification.id} to session history ${sessionHistory.id}`,
          );
          break; // Only link the first matching notification
        }
      }
    } catch (error) {
      this.logger.error(
        `Error linking notification to session history for ${sessionKey}:`,
        error,
      );
    }
  }
}
