import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '../.env') });

@Injectable()
export class PlexClient {
  private readonly logger = new Logger(PlexClient.name);
  private readonly ip = process.env.PLEX_SERVER_IP;
  private readonly port = process.env.PLEX_SERVER_PORT;
  private readonly token = process.env.PLEX_TOKEN;
  private readonly useSSL = process.env.USE_SSL === 'true';
  private readonly ignoreCertErrors = process.env.IGNORE_CERT_ERRORS === 'true';
  private readonly baseUrl: string;

  constructor() {
    if (!this.ip || !this.port || !this.token) {
      throw new Error(
        'Missing required environment variables: PLEX_SERVER_IP, PLEX_SERVER_PORT, PLEX_TOKEN',
      );
    }

    this.baseUrl = `http://${this.ip}:${this.port}`;
  }

  async request(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const cleanEndpoint = endpoint.startsWith('/')
        ? endpoint.slice(1)
        : endpoint;
      const hasQuery = cleanEndpoint.includes('?');
      const tokenParam = `X-Plex-Token=${encodeURIComponent(this.token!)}`;
      const fullEndpoint = hasQuery
        ? `${cleanEndpoint}&${tokenParam}`
        : `${cleanEndpoint}?${tokenParam}`;

      const fullUrl = `${this.baseUrl}/${fullEndpoint}`;
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
        rejectUnauthorized: !this.ignoreCertErrors,
      };

      // this.logger.debug(`Making request to: ${fullUrl}`);

      const httpModule = this.useSSL ? https : http;

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
