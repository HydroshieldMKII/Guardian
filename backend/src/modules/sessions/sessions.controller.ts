import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { SessionHistoryService } from '@/modules/sessions/services/session-history.service';
import { PlexSessionsResponse } from '@/types/plex.types';
import { SessionHistory } from '@/entities/session-history.entity';
import {
  parseHistoryLimit,
  parseHistoryOffset,
} from '@/modules/sessions/dto/session-history-query';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';

@Controller('sessions')
@AdminOnly()
export class SessionsController {
  constructor(
    private readonly activeSessionService: ActiveSessionService,
    private readonly sessionHistoryService: SessionHistoryService,
  ) {}

  @Get('active')
  async getActiveSessions(): Promise<PlexSessionsResponse> {
    return this.activeSessionService.getActiveSessionsFormatted();
  }

  @Get('history/:userId')
  async getUserSessionHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('includeActive') includeActive?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('terminatedOnly') terminatedOnly?: string,
    @Query('app') app?: string,
  ): Promise<SessionHistory[]> {
    return this.sessionHistoryService.getUserSessionHistory(userId, {
      limit: parseHistoryLimit(limit),
      offset: parseHistoryOffset(offset),
      includeActive: includeActive === 'true',
      search,
      terminatedOnly: terminatedOnly === 'true',
      app: app === 'plex' || app === 'plexamp' ? app : undefined,
    });
  }

  @Delete('history/:sessionId')
  async deleteSessionHistory(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ): Promise<{ success: boolean }> {
    if (sessionId < 1) {
      throw new BadRequestException('sessionId must be a positive integer');
    }
    await this.sessionHistoryService.deleteSessionHistory(sessionId);
    return { success: true };
  }
}
