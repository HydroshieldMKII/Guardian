import { Controller, Get, Param, Query, Delete } from '@nestjs/common';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { PlexSessionsResponse } from '@/types/plex.types';
import { SessionHistory } from '@/entities/session-history.entity';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';

@Controller('sessions')
@AdminOnly()
export class SessionsController {
  constructor(private readonly activeSessionService: ActiveSessionService) {}

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
  ): Promise<SessionHistory[]> {
    return this.activeSessionService.getUserSessionHistory(userId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      includeActive: includeActive === 'true',
      search,
      terminatedOnly: terminatedOnly === 'true',
    });
  }

  @Delete('history/:sessionId')
  async deleteSessionHistory(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    const sessionIdNum = parseInt(sessionId, 10);
    await this.activeSessionService.deleteSessionHistory(sessionIdNum);
    return { success: true };
  }
}
