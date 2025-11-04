import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { NotificationsService } from './notifications.service';

export interface NewDeviceNotificationData {
  userId: string;
  username: string;
  deviceName: string;
  ipAddress: string;
  sessionKey?: string;
}

export interface StreamBlockedNotificationData {
  userId: string;
  username: string;
  deviceIdentifier: string;
  stopCode?: string;
  sessionKey?: string;
  ipAddress?: string;
}

/**
 * Notification Orchestrator Service
 *
 * Coordinates all notification-related operations:
 * - Creating notifications
 * - Linking notifications to session history
 * - Sending external notifications (email, Apprise)
 *
 * Handles race conditions between device detection and session history creation.
 */
@Injectable()
export class NotificationOrchestratorService {
  private readonly logger = new Logger(NotificationOrchestratorService.name);

  constructor(
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private notificationsService: NotificationsService,
  ) {}

  /** Creates notification for a newly detected device */
  async notifyNewDevice(
    data: NewDeviceNotificationData,
  ): Promise<Notification> {
    try {
      // Try to find session history if session key is provided
      const sessionHistoryId = data.sessionKey
        ? await this.findSessionHistoryId(data.sessionKey)
        : undefined;
      return await this.notificationsService.createNewDeviceNotification(
        data.userId,
        data.username,
        data.deviceName,
        data.ipAddress,
        sessionHistoryId,
      );
    } catch (error) {
      this.logger.error('Error creating new device notification', error);
      throw error;
    }
  }

  /** Creates notification for a blocked stream */
  async notifyStreamBlocked(
    data: StreamBlockedNotificationData,
  ): Promise<Notification> {
    try {
      // Find session history if session key is provided
      const sessionHistoryId = data.sessionKey
        ? await this.findSessionHistoryId(data.sessionKey)
        : undefined;

      if (sessionHistoryId) {
        await this.markSessionTerminated(sessionHistoryId);
      }
      return await this.notificationsService.createStreamBlockedNotification(
        data.userId,
        data.username,
        data.deviceIdentifier,
        data.stopCode,
        sessionHistoryId,
        data.ipAddress,
      );
    } catch (error) {
      this.logger.error('Error creating stream blocked notification', error);
      throw error;
    }
  }

  /** Finds session history ID for a given session key with retry logic */
  private async findSessionHistoryId(
    sessionKey: string,
  ): Promise<number | undefined> {
    try {
      // First attempt: try to find existing session history
      let sessionHistory = await this.sessionHistoryRepository.findOne({
        where: { sessionKey },
        order: { startedAt: 'DESC' },
      });
      if (!sessionHistory) {
        this.logger.debug(
          `Session history not found for key ${sessionKey}, retrying in 1s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));

        sessionHistory = await this.sessionHistoryRepository.findOne({
          where: { sessionKey },
          order: { startedAt: 'DESC' },
        });
      }

      if (sessionHistory) {
        this.logger.debug(
          `Found session history ID ${sessionHistory.id} for session key ${sessionKey}`,
        );
        return sessionHistory.id;
      } else {
        this.logger.warn(
          `Session history not found after retry for session key: ${sessionKey}`,
        );
        return undefined;
      }
    } catch (error) {
      this.logger.error(
        `Error finding session history for key ${sessionKey}:`,
        error,
      );
      return undefined;
    }
  }

  /** Marks a session in history as terminated */
  private async markSessionTerminated(sessionHistoryId: number): Promise<void> {
    try {
      const session = await this.sessionHistoryRepository.findOne({
        where: { id: sessionHistoryId },
      });

      if (session) {
        session.terminated = true;
        await this.sessionHistoryRepository.save(session);
        this.logger.debug(
          `Marked session history ${sessionHistoryId} as terminated`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error marking session ${sessionHistoryId} as terminated:`,
        error,
      );
    }
  }

  /** Links orphaned notifications to their session history */
  async linkOrphanedNotifications(sessionKey: string): Promise<void> {
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
      await this.notificationsService.linkNotificationToSessionHistory(
        sessionKey,
      );
    } catch (error) {
      this.logger.error(
        `Error linking orphaned notifications for ${sessionKey}:`,
        error,
      );
    }
  }
}
