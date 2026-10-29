import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, IsNull, MoreThan, Repository } from 'typeorm';
import { Notification } from '@/entities/notification.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { LiveEventsService } from '@/modules/events/live-events.service';
import { UNKNOWN_DEVICE } from '@/modules/notifications/services/notification-text';

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
  deviceName?: string | null;
  text: string;
  type: string;
  read: boolean;
  createdAt: Date;
  sessionHistoryId?: number | null;
}

const NOTIFICATION_RELATIONS: FindOptionsRelations<Notification> = {
  sessionHistory: { userPreference: true, userDevice: true },
};

const toResponse = (notification: Notification): NotificationResponseDto => ({
  id: notification.id,
  userId: notification.userId,
  username:
    notification.sessionHistory?.userPreference?.username || 'Unknown User',
  deviceName:
    notification.sessionHistory?.userDevice?.deviceName || UNKNOWN_DEVICE,
  text: notification.text,
  type: notification.type,
  read: notification.read,
  createdAt: notification.createdAt,
  sessionHistoryId: notification.sessionHistoryId,
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    private configService: ConfigService,
    private liveEvents: LiveEventsService,
  ) {}

  private async publishNotifications(): Promise<void> {
    if (!this.liveEvents.hasListeners()) {
      return;
    }

    try {
      this.liveEvents.broadcastNotifications(await this.getAllNotifications());
    } catch (error) {
      this.logger.error('Failed to broadcast notification update:', error);
    }
  }

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

    const saved = await this.notificationRepository.save(notification);
    await this.publishNotifications();
    return saved;
  }

  async getNotificationsForUser(
    userId: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository.find({
      where: { userId },
      relations: NOTIFICATION_RELATIONS,
      order: { createdAt: 'DESC' },
    });

    return notifications.map(toResponse);
  }

  async getAllNotifications(): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository.find({
      relations: NOTIFICATION_RELATIONS,
      order: { createdAt: 'DESC' },
    });

    return notifications.map(toResponse);
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

    if (!forced) {
      const autoMarkRead = await this.configService.getSetting(
        'AUTO_MARK_NOTIFICATION_READ',
      );
      if (!autoMarkRead) {
        return notification;
      }
    }

    notification.read = true;
    const saved = await this.notificationRepository.save(notification);
    await this.publishNotifications();
    return saved;
  }

  async deleteNotification(notificationId: number): Promise<void> {
    const result = await this.notificationRepository.delete(notificationId);

    if (result.affected === 0) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    await this.publishNotifications();
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, read: false },
    });
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationRepository.update({ read: false }, { read: true });
    await this.publishNotifications();
  }

  async clearAll(): Promise<void> {
    await this.notificationRepository.clear();
    await this.publishNotifications();
  }

  async linkNotificationToSessionHistory(sessionKey: string): Promise<void> {
    try {
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

      this.logger.debug(
        `Searching for orphaned notifications for userId: ${sessionHistory.userId}, sessionHistoryId to link: ${sessionHistory.id}`,
      );

      const recentNotifications = await this.notificationRepository.find({
        where: {
          userId: sessionHistory.userId,
          sessionHistoryId: IsNull(),
          createdAt: MoreThan(new Date(Date.now() - 5 * 60 * 1000)),
        },
        order: { createdAt: 'DESC' },
        take: 5,
      });

      this.logger.debug(
        `Found ${recentNotifications.length} orphaned notifications for user ${sessionHistory.userId}`,
      );

      for (const notification of recentNotifications) {
        if (notification.text.includes('New device detected')) {
          await this.notificationRepository.update(notification.id, {
            sessionHistoryId: sessionHistory.id,
          });
          this.logger.log(
            `Linked notification ${notification.id} to session history ${sessionHistory.id} for session key ${sessionKey}`,
          );
          await this.publishNotifications();
          break;
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
