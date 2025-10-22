import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';

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
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private configService: ConfigService,
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

  async createStreamBlockedNotification(
    userId: string,
    username: string,
    deviceIdentifier: string,
    stopCode?: string,
    sessionHistoryId?: number,
  ): Promise<Notification> {
    // Look up the custom device name from the database
    let deviceDisplayName = 'Unknown Device'; // Default if not found
    
    try {
      const userDevice = await this.userDeviceRepository.findOne({
        where: { 
          userId: userId,
          deviceIdentifier: deviceIdentifier
        }
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
          text = `Stream blocked for ${username} on ${deviceDisplayName} - device has been rejected`;
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
          text = `Stream blocked for ${username} on ${deviceDisplayName} - time scheduling restrictions are in effect`;
          break;
        default:
          text = `Stream blocked for ${username} on ${deviceDisplayName} - ${stopCode}`;
          break;
      }
    } else {
      // Fallback to generic message if no stop code provided
      text = `Stream blocked for ${username} on ${deviceDisplayName}`;
    }

    //Mark in session history the stream was terminated
    if (sessionHistoryId) {
      const session = await this.sessionHistoryRepository.findOne({
        where: { id: sessionHistoryId },
      });

      if (session) {
        session.terminated = true;
        await this.sessionHistoryRepository.save(session);
      }
    }

    const notification = await this.createNotification({
      userId,
      text,
      type: 'block',
      sessionHistoryId,
    });

    // Send email notification for stream blocking if enabled
    try {
      await this.configService.sendNotificationEmail(
        'block',
        text,
        username,
        deviceDisplayName,
        stopCode,
      );
    } catch (error) {
      // Log error but don't fail the notification creation
      console.error('Failed to send stream blocked notification email:', error);
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
}
