import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { ConfigService } from '@/modules/config/services/config.service';
import { SessionPolicyService } from '@/modules/plex/services/session-policy.service';
import { ConcurrentLimitService } from '@/modules/plex/services/concurrent-limit.service';
import {
  PlexSession,
  PlexSessionsResponse,
  SessionTerminationResult,
} from '@/types/plex.types';
import { errorMessage } from '@/common/utils/error-types';

export interface StreamBlockedEvent {
  userId: string;
  username: string;
  deviceIdentifier: string;
  stopCode?: string | null;
  sessionKey?: string | null;
  ipAddress?: string | null;
}

interface BlockRequest {
  session: PlexSession;
  sessionId: string;
  userId: string;
  reason?: string;
  stopCode?: string;
}

@Injectable()
export class SessionTerminationService {
  private readonly logger = new Logger(SessionTerminationService.name);
  private streamBlockedCallbacks: Array<(event: StreamBlockedEvent) => void> =
    [];

  constructor(
    private plexClient: PlexClient,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    private sessionPolicy: SessionPolicyService,
    private concurrentLimit: ConcurrentLimitService,
  ) {}

  onStreamBlocked(callback: (event: StreamBlockedEvent) => void): void {
    this.streamBlockedCallbacks.push(callback);
  }

  private emitStreamBlockedEvent(event: StreamBlockedEvent): void {
    for (const callback of this.streamBlockedCallbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in stream blocked callback', error);
      }
    }
  }

  async stopUnapprovedSessions(
    sessionsData: PlexSessionsResponse,
  ): Promise<SessionTerminationResult> {
    try {
      const sessions = sessionsData?.MediaContainer?.Metadata || [];
      if (sessions.length === 0) {
        return { stoppedSessions: [], errors: [] };
      }

      const overLimit = await this.stopExcessStreams(sessions);
      const policy = await this.stopPolicyViolations(
        sessions,
        new Set(overLimit.stoppedSessions),
      );

      return {
        stoppedSessions: [
          ...overLimit.stoppedSessions,
          ...policy.stoppedSessions,
        ],
        errors: [...overLimit.errors, ...policy.errors],
      };
    } catch (error) {
      this.logger.error('Error stopping unapproved sessions', error);
      throw error;
    }
  }

  private async stopExcessStreams(
    sessions: PlexSession[],
  ): Promise<SessionTerminationResult> {
    const { excess, errors } =
      await this.concurrentLimit.findExcessStreams(sessions);
    const stoppedSessions: string[] = [];

    for (const { session, userId, reason } of excess) {
      const sessionId = session.Session?.id;
      if (!sessionId) continue;

      try {
        await this.block({
          session,
          sessionId,
          userId,
          reason,
          stopCode: 'CONCURRENT_LIMIT',
        });
        stoppedSessions.push(sessionId);
      } catch (error) {
        errors.push(
          `Error terminating session ${sessionId}: ${errorMessage(error)}`,
        );
        this.logger.error(`Error terminating session ${sessionId}`, error);
      }
    }

    return { stoppedSessions, errors };
  }

  private async stopPolicyViolations(
    sessions: PlexSession[],
    alreadyStopped: Set<string>,
  ): Promise<SessionTerminationResult> {
    const stoppedSessions: string[] = [];
    const errors: string[] = [];

    for (const session of sessions) {
      const sessionId = session.Session?.id;
      if (sessionId && alreadyStopped.has(sessionId)) continue;

      try {
        const decision = await this.sessionPolicy.evaluate(session);
        if (!decision.shouldStop) continue;

        if (!sessionId) {
          this.logger.warn('Could not find session identifier in session data');
          continue;
        }

        await this.block({
          session,
          sessionId,
          userId: session.User?.id || 'unknown',
          reason: decision.reason,
          stopCode: decision.stopCode,
        });
        stoppedSessions.push(sessionId);
      } catch (error) {
        const sessionKeyForError = session.sessionKey || sessionId || 'unknown';
        errors.push(
          `Error processing session ${sessionKeyForError}: ${errorMessage(error)}`,
        );
        this.logger.error(
          `Error processing session ${sessionKeyForError}`,
          error,
        );
      }
    }

    return { stoppedSessions, errors };
  }

  private async block({
    session,
    sessionId,
    userId,
    reason,
    stopCode,
  }: BlockRequest): Promise<void> {
    const username = session.User?.title || 'Unknown';
    const deviceName = session.Player?.title || 'Unknown Device';

    await this.terminateSession(sessionId, reason);

    this.logger.warn(
      `STREAM BLOCKED! User: ${username}, Device: ${deviceName}, Session: ${sessionId}, Reason: ${reason}, Code: ${stopCode}`,
    );

    this.emitStreamBlockedEvent({
      userId,
      username,
      deviceIdentifier: session.Player?.machineIdentifier || 'unknown',
      stopCode,
      sessionKey: session.sessionKey,
      ipAddress: session.Player?.address,
    });
  }

  async terminateSession(sessionKey: string, reason?: string): Promise<void> {
    try {
      const message =
        reason ||
        (await this.configService.getSetting('MSG_DEVICE_PENDING')) ||
        'This device must be approved by the server owner. Please contact the server administrator for more information.';

      this.logger.log(
        `Terminating session ${sessionKey} with reason: ${message}`,
      );

      await this.plexClient.terminateSession(sessionKey, message);
      this.logger.log(`Successfully terminated session ${sessionKey}`);
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionKey}`, error);
      throw error;
    }
  }
}
