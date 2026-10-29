import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Not, Or, Repository } from 'typeorm';
import { SessionHistory } from '@/entities/session-history.entity';

export type SessionHistoryApp = 'plex' | 'plexamp';

const PLEXAMP = ILike('%plexamp%');
const NOT_PLEXAMP = Or(IsNull(), Not(PLEXAMP));

const SESSION_APP_FILTERS: Record<
  SessionHistoryApp,
  FindOptionsWhere<SessionHistory> | FindOptionsWhere<SessionHistory>[]
> = {
  plexamp: [
    { product: PLEXAMP },
    { userDevice: { deviceProduct: PLEXAMP } },
    { userDevice: { deviceName: PLEXAMP } },
  ],
  plex: {
    product: NOT_PLEXAMP,
    userDevice: { deviceProduct: NOT_PLEXAMP, deviceName: NOT_PLEXAMP },
  },
};

export interface SessionHistoryQuery {
  limit?: number;
  offset?: number;
  includeActive?: boolean;
  search?: string;
  terminatedOnly?: boolean;
  app?: SessionHistoryApp;
}

@Injectable()
export class SessionHistoryService {
  private readonly logger = new Logger(SessionHistoryService.name);

  constructor(
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
  ) {}

  async getUserSessionHistory(
    userId: string,
    query: SessionHistoryQuery = {},
  ): Promise<SessionHistory[]> {
    const {
      limit = 50,
      offset = 0,
      includeActive = false,
      search,
      terminatedOnly = false,
      app,
    } = query;

    try {
      const queryBuilder = this.sessionHistoryRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.userDevice', 'device')
        .where({ userId })
        .orderBy('session.startedAt', 'DESC')
        .skip(offset)
        .take(limit);

      if (!includeActive) {
        queryBuilder.andWhere({ endedAt: Not(IsNull()) });
      }

      if (terminatedOnly) {
        queryBuilder.andWhere({ terminated: true });
      }

      if (app) {
        queryBuilder.andWhere(SESSION_APP_FILTERS[app]);
      }

      const term = search?.trim();
      if (term) {
        const matches = ILike(`%${term}%`);
        queryBuilder.andWhere([
          { contentTitle: matches },
          { grandparentTitle: matches },
          { parentTitle: matches },
          { deviceAddress: matches },
          { userDevice: { deviceName: matches } },
          { userDevice: { deviceProduct: matches } },
        ]);
      }

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error(
        `Failed to get session history for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteSessionHistory(sessionId: number): Promise<void> {
    try {
      const result = await this.sessionHistoryRepository.delete(sessionId);

      if (result.affected === 0) {
        throw new Error(`Session history with ID ${sessionId} not found`);
      }

      this.logger.log(`Deleted session history with ID: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete session history ${sessionId}:`,
        error,
      );
      throw error;
    }
  }
}
