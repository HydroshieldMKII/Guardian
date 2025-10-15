import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { SessionHistory } from '../../../entities/session-history.entity';

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
  ) {}

  async createNotification(createDto: CreateNotificationDto): Promise<Notification> {
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
    deviceName: string,
    sessionHistoryId?: number
  ): Promise<Notification> {
    const text = `User ${username} attempted to stream on ${deviceName} but was blocked`;

    //Mark in session history the stream was terminated
    if (sessionHistoryId) {
      const session = await this.sessionHistoryRepository.findOne({
        where: { id: sessionHistoryId }
      });

      if (session) {
        session.terminated = true;
        await this.sessionHistoryRepository.save(session);
      }
    }
    
    return await this.createNotification({
      userId,
      text,
      type: 'block',
      sessionHistoryId,
    });
  }

  async getNotificationsForUser(userId: string): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.sessionHistory', 'sessionHistory')
      .leftJoinAndSelect('sessionHistory.userPreference', 'userPreference')
      .leftJoinAndSelect('sessionHistory.userDevice', 'userDevice')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .getMany();

    return notifications.map(notification => ({
      id: notification.id,
      userId: notification.userId,
      username: notification.sessionHistory?.userPreference?.username || 'Unknown User',
      deviceName: notification.sessionHistory?.userDevice?.deviceName || 'Unknown Device',
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

    return notifications.map(notification => ({
      id: notification.id,
      userId: notification.userId,
      username: notification.sessionHistory?.userPreference?.username || 'Unknown User',
      deviceName: notification.sessionHistory?.userDevice?.deviceName || 'Unknown Device',
      text: notification.text,
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt,
      sessionHistoryId: notification.sessionHistoryId,
    }));
  }

  async markAsRead(notificationId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }

    notification.read = true;
    return await this.notificationRepository.save(notification);
  }

  async deleteNotification(notificationId: number): Promise<void> {
    const result = await this.notificationRepository.delete(notificationId);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, read: false }
    });
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationRepository.update(
      { read: false },
      { read: true }
    );
  }

  async clearAll(): Promise<void> {
    await this.notificationRepository.clear();
  }
}