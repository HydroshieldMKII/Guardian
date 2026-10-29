import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionHistory } from '@/entities/session-history.entity';
import { ConcurrentStreamService } from '@/modules/users/services/concurrent-stream.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { PlexSession, isPlexampSession } from '@/types/plex.types';
import { errorMessage } from '@/common/utils/error-types';
import { DEFAULT_BLOCK_MESSAGES } from '@/common/utils/block-messages';

export interface ExcessStream {
  userId: string;
  session: PlexSession;
  reason: string;
}

export interface ExcessStreamScan {
  excess: ExcessStream[];
  errors: string[];
}

@Injectable()
export class ConcurrentLimitService {
  private readonly logger = new Logger(ConcurrentLimitService.name);

  constructor(
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @Inject(forwardRef(() => ConcurrentStreamService))
    private concurrentStreamService: ConcurrentStreamService,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
  ) {}

  async findExcessStreams(sessions: PlexSession[]): Promise<ExcessStreamScan> {
    const excess: ExcessStream[] = [];
    const errors: string[] = [];

    for (const [userId, userSessions] of this.groupByUser(sessions)) {
      try {
        excess.push(...(await this.findExcessForUser(userId, userSessions)));
      } catch (error) {
        errors.push(
          `Error checking concurrent limits for user ${userId}: ${errorMessage(error)}`,
        );
        this.logger.error(
          `Error checking concurrent limits for user ${userId}`,
          error,
        );
      }
    }

    return { excess, errors };
  }

  private groupByUser(sessions: PlexSession[]): Map<string, PlexSession[]> {
    const sessionsByUser = new Map<string, PlexSession[]>();
    for (const session of sessions) {
      const userId = session.User?.id || session.User?.uuid;
      if (!userId || isPlexampSession(session)) continue;

      const userSessions = sessionsByUser.get(userId) ?? [];
      userSessions.push(session);
      sessionsByUser.set(userId, userSessions);
    }
    return sessionsByUser;
  }

  private async findExcessForUser(
    userId: string,
    userSessions: PlexSession[],
  ): Promise<ExcessStream[]> {
    const limit = await this.concurrentStreamService.getEffectiveLimit(userId);
    if (limit === 0) return [];

    const countableSessions =
      await this.concurrentStreamService.filterCountableSessions(
        userId,
        userSessions,
      );
    if (countableSessions.length <= limit) return [];

    const newestFirst = await this.sortNewestFirst(countableSessions);
    const reason =
      (await this.configService.getSetting('MSG_CONCURRENT_LIMIT')) ||
      DEFAULT_BLOCK_MESSAGES.concurrentLimit;

    this.logger.warn(
      `User ${userId} has ${countableSessions.length}/${limit} streams, terminating the newest`,
    );

    return newestFirst
      .slice(0, countableSessions.length - limit)
      .map((session) => ({ userId, session, reason }));
  }

  private async sortNewestFirst(
    sessions: PlexSession[],
  ): Promise<PlexSession[]> {
    const withTimes: Array<{ session: PlexSession; startTime: number }> = [];
    for (const session of sessions) {
      withTimes.push({ session, startTime: await this.startTimeOf(session) });
    }
    return withTimes
      .sort((a, b) => b.startTime - a.startTime)
      .map(({ session }) => session);
  }

  private async startTimeOf(session: PlexSession): Promise<number> {
    if (!session.sessionKey) {
      return Date.now();
    }
    const history = await this.sessionHistoryRepository.findOne({
      where: { sessionKey: session.sessionKey },
      order: { startedAt: 'DESC' },
    });
    return history?.startedAt?.getTime() ?? Date.now();
  }
}
