import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { PlexClient } from './plex-client';
import { UsersService } from '../../users/services/users.service';
import { TimePolicyService } from '../../users/services/time-policy.service';
import { ConfigService } from '../../config/services/config.service';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import {
  PlexSessionsResponse,
  SessionTerminationResult,
} from '../../../types/plex.types';
import { IPValidationService } from '../../../common/services/ip-validation.service';

export interface StreamBlockedEvent {
  userId: string;
  username: string;
  deviceIdentifier: string;
  stopCode?: string;
  sessionKey?: string;
  ipAddress?: string;
}

/**
 * Session Termination Service
 *
 * Validates session access based on device approval, IP policies, and time rules.
 * Terminates unauthorized sessions and emits events when streams are blocked.
 */
@Injectable()
export class SessionTerminationService {
  private readonly logger = new Logger(SessionTerminationService.name);
  private streamBlockedCallbacks: Array<(event: StreamBlockedEvent) => void> =
    [];

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    private plexClient: PlexClient,
    private usersService: UsersService,
    private timePolicyService: TimePolicyService,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    @Inject(forwardRef(() => DeviceTrackingService))
    private deviceTrackingService: DeviceTrackingService,
    private ipValidationService: IPValidationService,
  ) {}

  /** Register callback for stream blocked events */
  onStreamBlocked(callback: (event: StreamBlockedEvent) => void): void {
    this.streamBlockedCallbacks.push(callback);
  }

  /** Emit stream blocked event to all registered callbacks */
  private emitStreamBlockedEvent(event: StreamBlockedEvent): void {
    for (const callback of this.streamBlockedCallbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in stream blocked callback', error);
      }
    }
  }

  /** Validates IP access for a session based on user preferences */
  private async validateIPAccess(
    session: any,
  ): Promise<{ allowed: boolean; reason?: string; stopCode?: string }> {
    try {
      const userId = session.User?.id || session.User?.uuid;
      const clientIP = session.Player?.address;

      if (!userId) {
        return { allowed: true };
      }

      if (!clientIP) {
        return {
          allowed: false,
          reason: 'Invalid or missing client IP address from Plex',
        };
      }

      // Get user preferences
      const userPreference = await this.userPreferenceRepository.findOne({
        where: { userId },
      });

      if (!userPreference) {
        return { allowed: true };
      }
      const [msgLanOnly, msgWanOnly, msgNotAllowed] = await Promise.all([
        this.configService.getSetting('MSG_IP_LAN_ONLY'),
        this.configService.getSetting('MSG_IP_WAN_ONLY'),
        this.configService.getSetting('MSG_IP_NOT_ALLOWED'),
      ]);
      return this.ipValidationService.validateIPAccess(
        clientIP,
        {
          networkPolicy: userPreference.networkPolicy || 'both',
          ipAccessPolicy: userPreference.ipAccessPolicy || 'all',
          allowedIPs: userPreference.allowedIPs || [],
        },
        {
          lanOnly: (msgLanOnly as string) || 'Only LAN access is allowed',
          wanOnly: (msgWanOnly as string) || 'Only WAN access is allowed',
          notAllowed:
            (msgNotAllowed as string) ||
            'Your current IP address is not in the allowed list',
        },
      );
    } catch (error) {
      this.logger.error('Error validating IP access', error);
      return { allowed: true };
    }
  }

  async stopUnapprovedSessions(
    sessionsData: PlexSessionsResponse,
  ): Promise<SessionTerminationResult> {
    const stoppedSessions: string[] = [];
    const errors: string[] = [];

    try {
      const sessions = sessionsData?.MediaContainer?.Metadata || [];

      if (!sessions || sessions.length === 0) {
        return { stoppedSessions, errors };
      }

      for (const session of sessions) {
        try {
          const shouldStopResult = await this.shouldStopSession(session);

          if (shouldStopResult.shouldStop) {
            const sessionId = session.Session?.id; // Session ID for termination
            const deviceIdentifier =
              session.Player?.machineIdentifier || 'unknown'; // Device identifier for notification lookup
            const sessionKey = session.sessionKey; // Session key for history lookup

            if (sessionId) {
              const username = session.User?.title || 'Unknown';
              const deviceName = session.Player?.title || 'Unknown Device';
              const userId = session.User?.id || 'unknown';
              const reason = shouldStopResult.reason;
              const stopCode = shouldStopResult.stopCode;

              await this.terminateSession(sessionId, reason);
              stoppedSessions.push(sessionId);
              this.emitStreamBlockedEvent({
                userId,
                username,
                deviceIdentifier,
                stopCode,
                sessionKey,
                ipAddress: session.Player?.address,
              });

              this.logger.warn(
                `Stopped session: ${username} on ${deviceName} (Session: ${sessionId}) - Reason: ${reason}`,
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

  private async shouldStopSession(
    session: any,
  ): Promise<{ shouldStop: boolean; reason?: string; stopCode?: string }> {
    try {
      const userId = session.User?.id || session.User?.uuid;
      const deviceIdentifier = session.Player?.machineIdentifier;

      if (!userId || !deviceIdentifier) {
        this.logger.warn(
          'Session missing user ID or device identifier, cannot determine approval status',
        );
        return { shouldStop: false };
      }
      if (session.Player?.product === 'Plexamp') {
        return { shouldStop: false };
      }
      const ipValidation = await this.validateIPAccess(session);
      if (!ipValidation.allowed) {
        this.logger.warn(
          `IP access denied for user ${userId}: ${ipValidation.reason}`,
        );
        return {
          shouldStop: true,
          reason: `${ipValidation.reason}`,
          stopCode: ipValidation.stopCode,
        };
      }
      const isTimeAllowed = await this.timePolicyService.isTimeScheduleAllowed(
        userId,
        deviceIdentifier,
      );
      if (!isTimeAllowed) {
        const timePolicySummary = await this.timePolicyService.getPolicySummary(
          userId,
          deviceIdentifier,
        );
        this.logger.warn(
          `Device ${deviceIdentifier} for user ${userId} is blocked by time policy: ${timePolicySummary}`,
        );

        // Get the configured message or use a detailed default
        const configMessage = (await this.configService.getSetting(
          'MSG_TIME_RESTRICTED',
        )) as string;

        return {
          shouldStop: true,
          reason:
            configMessage ||
            `Streaming is not allowed at this time due to time restrictions (Policy: ${timePolicySummary})`,
          stopCode: 'TIME_RESTRICTED',
        };
      }
      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });
      if (!device || device.status === 'pending') {
        // Check if device has valid temporary access
        if (
          device &&
          (await this.deviceTrackingService.isTemporaryAccessValid(device))
        ) {
          return { shouldStop: false };
        }
        const shouldBlock =
          await this.usersService.getEffectiveDefaultBlock(userId);
        if (shouldBlock) {
          const message =
            ((await this.configService.getSetting(
              'MSG_DEVICE_PENDING',
            )) as string) ||
            'Device Pending Approval. The server owner must approve this device before it can be used.';
          return {
            shouldStop: true,
            reason: message,
            stopCode: 'DEVICE_PENDING',
          };
        }
        return { shouldStop: false };
      }

      if (device.status === 'rejected') {
        if (await this.deviceTrackingService.isTemporaryAccessValid(device)) {
          return { shouldStop: false };
        }

        this.logger.warn(
          `Device ${deviceIdentifier} for user ${userId} is explicitly rejected.`,
        );
        const message =
          ((await this.configService.getSetting(
            'MSG_DEVICE_REJECTED',
          )) as string) ||
          'You are not authorized to use this device. Please contact the server administrator for more information.';
        return {
          shouldStop: true,
          reason: message,
          stopCode: 'DEVICE_REJECTED',
        };
      }

      return { shouldStop: false };
    } catch (error) {
      this.logger.error('Error checking session approval status', error);
      return { shouldStop: false };
    }
  }

  async terminateSession(sessionKey: string, reason?: string): Promise<void> {
    try {
      if (!reason) {
        reason =
          ((await this.configService.getSetting(
            'MSG_DEVICE_PENDING',
          )) as string) ||
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
