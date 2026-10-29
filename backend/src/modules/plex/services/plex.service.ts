import { Injectable, Logger } from '@nestjs/common';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { PlexConfigurationError } from '@/modules/plex/services/plex-configuration-error';
import {
  EnrichedPlexSession,
  EnrichedPlexSessionsResponse,
  PlexSession,
  PlexSessionsResponse,
} from '@/types/plex.types';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { SessionOrchestratorService } from '@/services/session-orchestrator.service';
import { config } from '@/config/app.config';

@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);
  private serverIdentifierCache: string | null = null;
  private serverIdentifierPromise: Promise<string | null> | null = null;

  constructor(
    private readonly plexClient: PlexClient,
    private readonly devicesService: DevicesService,
    private readonly activeSessionService: ActiveSessionService,
    private readonly configService: ConfigService,
    private readonly sessionOrchestratorService: SessionOrchestratorService,
  ) {}

  async getServerIdentifier(): Promise<string | null> {
    if (this.serverIdentifierCache) {
      return this.serverIdentifierCache;
    }

    if (this.serverIdentifierPromise) {
      return this.serverIdentifierPromise;
    }

    this.serverIdentifierPromise = this.plexClient
      .getServerIdentity()
      .then((identifier) => {
        this.serverIdentifierCache = identifier;
        this.serverIdentifierPromise = null;
        return identifier;
      })
      .catch((error) => {
        this.logger.error('Failed to get server identifier:', error);
        this.serverIdentifierPromise = null;
        return null;
      });

    return this.serverIdentifierPromise;
  }

  private logFailure(context: string, error: unknown): void {
    if (error instanceof PlexConfigurationError) {
      this.logger.warn(`${context}: ${error.message}`);
      return;
    }
    this.logger.error(context, error);
  }

  async getActiveSessions(): Promise<PlexSessionsResponse> {
    try {
      const [sessions, serverIdentifier] = await Promise.all([
        this.plexClient.getSessions(),
        this.getServerIdentifier(),
      ]);

      const [enableThumbnails, enableArtwork] = await Promise.all([
        this.configService.getSetting('ENABLE_MEDIA_THUMBNAILS'),
        this.configService.getSetting('ENABLE_MEDIA_ARTWORK'),
      ]);

      if (sessions?.MediaContainer?.Metadata) {
        sessions.MediaContainer.Metadata = await Promise.all(
          sessions.MediaContainer.Metadata.map(async (session) => {
            let sessionCount = 0;

            if (session.Player?.machineIdentifier) {
              try {
                const device = await this.devicesService.findDeviceByIdentifier(
                  session.Player.machineIdentifier,
                );
                sessionCount = device?.sessionCount || 0;
              } catch (error) {
                this.logger.warn(
                  `Failed to get session count for device ${session.Player.machineIdentifier}:`,
                  error,
                );
              }
            }

            return {
              ...this.enrichSessionWithMediaUrls(
                session,
                enableThumbnails,
                enableArtwork,
              ),
              serverMachineIdentifier: serverIdentifier,
              Session: {
                ...session.Session,
                sessionCount,
              },
            };
          }),
        );
      }

      return sessions;
    } catch (error) {
      this.logFailure('Error fetching sessions', error);
      throw error;
    }
  }

  private buildMediaUrl(type: 'thumb' | 'art', mediaPath: string): string {
    if (!mediaPath) return '';

    const pathMatch = mediaPath.match(
      /\/library\/metadata\/(\d+)\/(thumb|art)(?:\/(\d+))?/,
    );

    if (!pathMatch) {
      this.logger.warn(`Invalid media path format: ${mediaPath}`);
      return '';
    }

    const [, ratingKey, , timestamp] = pathMatch;
    let proxyUrl = `${config.api.baseUrl}/plex/media/${type}/${ratingKey}`;

    if (timestamp) {
      proxyUrl += `?t=${timestamp}`;
    }

    return proxyUrl;
  }

  private enrichSessionWithMediaUrls(
    session: PlexSession,
    enableThumbnails: boolean | null,
    enableArtwork: boolean | null,
  ): EnrichedPlexSession {
    return {
      ...session,
      thumbnailUrl:
        enableThumbnails && session.thumb
          ? this.buildMediaUrl('thumb', session.thumb)
          : undefined,
      artUrl:
        enableArtwork && session.art
          ? this.buildMediaUrl('art', session.art)
          : undefined,
    };
  }

  async getPlexWebUrl(): Promise<string> {
    try {
      const customUrl = await this.configService.getSetting('CUSTOM_PLEX_URL');
      if (customUrl && customUrl.trim()) {
        return customUrl.trim();
      }

      const [ip, port, useSSL] = await Promise.all([
        this.configService.getSetting('PLEX_SERVER_IP'),
        this.configService.getSetting('PLEX_SERVER_PORT'),
        this.configService.getSetting('USE_SSL'),
      ]);

      if (!ip || !port) {
        throw new Error('Plex server IP and port not configured');
      }

      const protocol = useSSL ? 'https' : 'http';
      return `${protocol}://${ip}:${port}`;
    } catch (error) {
      this.logger.error('Error getting Plex web URL:', error);
      throw error;
    }
  }

  async updateActiveSessions(): Promise<PlexSessionsResponse> {
    try {
      const sessions = await this.getActiveSessions();
      return await this.sessionOrchestratorService.orchestrateSessionUpdate(
        sessions,
      );
    } catch (error) {
      this.logFailure('Error in updateActiveSessions', error);
      throw error;
    }
  }

  async getActiveSessionsWithMediaUrls(): Promise<EnrichedPlexSessionsResponse> {
    try {
      const sessions =
        await this.activeSessionService.getActiveSessionsFormatted();

      const [enableThumbnails, enableArtwork] = await Promise.all([
        this.configService.getSetting('ENABLE_MEDIA_THUMBNAILS'),
        this.configService.getSetting('ENABLE_MEDIA_ARTWORK'),
      ]);

      if (sessions?.MediaContainer?.Metadata) {
        sessions.MediaContainer.Metadata = sessions.MediaContainer.Metadata.map(
          (session: PlexSession) =>
            this.enrichSessionWithMediaUrls(
              session,
              enableThumbnails,
              enableArtwork,
            ),
        );
      }

      return sessions;
    } catch (error) {
      this.logger.error('Error getting active sessions with media URLs', error);
      throw error;
    }
  }
}
