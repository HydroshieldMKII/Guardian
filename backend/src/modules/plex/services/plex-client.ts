import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { ConfigService } from '../../config/services/config.service';

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
      ip: ip as string,
      port: port as string,
      token: token as string,
      useSSL: useSSL === 'true' || useSSL === true,
      ignoreCertErrors:
        ignoreCertErrors === 'true' || ignoreCertErrors === true,
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

  async terminateSession(
    sessionKey: string,
    reason: string = 'Session terminated',
  ): Promise<void> {
    const params = new URLSearchParams({
      sessionId: sessionKey,
      reason: reason,
    });

    await this.request(`status/sessions/terminate?${params.toString()}`, {
      method: 'GET',
    });

    this.logger.log(`Successfully terminated session ${sessionKey}`);
  }

  async testConnection(): Promise<{
    ok: boolean;
    status: number;
    message?: string;
  }> {
    try {
      await this.validateConfiguration();
      const response = await this.request('/');
      return {
        ok: response.ok,
        status: response.status,
        message: response.ok ? 'Connection successful' : 'Connection failed',
      };
    } catch (error) {
      this.logger.error('Connection test failed:', error);

      // Handle specific SSL/TLS errors
      if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        return {
          ok: false,
          status: 0,
          message:
            'SSL certificate error: Hostname/IP does not match certificate. Enable "Ignore SSL certificate errors" or use HTTP instead.',
        };
      }

      if (error.code && error.code.startsWith('ERR_TLS_')) {
        return {
          ok: false,
          status: 0,
          message: `SSL/TLS error: ${error.message}. Consider enabling "Ignore SSL certificate errors" or using HTTP.`,
        };
      }

      // Handle connection refused, timeout, etc.
      if (error.code === 'ECONNREFUSED') {
        return {
          ok: false,
          status: 0,
          message:
            'Connection refused. Check if Plex server is running and accessible.',
        };
      }

      if (error.code === 'ECONNRESET' || error.message.includes('timeout')) {
        return {
          ok: false,
          status: 0,
          message:
            'Connection timeout. Check server address, port and SSL settings.',
        };
      }

      return {
        ok: false,
        status: 0,
        message: `Connection failed: ${error.message}`,
      };
    }
  }
}
