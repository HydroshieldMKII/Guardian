import { Controller, Get } from '@nestjs/common';
import { ActiveSessionService } from './services/active-session.service';
import { PlexSessionsResponse } from '../../types/plex.types';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly activeSessionService: ActiveSessionService) {}

  @Get('active')
  async getActiveSessions(): Promise<PlexSessionsResponse> {
    return this.activeSessionService.getActiveSessionsFormatted();
  }
}
