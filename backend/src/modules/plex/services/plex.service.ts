import { Injectable, Logger } from '@nestjs/common';
import { PlexClient } from './plex-client';
import { SessionTerminationService } from './session-termination.service';
import { PlexSessionsResponse } from '../../../types/plex.types';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import { ActiveSessionService } from '../../sessions/services/active-session.service';

@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);

  constructor(
    private readonly plexClient: PlexClient,
    private readonly sessionTerminationService: SessionTerminationService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly activeSessionService: ActiveSessionService,
  ) {}

  async getActiveSessions(): Promise<PlexSessionsResponse> {
    try {
      const sessions = await this.plexClient.getSessions();
      
      // Add media URLs to session data
      if (sessions?.MediaContainer?.Metadata) {
        sessions.MediaContainer.Metadata = sessions.MediaContainer.Metadata.map(session => ({
          ...session,
          thumbnailUrl: session.thumb ? this.buildMediaUrl('thumb', session.thumb) : undefined,
          artUrl: session.art ? this.buildMediaUrl('art', session.art) : undefined,
        }));
      }
      
      return sessions;
    } catch (error: any) {
      this.logger.error('Error fetching sessions', error);
      throw error;
    }
  }

  private buildMediaUrl(type: 'thumb' | 'art', mediaPath: string): string {
    if (!mediaPath) return '';
    
    // Parse the media path to extract ratingKey and timestamp
    const pathMatch = mediaPath.match(/\/library\/metadata\/(\d+)\/(thumb|art)(?:\/(\d+))?/);
    
    if (!pathMatch) {
      this.logger.warn(`Invalid media path format: ${mediaPath}`);
      return '';
    }

    const [, ratingKey, , timestamp] = pathMatch;
    
    // Build the proxy Nextjs URL that points to our media controller
    let proxyUrl = `/api/pg/plex/media/${type}/${ratingKey}`;
    
    if (timestamp) {
      proxyUrl += `?t=${timestamp}`;
    }
    
    return proxyUrl;
  }

  async updateActiveSessions(): Promise<PlexSessionsResponse> {
    try {
      const sessions = await this.getActiveSessions();
      
      // this.logger.debug(JSON.stringify(sessions));

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

      // Stop unapproved sessions
      try {
        await this.sessionTerminationService.stopUnapprovedSessions(sessions);
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
