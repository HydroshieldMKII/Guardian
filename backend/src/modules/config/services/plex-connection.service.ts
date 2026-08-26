import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import {
  PlexErrorCode,
  PlexResponse,
  createPlexError,
  createPlexSuccess,
} from '@/types/plex-errors';

@Injectable()
export class PlexConnectionService {
  private readonly logger = new Logger(PlexConnectionService.name);

  async testConnection(
    ip: string,
    port: string,
    token: string,
    useSSL: boolean,
    ignoreCertErrors: boolean,
  ): Promise<PlexResponse> {
    try {
      if (!ip || !port || !token) {
        return createPlexError(
          PlexErrorCode.NOT_CONFIGURED,
          'Missing required Plex configuration (IP, Port, or Token)',
        );
      }

      const protocol = useSSL ? 'https' : 'http';
      const testUrl = `${protocol}://${ip}:${port}/?X-Plex-Token=${token}`;
      const httpModule = protocol === 'https' ? https : http;

      const urlObj = new URL(testUrl);

      return new Promise<PlexResponse>((resolve) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          timeout: 10000,
          rejectUnauthorized: !ignoreCertErrors,
        };

        const req = httpModule.request(options, (res) => {
          if (res.statusCode === 200) {
            resolve(createPlexSuccess('Successfully connected to Plex server'));
          } else if (res.statusCode === 401) {
            resolve(
              createPlexError(
                PlexErrorCode.AUTH_FAILED,
                'Authentication failed - check your Plex token',
                `HTTP ${res.statusCode}: ${res.statusMessage}`,
              ),
            );
          } else {
            resolve(
              createPlexError(
                PlexErrorCode.SERVER_ERROR,
                `Plex server returned an error: ${res.statusCode} ${res.statusMessage}`,
                `HTTP ${res.statusCode}: ${res.statusMessage}`,
              ),
            );
          }
        });

        req.on('error', (error) => {
          resolve(this.handleConnectionError(error));
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(
            createPlexError(
              PlexErrorCode.CONNECTION_REFUSED,
              'Plex server is unreachable',
              'Check if Plex server is running and accessible',
            ),
          );
        });

        req.setTimeout(10000);
        req.end();
      }).catch((error: unknown) => this.unexpectedError(error));
    } catch (error) {
      return this.unexpectedError(error);
    }
  }

  private unexpectedError(error: unknown): PlexResponse {
    this.logger.error('Error testing Plex connection:', error);
    return createPlexError(
      PlexErrorCode.UNKNOWN_ERROR,
      'Unexpected error testing Plex connection',
      error instanceof Error ? error.message : String(error),
    );
  }

  private handleConnectionError(error: NodeJS.ErrnoException): PlexResponse {
    if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
      return createPlexError(
        PlexErrorCode.CERT_ERROR,
        'SSL certificate error: Hostname/IP does not match certificate',
        'Enable "Ignore SSL certificate errors" or use HTTP instead',
      );
    } else if (error.code?.startsWith('ERR_TLS_')) {
      return createPlexError(
        PlexErrorCode.SSL_ERROR,
        'SSL/TLS connection error',
        'Consider enabling "Ignore SSL certificate errors" or using HTTP',
      );
    } else if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
      return createPlexError(
        PlexErrorCode.CONNECTION_REFUSED,
        'Plex server is unreachable',
        'Check if Plex server is running and accessible',
      );
    } else if (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout')
    ) {
      return createPlexError(
        PlexErrorCode.CONNECTION_TIMEOUT,
        'Connection timeout',
        'Check server address, port and network settings',
      );
    } else {
      return createPlexError(
        PlexErrorCode.NETWORK_ERROR,
        'Network error connecting to Plex server',
        error.message,
      );
    }
  }
}
