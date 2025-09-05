import { Injectable, Logger } from '@nestjs/common';
import { DeviceTrackingService } from '../services/device-tracking.service';
import { StopSessionService } from './stop-session';
import { ActiveSessionService } from '../services/active-session.service';
import { PlexSessionsResponse, PlexSession } from '../types/plex.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);
  private readonly proxyPort = '8080';

  constructor(
    private deviceTrackingService: DeviceTrackingService,
    private stopSessionService: StopSessionService,
    private activeSessionService: ActiveSessionService,
  ) {}

  async getActiveSessionsCount(): Promise<number> {
    try {
      return await this.activeSessionService.getActiveSessionsCount();
    } catch (error: any) {
      this.logger.error('Error getting active sessions count', error);
      return 0;
    }
  }

  async getActiveSessionsFromDatabase(): Promise<PlexSessionsResponse> {
    try {
      const sessions = await this.activeSessionService.getActiveSessions();

      const transformedSessions: PlexSession[] = sessions.map((session) => ({
        sessionKey: session.sessionKey,
        User: {
          id: session.userId,
          title: session.username,
        },
        Player: {
          machineIdentifier: session.deviceIdentifier,
          platform: session.devicePlatform,
          product: session.deviceProduct,
          title: session.deviceTitle,
          device: session.deviceName,
          address: session.deviceAddress,
          state: session.playerState as 'playing' | 'paused' | 'buffering',
        },
        Media:
          session.videoResolution || session.bitrate || session.container
            ? [
                {
                  videoResolution: session.videoResolution,
                  bitrate: session.bitrate,
                  container: session.container,
                  videoCodec: session.videoCodec,
                  audioCodec: session.audioCodec,
                },
              ]
            : [],
        Session: {
          id: session.sessionKey,
          bandwidth: session.bandwidth,
          location: session.sessionLocation as 'lan' | 'wan',
        },
        title: session.contentTitle,
        grandparentTitle: session.grandparentTitle,
        parentTitle: session.parentTitle,
        year: session.year,
        duration: session.duration,
        viewOffset: session.viewOffset,
        type: session.contentType,
        thumb: session.thumb,
        art: session.art,
      }));

      return {
        MediaContainer: {
          size: transformedSessions.length,
          Metadata: transformedSessions,
        },
      };
    } catch (error: any) {
      this.logger.error('Error getting active sessions from database', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<PlexSessionsResponse> {
    const proxyUrl = `http://localhost:${this.proxyPort}/status/sessions`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': 'plex-guard',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        );
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error('Error fetching sessions', error);
      throw error;
    }
  }

  async updateActiveSessions(): Promise<PlexSessionsResponse> {
    try {
      const sessions = await this.getActiveSessions();

      // Update active sessions in database
      try {
        await this.activeSessionService.updateActiveSessions(sessions);
      } catch (sessionUpdateError) {
        this.logger.error(
          'Failed to update active sessions in database',
          sessionUpdateError,
        );
      }

      // Track devices from the sessions data
      try {
        await this.deviceTrackingService.processSessionsForDeviceTracking(
          sessions,
        );
      } catch (trackingError) {
        this.logger.error(
          'Failed to track devices from sessions',
          trackingError,
        );
      }

      try {
        await this.stopSessionService.stopUnapprovedSessions(sessions);
      } catch (stopError) {
        this.logger.error('Failed to stop unapproved sessions', stopError);
      }

      return sessions;
    } catch (error: any) {
      this.logger.error('Error in updateActiveSessions', error);
      throw error;
    }
  }
}
