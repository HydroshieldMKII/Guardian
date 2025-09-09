import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/services/config.service';
import * as http from 'http';
import * as https from 'https';

@Injectable()
export class DynamicPlexClient {
  private readonly logger = new Logger(DynamicPlexClient.name);

  constructor(private readonly configService: ConfigService) {}

  private async getConnectionSettings() {
    const [ip, port, token, useSSL, ignoreCertErrors] = await Promise.all([
      this.configService.getSetting('PLEX_SERVER_IP'),
      this.configService.getSetting('PLEX_SERVER_PORT'),
      this.configService.getSetting('PLEX_TOKEN'),
      this.configService.getSetting('USE_SSL'),
      this.configService.getSetting('IGNORE_CERT_ERRORS'),
    ]);

    if (!ip || !port || !token) {
      throw new Error(
        'Missing required Plex configuration: PLEX_SERVER_IP, PLEX_SERVER_PORT, PLEX_TOKEN',
      );
    }

    const protocol = useSSL ? 'https' : 'http';
    return {
      ip,
      port,
      token,
      useSSL,
      ignoreCertErrors,
      baseUrl: `${protocol}://${ip}:${port}`,
    };
  }

  async request(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    const settings = await this.getConnectionSettings();
    
    return new Promise((resolve, reject) => {
      const cleanEndpoint = endpoint.startsWith('/')
        ? endpoint.slice(1)
        : endpoint;
      const hasQuery = cleanEndpoint.includes('?');
      const tokenParam = `X-Plex-Token=${encodeURIComponent(settings.token)}`;
      const fullEndpoint = hasQuery
        ? `${cleanEndpoint}&${tokenParam}`
        : `${cleanEndpoint}?${tokenParam}`;

      const fullUrl = `${settings.baseUrl}/${fullEndpoint}`;
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
        rejectUnauthorized: !settings.ignoreCertErrors,
      };

      const httpModule = settings.useSSL ? https : http;

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
    reason?: string,
  ): Promise<void> {
    const stopMessage = await this.configService.getSetting('PLEXGUARD_STOPMSG');
    const finalReason = reason || stopMessage || 'Session terminated';
    
    const params = new URLSearchParams({
      sessionId: sessionKey,
      reason: finalReason,
    });

    await this.request(`status/sessions/terminate?${params.toString()}`, {
      method: 'GET',
    });

    this.logger.log(`Successfully terminated session ${sessionKey}`);
  }

  async testConnection(): Promise<{ ok: boolean; status: number }> {
    try {
      const response = await this.request('/');
      return { ok: response.ok, status: response.status };
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return { ok: false, status: 0 };
    }
  }
}
