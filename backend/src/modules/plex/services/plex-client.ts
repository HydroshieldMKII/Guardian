import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { ConfigService } from '@/modules/config/services/config.service';
import { PlexResponse, createPlexSuccess } from '@/types/plex-errors';
import { PlexSessionsResponse } from '@/types/plex.types';
import {
  PLEX_CLIENT_IDENTIFIER,
  PlexHttpError,
  PlexHttpResponse,
  describeFailedReply,
  dispatchPlexRequest,
  isSuccessStatus,
  toPlexHttpResponse,
  withPlexToken,
} from '@/modules/plex/services/plex-http';
import { PlexConfigurationError } from '@/modules/plex/services/plex-configuration-error';
import { MESSAGE_MAX_LENGTH } from '@/modules/config/services/setting-format-rules';
import { plexConnectionFailure } from '@/modules/plex/services/plex-connection-failure';

const REQUEST_TIMEOUT_MS = 15000;
const MEDIA_TIMEOUT_MS = 10000;
const TRANSIENT_NETWORK_CODES = new Set([
  'EHOSTUNREACH',
  'ECONNREFUSED',
  'ETIMEDOUT',
]);

interface PlexRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class PlexClient {
  private readonly logger = new Logger(PlexClient.name);

  constructor(
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
  ) {}

  private async getConfig() {
    const [ip, port, token, useSSL, ignoreCertErrors] = await Promise.all([
      this.configService.getSetting('PLEX_SERVER_IP'),
      this.configService.getSetting('PLEX_SERVER_PORT'),
      this.configService.getSetting('PLEX_TOKEN'),
      this.configService.getSetting('USE_SSL'),
      this.configService.getSetting('IGNORE_CERT_ERRORS'),
    ]);

    return {
      ip: ip ?? '',
      port: port ?? '',
      token: token ?? '',
      useSSL: useSSL ?? false,
      ignoreCertErrors: ignoreCertErrors ?? false,
    };
  }

  private buildUrl(
    scheme: string,
    config: { ip: string; port: string },
    pathWithToken: string,
  ): URL {
    try {
      return new URL(
        `${scheme}://${config.ip}:${config.port}/${pathWithToken}`,
      );
    } catch {
      throw new PlexConfigurationError(
        'Invalid Plex server address or port. Check the Plex server IP and port in settings.',
      );
    }
  }

  private async serverTarget(endpoint: string) {
    const config = await this.getConfig();
    if (!config.ip || !config.port || !config.token) {
      throw new PlexConfigurationError(
        'Missing required Plex configuration. Please configure PLEX_SERVER_IP, PLEX_SERVER_PORT, and PLEX_TOKEN in settings.',
      );
    }

    const scheme = config.useSSL ? 'https' : 'http';
    const url = this.buildUrl(
      scheme,
      config,
      withPlexToken(endpoint, config.token),
    );

    return {
      config,
      url,
      send: config.useSSL ? https.request : http.request,
      options: {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        rejectUnauthorized: !config.ignoreCertErrors,
      },
    };
  }

  private describe(url: URL): string {
    return `${url.origin}${url.pathname}`;
  }

  async request(
    endpoint: string,
    options: PlexRequestOptions = {},
  ): Promise<PlexHttpResponse> {
    const target = await this.serverTarget(endpoint);

    try {
      const reply = await dispatchPlexRequest({
        send: target.send,
        options: {
          ...target.options,
          method: options.method || 'GET',
          headers: {
            Accept: 'application/json',
            'X-Plex-Client-Identifier': PLEX_CLIENT_IDENTIFIER,
            ...options.headers,
          },
        },
        body: options.body,
        timeoutMs: REQUEST_TIMEOUT_MS,
        timeoutMessage: 'Request timeout',
      });

      if (!isSuccessStatus(reply.statusCode)) {
        const error = new Error(describeFailedReply(reply));
        this.logger.error(
          `Request failed for ${this.describe(target.url)}:`,
          error,
        );
        throw error;
      }

      return toPlexHttpResponse(reply);
    } catch (caught) {
      const error = caught as NodeJS.ErrnoException;
      if (error.code && TRANSIENT_NETWORK_CODES.has(error.code)) {
        this.logger.warn(
          `Plex server unreachable (${error.code}): ${target.config.ip}:${target.config.port}`,
        );
      } else if (error.code) {
        this.logger.error(
          `Request failed for ${this.describe(target.url)}:`,
          error,
        );
      }
      throw error;
    }
  }

  async requestMedia(endpoint: string): Promise<Buffer | null> {
    const target = await this.serverTarget(endpoint);

    try {
      const reply = await dispatchPlexRequest({
        send: target.send,
        options: {
          ...target.options,
          method: 'GET',
          headers: { 'X-Plex-Client-Identifier': PLEX_CLIENT_IDENTIFIER },
        },
        timeoutMs: MEDIA_TIMEOUT_MS,
        timeoutMessage: `Timeout requesting media ${endpoint}`,
      });

      if (reply.statusCode !== 200) {
        this.logger.warn(
          `Media request failed with status ${reply.statusCode} for ${endpoint}`,
        );
        return null;
      }

      return reply.body;
    } catch (error) {
      this.logger.error(`Error requesting media ${endpoint}:`, error);
      return null;
    }
  }

  async getServerIdentity(): Promise<string | null> {
    try {
      const response = await this.request('/');
      const data = response.json() as {
        MediaContainer?: { machineIdentifier?: string };
      };
      return data?.MediaContainer?.machineIdentifier || null;
    } catch (error) {
      this.logger.error('Error getting server identity:', error);
      return null;
    }
  }

  async getSessions(): Promise<PlexSessionsResponse> {
    const response = await this.request('status/sessions');
    return response.json() as PlexSessionsResponse;
  }

  async getPlexUsers(): Promise<string> {
    const { token } = await this.getConfig();
    if (!token) {
      throw new Error('Plex token is required to fetch users');
    }

    this.logger.debug('Fetching Plex users from Plex.tv API');

    try {
      const reply = await dispatchPlexRequest({
        send: https.request,
        options: {
          hostname: 'plex.tv',
          port: 443,
          path: `/api/users?X-Plex-Token=${encodeURIComponent(token)}`,
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Plex-Client-Identifier': PLEX_CLIENT_IDENTIFIER,
          },
        },
        timeoutMs: REQUEST_TIMEOUT_MS,
        timeoutMessage: 'External request timeout',
      });

      if (!isSuccessStatus(reply.statusCode)) {
        throw new PlexHttpError(describeFailedReply(reply), reply.statusCode);
      }

      this.logger.debug('Successfully fetched Plex users');
      return reply.body.toString();
    } catch (error) {
      this.logger.error('Error in getPlexUsers:', error);
      throw error;
    }
  }

  async terminateSession(
    deviceIdentifier: string,
    reason: string = 'Session terminated',
  ): Promise<void> {
    if (!deviceIdentifier) {
      this.logger.warn('No device identifier provided for termination');
      return;
    }

    const params = new URLSearchParams({
      sessionId: deviceIdentifier,
      reason: reason.slice(0, MESSAGE_MAX_LENGTH),
    });

    const url = `status/sessions/terminate?${params.toString()}`;
    this.logger.debug(`Terminate URL: ${url}`);

    await this.request(url, {
      method: 'GET',
    });

    this.logger.log(
      `Terminate session requested to Plex for ${deviceIdentifier} with reason: ${reason}`,
    );
  }

  async testConnection(): Promise<PlexResponse> {
    try {
      await this.request('/');
      return createPlexSuccess('Connection successful');
    } catch (caught) {
      const error = caught as NodeJS.ErrnoException;
      this.logger.error('Connection test failed:', error);
      return plexConnectionFailure(error);
    }
  }
}
