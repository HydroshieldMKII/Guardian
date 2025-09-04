import { Controller, Get, Post, Param } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PlexService } from '../plex/plex.service';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly plexService: PlexService,
  ) {}

  @Get('active')
  async getActiveSessions() {
    return this.plexService.getActiveSessionsFromDatabase();
  }

  @Post('terminate/:sessionKey')
  async terminateSession(@Param('sessionKey') sessionKey: string) {
    return this.sessionsService.terminateSession(sessionKey);
  }

  @Post('terminate-unapproved')
  async terminateUnapprovedSessions() {
    return this.sessionsService.terminateUnapprovedSessions();
  }
}
