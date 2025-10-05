import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { ConfigService } from '../../config/services/config.service';
import { 
  PlexErrorCode, 
  PlexResponse, 
  createPlexError, 
  createPlexSuccess 
} from '../../../types/plex-errors';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionHistory } from '../../../entities/session-history.entity';

import { UserDevice } from '../../../entities/user-device.entity';

@Injectable()
export class PlexClient {
  private readonly logger = new Logger(PlexClient.name);

  constructor(
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
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
      ip: ip as string,
      port: port as string,
      token: token as string,
      useSSL: useSSL as boolean,
      ignoreCertErrors: ignoreCertErrors as boolean,
    };
  }

  private async validateConfiguration() {
    const { ip, port, token } = await this.getConfig();

    if (!ip || !port || !token) {
      throw new Error(
        'Missing required Plex configuration. Please configure PLEX_SERVER_IP, PLEX_SERVER_PORT, and PLEX_TOKEN in settings.',
      );
    }
  }

  async request(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    await this.validateConfiguration();
    const { ip, port, token, useSSL, ignoreCertErrors } =
      await this.getConfig();
    const baseUrl = `${useSSL ? 'https' : 'http'}://${ip}:${port}`;

    return new Promise((resolve, reject) => {
      const cleanEndpoint = endpoint.startsWith('/')
        ? endpoint.slice(1)
        : endpoint;
      const hasQuery = cleanEndpoint.includes('?');
      const tokenParam = `X-Plex-Token=${encodeURIComponent(token)}`;
      const fullEndpoint = hasQuery
        ? `${cleanEndpoint}&${tokenParam}`
        : `${cleanEndpoint}?${tokenParam}`;

      const fullUrl = `${baseUrl}/${fullEndpoint}`;
      const urlObj = new URL(fullUrl);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': 'Guardian',
          ...options.headers,
        },
        rejectUnauthorized: !ignoreCertErrors,
      };

      // this.logger.debug(`Making request to: ${fullUrl}`);

      const httpModule = useSSL ? https : http;

      const req = httpModule.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData = data ? JSON.parse(data) : {};
              resolve({
                ok: true,
                status: res.statusCode,
                json: () => jsonData,
                text: () => data,
              });
            } catch (parseError) {
              resolve({
                ok: true,
                status: res.statusCode,
                json: () => ({}),
                text: () => data,
              });
            }
          } else {
            const error = new Error(
              `HTTP ${res.statusCode}: ${res.statusMessage} - ${data}`,
            );
            this.logger.error(`Request failed for ${fullUrl}:`, error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error(`Request failed for ${fullUrl}:`, error);
        reject(error);
      });

      // Set timeout
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async getSessions(): Promise<any> {
    const response = await this.request('status/sessions');
    return response.json();
  }

  private async externalRequest(
    url: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': 'Guardian',
          ...options.headers,
        },
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData = data ? JSON.parse(data) : {};
              resolve({
                ok: true,
                status: res.statusCode,
                json: () => jsonData,
                text: () => data,
              });
            } catch (parseError) {
              resolve({
                ok: true,
                status: res.statusCode,
                json: () => ({}),
                text: () => data,
              });
            }
          } else {
            const error = new Error(
              `HTTP ${res.statusCode}: ${res.statusMessage} - ${data}`,
            );
            this.logger.error(`External request failed for ${url}:`, error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error(`External request failed for ${url}:`, error);
        reject(error);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('External request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async getPlexUsers(): Promise<any> {
    try {
      const { token } = await this.getConfig();

      if (!token) {
        throw new Error('Plex token is required to fetch users');
      }

      const url = `https://plex.tv/api/users?X-Plex-Token=${encodeURIComponent(token)}`;

      this.logger.debug('Fetching Plex users from Plex.tv API');
      
      const response = await this.externalRequest(url);


      const responseText = response.text();
      this.logger.debug('Successfully fetched Plex users');
      return responseText;
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
      reason: reason,
    });

    await this.request(`status/sessions/terminate?${params.toString()}`, {
      method: 'GET',
    });

    // Get device by identifier
    const device = await this.userDeviceRepository.findOne({
      where: { deviceIdentifier },
    });

    // Mark all active sessions for this device as ended + terminated
    setTimeout(async () => {
      await this.sessionHistoryRepository
      .createQueryBuilder()
      .update(SessionHistory)
      .set({ endedAt: () => 'CURRENT_TIMESTAMP', terminated: true })
      .where('user_device_id = :deviceId AND endedAt IS NULL', { deviceId: device?.id })
      .execute();
    }, 10000); // Delay to allow Plex server to process termination

    this.logger.log(`Terminated session ${deviceIdentifier}`);
  }

  async testConnection(): Promise<PlexResponse> {
    try {
      await this.validateConfiguration();
      const response = await this.request('/');
      
      if (response.ok) {
        return createPlexSuccess('Connection successful');
      } else {
        return createPlexError(
          PlexErrorCode.SERVER_ERROR,
          `Plex server returned error: ${response.status}`,
          `HTTP ${response.status}`
        );
      }
    } catch (error) {
      this.logger.error('Connection test failed:', error);

      // Handle specific SSL/TLS errors
      if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        return createPlexError(
          PlexErrorCode.CERT_ERROR,
          'SSL certificate error: Hostname/IP does not match certificate',
          'Enable "Ignore SSL certificate errors" or use HTTP instead'
        );
      }

      if (error.code && error.code.startsWith('ERR_TLS_')) {
        return createPlexError(
          PlexErrorCode.SSL_ERROR,
          'SSL/TLS connection error',
          'Consider enabling "Ignore SSL certificate errors" or using HTTP'
        );
      }

      // Handle connection refused/unreachable - normalize EHOSTUNREACH to same as ECONNREFUSED
      if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
        return createPlexError(
          PlexErrorCode.CONNECTION_REFUSED,
          'Plex server is unreachable',
          'Check if Plex server is running and accessible'
        );
      }

      // Handle timeout errors - normalize all timeout types
      if (
        error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' ||
        error.message.includes('timeout') ||
        error.message === 'Request timeout'
      ) {
        return createPlexError(
          PlexErrorCode.CONNECTION_TIMEOUT,
          'Connection timeout',
          'Check server address, port and network settings'
        );
      }

      // Handle authentication errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return createPlexError(
          PlexErrorCode.AUTH_FAILED,
          'Authentication failed',
          'Check your Plex token'
        );
      }

      return createPlexError(
        PlexErrorCode.NETWORK_ERROR,
        'Connection failed',
        error.message
      );
    }
  }
}
