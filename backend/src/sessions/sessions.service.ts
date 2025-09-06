import { Injectable, Logger } from '@nestjs/common';
import { PlexClient } from '../plex/plex-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private plexClient: PlexClient) {}

  async terminateSession(
    sessionKey: string,
    reason = 'Session terminated by admin',
  ): Promise<void> {
    try {
      this.logger.log(`Terminating session ${sessionKey}`);
      await this.plexClient.terminateSession(sessionKey, reason);
      this.logger.log(`Successfully terminated session ${sessionKey}`);
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionKey}`, error);
      throw error;
    }
  }
}
