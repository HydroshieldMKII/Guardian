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

}
