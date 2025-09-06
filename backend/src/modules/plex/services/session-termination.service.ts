import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { PlexClient } from './plex-client';
import { ActiveSessionService } from '../../sessions/services/active-session.service';
import { UsersService } from '../../users/services/users.service';
import {
  PlexSessionsResponse,
  SessionTerminationResult,
} from '../../../types/plex.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const stopMessage =
  process.env.PLEXGUARD_STOPMSG ||
  'This device must be approved by the server owner. Please contact the server administrator for more information.';

@Injectable()
export class SessionTerminationService {
  private readonly logger = new Logger(SessionTerminationService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private plexClient: PlexClient,
    private activeSessionService: ActiveSessionService,
    private usersService: UsersService,
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
            const sessionKey = session.Session?.id;

            if (sessionKey) {
              await this.terminateSession(sessionKey);
              stoppedSessions.push(sessionKey);

              this.logger.warn(`Stopped unapproved session: ${session}`);
              const username = session.User?.title || 'Unknown';
              const deviceName =
                `${session.Player?.device} - ${session.Player?.title}` ||
                'Unknown Device';

              this.logger.warn(
                `Stopped unapproved session: ${username} on ${deviceName} (Session: ${sessionKey})`,
              );
            } else {
              this.logger.warn(
                'Could not find session identifier in session data',
              );
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

      if (!device) {
        this.logger.warn(
          `Device not found for user ${userId} with identifier ${deviceIdentifier}`,
        );
        const defaultBlock = await this.usersService.getEffectiveDefaultBlock(userId);
        return defaultBlock;
      }

      return device.status !== 'approved'; // Stop if device is not approved
    } catch (error) {
      this.logger.error('Error checking session approval status', error);
      return false; // Don't stop on error to be safe
    }
  }

  async terminateSession(
    sessionKey: string,
    reason: string = stopMessage,
  ): Promise<void> {
    try {
      this.logger.log(`Terminating session ${sessionKey} with reason: ${reason}`);

      await this.plexClient.terminateSession(sessionKey, reason);

      // Remove session from database
      try {
        await this.activeSessionService.removeSession(sessionKey);
      } catch (dbError) {
        this.logger.warn(
          `Failed to remove session ${sessionKey} from database`,
          dbError,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionKey}`, error);
      throw error;
    }
  }
}
