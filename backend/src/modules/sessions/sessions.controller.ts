import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActiveSessionService } from './services/active-session.service';
import { PlexSessionsResponse } from '../../types/plex.types';
import { SessionHistory } from '../../entities/session-history.entity';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly activeSessionService: ActiveSessionService) {}

  @Get('active')
  async getActiveSessions(): Promise<PlexSessionsResponse> {
    return this.activeSessionService.getActiveSessionsFormatted();
  }

  @Get('history/:userId')
  async getUserSessionHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string
  ): Promise<SessionHistory[]> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.activeSessionService.getUserSessionHistory(userId, limitNum);
  }
}
