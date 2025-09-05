import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../entities/user-device.entity';
import { ActiveSessionService } from '../services/active-session.service';
import {
  PlexSessionsResponse,
  SessionTerminationResult,
} from '../types/plex.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const stopMessage =
  process.env.PLEXGUARD_STOPMSG ||
  'This device must be approved by the server owner. Please contact the server administrator for more information.';

@Injectable()
export class StopSessionService {
  private readonly logger = new Logger(StopSessionService.name);
  private readonly proxyPort = process.env.PLEXGUARD_PROXY_PORT || '8080';

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private activeSessionService: ActiveSessionService,
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

            console.log('Stopping session for session:', session);

            if (sessionKey) {
              await this.terminateSession(sessionKey);
              stoppedSessions.push(sessionKey);

              console.log(`Stopped unapproved session: ${session}`);
              const username = session.User?.title || 'Unknown';
              const deviceName =
                `${session.Player?.device} - ${session.Player?.title}` ||
                'Unknown Device';

              this.logger.warn(
                `🛑 Stopped unapproved session: ${username} on ${deviceName} (Session: ${sessionKey})`,
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
        return true; // Stop unknown devices
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
      const proxyUrl = `http://localhost:${this.proxyPort}/status/sessions/terminate`;
      const params = new URLSearchParams({
        sessionId: sessionKey, // Note: 'sessionId' with capital 'I', not 'sessionKey'
        reason: reason,
      });

      const fullUrl = `${proxyUrl}?${params.toString()}`;

      this.logger.log(
        `Terminating session ${sessionKey} via GET request to: ${fullUrl}`,
      );

      const response = await fetch(fullUrl, {
        method: 'GET', // GET request as per Plex API documentation
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': 'plex-guard',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        );
      }

      this.logger.log(`Successfully terminated session ${sessionKey}`);

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
