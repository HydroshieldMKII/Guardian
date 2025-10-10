import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { PlexClient } from './plex-client';
import { UsersService } from '../../users/services/users.service';
import { ConfigService } from '../../config/services/config.service';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  PlexSessionsResponse,
  SessionTerminationResult,
} from '../../../types/plex.types';

@Injectable()
export class SessionTerminationService {
  private readonly logger = new Logger(SessionTerminationService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    private plexClient: PlexClient,
    private usersService: UsersService,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    @Inject(forwardRef(() => DeviceTrackingService))
    private deviceTrackingService: DeviceTrackingService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async stopUnapprovedSessions(
    sessionsData: PlexSessionsResponse,
  ): Promise<SessionTerminationResult> {
    const stoppedSessions: string[] = [];
    const errors: string[] = [];

    try {
      const sessions = sessionsData?.MediaContainer?.Metadata || [];
      // console.log('Checking sessions for unapproved devices:', sessions);

      if (!sessions || sessions.length === 0) {
        return { stoppedSessions, errors };
      }

      for (const session of sessions) {
        try {
          const shouldStop = await this.shouldStopSession(session);

          if (shouldStop) {
            const sessionId = session.Session?.id;
            // console.log('Terminating unapproved session:', session);

            if (sessionId) {
              const username = session.User?.title || 'Unknown';
              const deviceName = session.Player?.title || 'Unknown Device';
              const userId = session.User?.id || 'unknown';

              // Terminate the session
              await this.terminateSession(sessionId);
              stoppedSessions.push(sessionId);

              // Create notification for the terminated session
              try {
                const sessionHistory = await this.sessionHistoryRepository.findOne({
                  where: { sessionKey: sessionId }
                });
                
                await this.notificationsService.createStreamBlockedNotification(
                  userId,
                  username,
                  deviceName,
                  sessionHistory?.id
                );

                this.logger.log(`Created notification for terminated session: ${username} on ${deviceName}`);
              } catch (notificationError) {
                this.logger.error(`Failed to create notification for terminated session ${sessionId}`, notificationError);
              }

              this.logger.warn(`Stopped unapproved session: ${session.Session?.id}`);
              this.logger.warn(
                `Stopped unapproved session: ${username} on ${deviceName} (Session: ${sessionId})`,
              );
            } else {
              this.logger.warn(
                'Could not find session identifier in session data',
              );

              //
            }
          }
        } catch (error) {
          const sessionKey =
            session.sessionKey || session.Session?.id || 'unknown';
          errors.push(
            `Error processing session ${sessionKey}: ${error.message}`,
          );
          this.logger.error(`Error processing session ${sessionKey}`, error);
        }
      }

      return { stoppedSessions, errors };
    } catch (error) {
      this.logger.error('Error stopping unapproved sessions', error);
      throw error;
    }
  }

  private async shouldStopSession(session: any): Promise<boolean> {
    try {
      const userId = session.User?.id || session.User?.uuid;
      const deviceIdentifier = session.Player?.machineIdentifier;

      if (!userId || !deviceIdentifier) {
        this.logger.warn(
          'Session missing user ID or device identifier, cannot determine approval status',
        );
        return false;
      }

      // Check if device is approved
      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });
      
      // If device not found or still pending, check for temporary access first
      if (!device || device.status === 'pending') {
        // Check if device has valid temporary access
        if (device && await this.deviceTrackingService.isTemporaryAccessValid(device)) {
          return false; // Don't stop - temporary access is valid
        }
        return await this.usersService.getEffectiveDefaultBlock(userId);
      }

      if (device.status === 'rejected') {
        // Check if rejected device has valid temporary access
        if (await this.deviceTrackingService.isTemporaryAccessValid(device)) {
          // this.logger.debug(
          //   `Rejected device ${deviceIdentifier} for user ${userId} has valid temporary access, allowing session.`,
          // );
          return false; // Don't stop - temporary access overrides rejection
        }
        
        this.logger.warn(
          `Device ${deviceIdentifier} for user ${userId} is explicitly rejected.`,
        );
        return true; // Always stop if device is rejected and no temporary access
      }

      return false; // no terminate if device is approved
    } catch (error) {
      this.logger.error('Error checking session approval status', error);
      return false; // Don't stop on error to be safe
    }
  }

  async terminateSession(sessionKey: string, reason?: string): Promise<void> {
    try {
      if (!reason) {
        reason =
          ((await this.configService.getSetting('PLEXGUARD_STOPMSG')) as string) ||
          'This device must be approved by the server owner. Please contact the server administrator for more information.';
      }

      this.logger.log(
        `Terminating session ${sessionKey} with reason: ${reason}`,
      );

      await this.plexClient.terminateSession(sessionKey, reason);
      this.logger.log(`Successfully terminated session ${sessionKey}`);
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionKey}`, error);
      throw error;
    }
  }
}
