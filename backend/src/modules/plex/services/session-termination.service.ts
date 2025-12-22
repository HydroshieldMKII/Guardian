import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { PlexClient } from './plex-client';
import { UsersService } from '../../users/services/users.service';
import { TimePolicyService } from '../../users/services/time-policy.service';
import { ConcurrentStreamService } from '../../users/services/concurrent-stream.service';
import { ConfigService } from '../../config/services/config.service';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import {
  PlexSessionsResponse,
  SessionTerminationResult,
  isPlexampSession,
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
 * Validates session access based on device approval, IP policies, time rules,
 * and concurrent stream limits.
 * Terminates unauthorized sessions and emits events when streams are blocked.
 */
@Injectable()
export class SessionTerminationService {
  private readonly logger = new Logger(SessionTerminationService.name);
  private streamBlockedCallbacks: Array<(event: StreamBlockedEvent) => void> =
    [];
  private sessionsData: PlexSessionsResponse | null = null;

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
    @Inject(forwardRef(() => ConcurrentStreamService))
    private concurrentStreamService: ConcurrentStreamService,
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

    // Store sessions data for concurrent stream checking
    this.sessionsData = sessionsData;

    try {
      const sessions = sessionsData?.MediaContainer?.Metadata || [];

      if (!sessions || sessions.length === 0) {
        return { stoppedSessions, errors };
      }

      // First, handle concurrent stream limits - only terminate youngest sessions
      const concurrentTerminations = await this.handleConcurrentStreamLimits(
        sessions,
        sessionsData,
      );
      stoppedSessions.push(...concurrentTerminations.stoppedSessions);
      errors.push(...concurrentTerminations.errors);

      // Create a set of already terminated session IDs to avoid double-termination
      const terminatedSessionIds = new Set(stoppedSessions);

      // Then check other policies (device approval, IP, time rules)
      for (const session of sessions) {
        try {
          // Skip if already terminated due to concurrent limit
          const sessionId = session.Session?.id;
          if (sessionId && terminatedSessionIds.has(sessionId)) {
            continue;
          }

          const shouldStopResult = await this.shouldStopSession(session, true); // skipConcurrentCheck = true

          if (shouldStopResult.shouldStop) {
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

              this.logger.warn(
                `STREAM BLOCKED! User: ${username}, Device: ${deviceName}, Session: ${sessionId}, Reason: ${reason}, Code: ${stopCode}`,
              );

              this.emitStreamBlockedEvent({
                userId,
                username,
                deviceIdentifier,
                stopCode,
                sessionKey,
                ipAddress: session.Player?.address,
              });

              this.logger.debug(
                `Emitted streamBlocked event for session ${sessionKey}`,
              );
            } else {
              this.logger.warn(
                'Could not find session identifier in session data',
              );
            }
          }
        } catch (error) {
          const sessionKeyForError =
            session.sessionKey || session.Session?.id || 'unknown';
          errors.push(
            `Error processing session ${sessionKeyForError}: ${error.message}`,
          );
          this.logger.error(`Error processing session ${sessionKeyForError}`, error);
        }
      }

      return { stoppedSessions, errors };
    } catch (error) {
      this.logger.error('Error stopping unapproved sessions', error);
      throw error;
    }
  }

  /**
   * Handle concurrent stream limits for all users.
   * Only terminates the youngest (most recently started) sessions when over limit.
   */
  private async handleConcurrentStreamLimits(
    sessions: any[],
    sessionsData: PlexSessionsResponse,
  ): Promise<SessionTerminationResult> {
    const stoppedSessions: string[] = [];
    const errors: string[] = [];

    // Group sessions by user
    const sessionsByUser = new Map<string, any[]>();
    for (const session of sessions) {
      const userId = session.User?.id || session.User?.uuid;
      if (!userId) continue;

      // Skip Plexamp sessions - they don't count
      if (isPlexampSession(session)) continue;

      if (!sessionsByUser.has(userId)) {
        sessionsByUser.set(userId, []);
      }
      sessionsByUser.get(userId)!.push(session);
    }

    // Check each user's concurrent limit
    for (const [userId, userSessions] of sessionsByUser) {
      try {
        // Get the user's effective limit
        const limit = await this.concurrentStreamService.getEffectiveLimit(userId);
        
        // 0 means unlimited
        if (limit === 0) continue;

        // Filter sessions that count toward limit (exclude excluded devices, temp access, etc.)
        const countableSessions = await this.filterCountableSessions(userId, userSessions);
        
        if (countableSessions.length <= limit) continue;

        // Get session start times from history to determine which are newest
        const sessionsWithTimes = await this.getSessionStartTimes(countableSessions);
        
        // Sort by start time descending (newest first)
        sessionsWithTimes.sort((a, b) => b.startTime - a.startTime);

        // Calculate how many to terminate
        const toTerminate = sessionsWithTimes.length - limit;
        
        // Get the termination message
        const message = await this.configService.getSetting('MSG_CONCURRENT_LIMIT');
        const reason = (message as string) || 
          'You have reached your concurrent stream limit. Please stop another stream before starting a new one.';

        // Terminate the newest sessions (they're at the front after sorting)
        for (let i = 0; i < toTerminate; i++) {
          const sessionInfo = sessionsWithTimes[i];
          const session = sessionInfo.session;
          const sessionId = session.Session?.id;

          if (!sessionId) continue;

          try {
            const username = session.User?.title || 'Unknown';
            const deviceName = session.Player?.title || 'Unknown Device';
            const deviceIdentifier = session.Player?.machineIdentifier || 'unknown';
            const sessionKey = session.sessionKey;

            await this.terminateSession(sessionId, reason);
            stoppedSessions.push(sessionId);

            this.logger.warn(
              `STREAM BLOCKED (Concurrent Limit)! User: ${username}, Device: ${deviceName}, ` +
              `Session: ${sessionId}, Streams: ${countableSessions.length}/${limit} (terminating newest)`,
            );

            this.emitStreamBlockedEvent({
              userId,
              username,
              deviceIdentifier,
              stopCode: 'CONCURRENT_LIMIT',
              sessionKey,
              ipAddress: session.Player?.address,
            });
          } catch (error) {
            errors.push(`Error terminating session ${sessionId}: ${error.message}`);
            this.logger.error(`Error terminating session ${sessionId}`, error);
          }
        }
      } catch (error) {
        errors.push(`Error checking concurrent limits for user ${userId}: ${error.message}`);
        this.logger.error(`Error checking concurrent limits for user ${userId}`, error);
      }
    }

    return { stoppedSessions, errors };
  }

  /**
   * Filter sessions to only those that count toward concurrent limit.
   */
  private async filterCountableSessions(userId: string, sessions: any[]): Promise<any[]> {
    const includeTempAccess = await this.configService.getSetting(
      'CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS',
    );

    const countable: any[] = [];

    for (const session of sessions) {
      const deviceIdentifier = session.Player?.machineIdentifier;
      if (!deviceIdentifier) continue;

      // Get device info
      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });

      // Skip devices marked as excluded
      if (device?.excludeFromConcurrentLimit) {
        this.logger.debug(`Device ${deviceIdentifier} excluded from concurrent limit check`);
        continue;
      }

      // Skip temp access devices if configured
      if (!includeTempAccess && device && await this.deviceTrackingService.isTemporaryAccessValid(device)) {
        this.logger.debug(`Device ${deviceIdentifier} with temp access excluded from concurrent limit check`);
        continue;
      }

      countable.push(session);
    }

    return countable;
  }

  /**
   * Get session start times from session history.
   * Uses sessionKey to look up when each session started.
   */
  private async getSessionStartTimes(sessions: any[]): Promise<Array<{ session: any; startTime: number }>> {
    const results: Array<{ session: any; startTime: number }> = [];

    for (const session of sessions) {
      const sessionKey = session.sessionKey;
      
      // Try to find session history entry
      let startTime = Date.now(); // Default to now if not found
      
      if (sessionKey) {
        const history = await this.sessionHistoryRepository.findOne({
          where: { sessionKey },
          order: { startedAt: 'DESC' },
        });
        
        if (history?.startedAt) {
          startTime = history.startedAt.getTime();
        }
      }

      results.push({ session, startTime });
    }

    return results;
  }

  private async shouldStopSession(
    session: any,
    skipConcurrentCheck: boolean = false,
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

      // Plexamp bypass - Plexamp is excluded from all checks including concurrent limits
      if (isPlexampSession(session)) {
        return { shouldStop: false };
      }

      // Skip concurrent stream limit check if handled separately
      // (concurrent limits are now handled in handleConcurrentStreamLimits to terminate only newest sessions)

      // Check temporary access - if bypass policies is enabled, skip all policy checks
      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });

      if (device && (await this.deviceTrackingService.isTemporaryAccessValid(device))) {
        if (device.temporaryAccessBypassPolicies) {
          this.logger.log(
            `Device ${deviceIdentifier} has temporary access with policy bypass enabled - allowing session`,
          );
          return { shouldStop: false };
        }
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
      if (!device || device.status === 'pending') {
        // Check if device has valid temporary access (without bypass)
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
            'Device pending approval. The server owner must approve this device before it can be used.';
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
