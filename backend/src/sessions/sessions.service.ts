import { Injectable, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly proxyPort = process.env.PLEXGUARD_PROXY_PORT || '8080';

  /**
   * Terminate a specific session via proxy
   */
  async terminateSession(
    sessionKey: string,
    reason = 'Session terminated by admin',
  ): Promise<void> {
    try {
      const proxyUrl = `http://localhost:${this.proxyPort}/status/sessions/terminate`;

      this.logger.log(`Terminating session ${sessionKey} via proxy`);

      const response = await fetch(proxyUrl, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Plex-Client-Identifier': 'plex-guard',
        },
        body: `sessionId=${encodeURIComponent(sessionKey)}&reason=${encodeURIComponent(reason)}`,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        );
      }

      this.logger.log(`Successfully terminated session ${sessionKey}`);
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionKey}`, error);
      throw error;
    }
  }

  /**
   * Terminate all unapproved sessions
   */
  async terminateUnapprovedSessions(): Promise<{
    message: string;
    terminated: number;
  }> {
    this.logger.warn('Manual termination of unapproved sessions requested');
    return {
      message:
        'Unapproved sessions are automatically terminated by the monitoring service',
      terminated: 0,
    };
  }
}
