import { Injectable, Logger } from '@nestjs/common';
import { PlexClient } from './plex-client';
import { SessionTerminationService } from './session-termination.service';
import { PlexSessionsResponse } from '../../../types/plex.types';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import { ActiveSessionService } from '../../sessions/services/active-session.service';
import { ConfigService } from '../../config/services/config.service';
import { config } from '../../../config/app.config';

@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);
  private serverIdentifierCache: string | null = null;
  private serverIdentifierPromise: Promise<string | null> | null = null;

  constructor(
    private readonly plexClient: PlexClient,
    private readonly sessionTerminationService: SessionTerminationService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly activeSessionService: ActiveSessionService,
    private readonly configService: ConfigService,
  ) {}

  private async getServerIdentifier(): Promise<string | null> {
    // Return cached value if available
    if (this.serverIdentifierCache) {
      return this.serverIdentifierCache;
    }

    // If there's already a request in progress, wait for it
    if (this.serverIdentifierPromise) {
      return this.serverIdentifierPromise;
    }

    // Create new request and cache the promise
    this.serverIdentifierPromise = this.plexClient.getServerIdentity()
      .then(identifier => {
        this.serverIdentifierCache = identifier;
        this.serverIdentifierPromise = null; // Clear the promise once resolved
        return identifier;
      })
      .catch(error => {
        this.logger.error('Failed to get server identifier:', error);
        this.serverIdentifierPromise = null; // Clear the promise on error
        return null;
      });

    return this.serverIdentifierPromise;
  }

  async getActiveSessions(): Promise<PlexSessionsResponse> {
    try {
      const [sessions, serverIdentifier] = await Promise.all([
        this.plexClient.getSessions(),
        this.getServerIdentifier()
      ]);
      
      // Check if media thumbnails and artwork are enabled
      const [enableThumbnails, enableArtwork] = await Promise.all([
        this.configService.getSetting('ENABLE_MEDIA_THUMBNAILS'),
        this.configService.getSetting('ENABLE_MEDIA_ARTWORK'),
      ]);
      
      // Add media URLs, server identifier, and device session count to session data
      if (sessions?.MediaContainer?.Metadata) {
        sessions.MediaContainer.Metadata = await Promise.all(
          sessions.MediaContainer.Metadata.map(async session => {
            let sessionCount = 0;
            
            // Get device session count if available
            if (session.Player?.machineIdentifier) {
              try {
                const device = await this.deviceTrackingService.findDeviceByIdentifier(session.Player.machineIdentifier);
                sessionCount = device?.sessionCount || 0;
              } catch (error) {
                this.logger.warn(`Failed to get session count for device ${session.Player.machineIdentifier}:`, error);
              }
            }

            return {
              ...session,
              serverMachineIdentifier: serverIdentifier,
              thumbnailUrl: (enableThumbnails && session.thumb) ? this.buildMediaUrl('thumb', session.thumb) : undefined,
              artUrl: (enableArtwork && session.art) ? this.buildMediaUrl('art', session.art) : undefined,
              Session: {
                ...session.Session,
                sessionCount,
              },
            };
          })
        );
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
    
    // Build the proxy URL that points to our media controller
    let proxyUrl = `${config.api.baseUrl}/plex/media/${type}/${ratingKey}`;
    
    if (timestamp) {
      proxyUrl += `?t=${timestamp}`;
    }
    
    return proxyUrl;
  }

  async getPlexWebUrl(): Promise<string> {
    try {
      // Check for custom URL first
      const customUrl = await this.configService.getSetting('CUSTOM_PLEX_URL');
      if (customUrl && customUrl.trim()) {
        return customUrl.trim();
      }

      // Build URL from server configuration
      const [ip, port, useSSL] = await Promise.all([
        this.configService.getSetting('PLEX_SERVER_IP'),
        this.configService.getSetting('PLEX_SERVER_PORT'),
        this.configService.getSetting('USE_SSL')
      ]);

      if (!ip || !port) {
        throw new Error('Plex server IP and port not configured');
      }

      const protocol = (useSSL === 'true' || useSSL === true) ? 'https' : 'http';
      return `${protocol}://${ip}:${port}`;
      
    } catch (error) {
      this.logger.error('Error getting Plex web URL:', error);
      throw error;
    }
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
