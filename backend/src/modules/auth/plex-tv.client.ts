import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

export const PLEX_PRODUCT = 'Guardian';
const PLEX_VERSION = '1.0.0';
const PLEX_REQUEST_TIMEOUT_MS = 10000;

interface PlexHttpResponse {
  statusCode: number;
  body: string;
}

interface PlexRequest {
  method: 'GET' | 'POST';
  path: string;
  clientId: string;
  authToken?: string;
  body?: string;
}

export interface PlexAuthPin {
  id: number;
  code: string;
  clientIdentifier: string;
  expiresAt: Date;
}

export interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  email: string;
  thumb: string;
  authToken: string;
}

@Injectable()
export class PlexTvClient {
  private readonly logger = new Logger(PlexTvClient.name);

  async createPin(clientId: string): Promise<PlexAuthPin> {
    const { statusCode, body } = await this.request({
      method: 'POST',
      path: '/api/v2/pins',
      clientId,
      body: new URLSearchParams({
        strong: 'true',
        'X-Plex-Product': PLEX_PRODUCT,
        'X-Plex-Client-Identifier': clientId,
        'X-Plex-Version': PLEX_VERSION,
        'X-Plex-Platform': 'Web',
        'X-Plex-Device': 'Browser',
      }).toString(),
    });

    if (statusCode !== 201 && statusCode !== 200) {
      this.logger.error(`Plex API error: ${statusCode} - ${body}`);
      throw new Error('Failed to create Plex PIN');
    }

    return this.parse(
      body,
      'Failed to parse Plex PIN response:',
      'Failed to parse Plex response',
      (response: { id: number; code: string; expiresAt: string }) => ({
        id: response.id,
        code: response.code,
        clientIdentifier: clientId,
        expiresAt: new Date(response.expiresAt),
      }),
    );
  }

  async getPinAuthToken(
    pinId: number,
    clientId: string,
  ): Promise<string | null> {
    let response: PlexHttpResponse;
    try {
      response = await this.request({
        method: 'GET',
        path: `/api/v2/pins/${pinId}`,
        clientId,
      });
    } catch (error) {
      this.logger.error('Plex PIN check request error:', error);
      return null;
    }

    if (response.statusCode !== 200) {
      this.logger.error(`Plex PIN check error: ${response.statusCode}`);
      return null;
    }

    try {
      return (
        (JSON.parse(response.body) as { authToken?: string }).authToken ?? null
      );
    } catch (error) {
      this.logger.error('Failed to parse Plex PIN check response:', error);
      return null;
    }
  }

  async getUser(authToken: string, clientId: string): Promise<PlexUser> {
    const { statusCode, body } = await this.request({
      method: 'GET',
      path: '/api/v2/user',
      clientId,
      authToken,
    });

    if (statusCode !== 200) {
      this.logger.error(`Plex user info error: ${statusCode}`);
      throw new Error('Failed to get Plex user info');
    }

    return this.parse(
      body,
      'Failed to parse Plex user info:',
      'Failed to parse Plex user info',
      (response: Omit<PlexUser, 'authToken'>) => ({
        id: response.id,
        uuid: response.uuid,
        username: response.username,
        email: response.email,
        thumb: response.thumb,
        authToken,
      }),
    );
  }

  private parse<TRaw, TResult>(
    body: string,
    logMessage: string,
    errorMessage: string,
    map: (raw: TRaw) => TResult,
  ): TResult {
    try {
      return map(JSON.parse(body) as TRaw);
    } catch (error) {
      this.logger.error(logMessage, error);
      throw new Error(errorMessage);
    }
  }

  private request(options: PlexRequest): Promise<PlexHttpResponse> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string | number> = {
        Accept: 'application/json',
        'X-Plex-Client-Identifier': options.clientId,
      };

      if (options.authToken) {
        headers['X-Plex-Token'] = options.authToken;
      }

      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(options.body);
      }

      const req = https.request(
        {
          hostname: 'plex.tv',
          port: 443,
          path: options.path,
          method: options.method,
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () =>
            resolve({ statusCode: res.statusCode ?? 0, body: data }),
          );
        },
      );

      req.on('error', (error) => {
        this.logger.error('Plex request error:', error);
        reject(new Error('Failed to connect to Plex'));
      });

      req.setTimeout(PLEX_REQUEST_TIMEOUT_MS, () => {
        req.destroy();
        reject(new Error('Plex request timeout'));
      });

      if (options.body !== undefined) {
        req.write(options.body);
      }

      req.end();
    });
  }
}
