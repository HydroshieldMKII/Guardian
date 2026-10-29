import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { ConfigService } from '@/modules/config/services/config.service';
import { SessionPolicyService } from '@/modules/plex/services/session-policy.service';
import {
  ConcurrentLimitService,
  ExcessStream,
} from '@/modules/plex/services/concurrent-limit.service';
import {
  PlexSession,
  PlexSessionsResponse,
  SessionTerminationResult,
} from '@/types/plex.types';
import { errorMessage } from '@/common/utils/error-types';
import { StopCode } from '@/common/utils/stop-codes';

export interface StreamBlockedEvent {
  userId: string;
  username: string;
  deviceIdentifier: string;
  stopCode?: StopCode | null;
  sessionKey?: string | null;
  ipAddress?: string | null;
}

interface BlockRequest {
  session: PlexSession;
  sessionId: string;
  userId: string;
  reason?: string;
  stopCode?: StopCode;
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

      const { excess, errors: limitErrors } =
        await this.concurrentLimit.findExcessStreams(sessions);
      const overLimit = await this.blockAll(this.toLimitRequests(excess));

      const violations = await this.findPolicyViolations(
        sessions,
        new Set(overLimit.stoppedSessions),
      );
      const policy = await this.blockAll(violations);

      return {
        stoppedSessions: [
          ...overLimit.stoppedSessions,
          ...policy.stoppedSessions,
        ],
        errors: [...limitErrors, ...overLimit.errors, ...policy.errors],
      };
    } catch (error) {
      this.logger.error('Error stopping unapproved sessions', error);
      throw error;
    }
  }

  private toLimitRequests(excess: ExcessStream[]): BlockRequest[] {
    return excess.flatMap(({ session, userId, reason }) => {
      const sessionId = session.Session?.id;
      return sessionId
        ? [{ session, sessionId, userId, reason, stopCode: 'CONCURRENT_LIMIT' }]
        : [];
    });
  }

  private async findPolicyViolations(
    sessions: PlexSession[],
    alreadyStopped: Set<string>,
  ): Promise<BlockRequest[]> {
    const requests: BlockRequest[] = [];

    for (const session of sessions) {
      const sessionId = session.Session?.id;
      if (sessionId && alreadyStopped.has(sessionId)) continue;

      const decision = await this.sessionPolicy.evaluate(session);
      if (!decision.shouldStop) continue;

      if (!sessionId) {
        this.logger.warn('Could not find session identifier in session data');
        continue;
      }

      requests.push({
        session,
        sessionId,
        userId: session.User?.id || 'unknown',
        reason: decision.reason,
        stopCode: decision.stopCode,
      });
    }

    return requests;
  }

  private async blockAll(
    requests: BlockRequest[],
  ): Promise<SessionTerminationResult> {
    const stoppedSessions: string[] = [];
    const errors: string[] = [];

    for (const request of requests) {
      try {
        await this.block(request);
        stoppedSessions.push(request.sessionId);
      } catch (error) {
        errors.push(
          `Error terminating session ${request.sessionId}: ${errorMessage(error)}`,
        );
        this.logger.error(
          `Error terminating session ${request.sessionId}`,
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
