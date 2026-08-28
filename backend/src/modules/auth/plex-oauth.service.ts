import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as https from 'https';
import { AdminUser } from '@/entities/admin-user.entity';
import { UserPreference } from '@/entities/user-preference.entity';

// Plex OAuth configuration
const PLEX_AUTH_URL = 'https://app.plex.tv/auth';
const PLEX_CLIENT_IDENTIFIER = 'Guardian-Plex-Manager';
const PLEX_PRODUCT = 'Guardian';
const PLEX_VERSION = '1.0.0';
const PLEX_REQUEST_TIMEOUT_MS = 10000;

interface PlexHttpResponse {
  statusCode: number;
  body: string;
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
export class PlexOAuthService {
  private readonly logger = new Logger(PlexOAuthService.name);
  // Store pending OAuth pins (in production, consider Redis)
  private pendingPins = new Map<
    string,
    { pin: PlexAuthPin; createdAt: number }
  >();

  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
  ) {
    // Cleanup expired pins every 5 minutes
    setInterval(() => this.cleanupExpiredPins(), 5 * 60 * 1000);
  }

  /**
   * Generate a unique client identifier for tracking OAuth sessions
   */
  generateClientId(): string {
    return `${PLEX_CLIENT_IDENTIFIER}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Create a Plex OAuth PIN for authentication
   */
  async createPlexPin(
    clientId: string,
  ): Promise<{ pin: PlexAuthPin; authUrl: string }> {
    const postData = new URLSearchParams({
      strong: 'true',
      'X-Plex-Product': PLEX_PRODUCT,
      'X-Plex-Client-Identifier': clientId,
      'X-Plex-Version': PLEX_VERSION,
      'X-Plex-Platform': 'Web',
      'X-Plex-Device': 'Browser',
    }).toString();

    const { statusCode, body } = await this.plexRequest({
      method: 'POST',
      path: '/api/v2/pins',
      clientId,
      body: postData,
    });

    if (statusCode !== 201 && statusCode !== 200) {
      this.logger.error(`Plex API error: ${statusCode} - ${body}`);
      throw new Error('Failed to create Plex PIN');
    }

    const pin = this.parsePlexResponse(
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

    this.pendingPins.set(clientId, { pin, createdAt: Date.now() });

    const authUrl = `${PLEX_AUTH_URL}#?clientID=${encodeURIComponent(clientId)}&code=${encodeURIComponent(pin.code)}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PLEX_PRODUCT)}`;

    return { pin, authUrl };
  }

  /**
   * Check if a Plex PIN has been authenticated and retrieve user info
   */
  async checkPlexPin(clientId: string): Promise<PlexUser | null> {
    const pending = this.pendingPins.get(clientId);
    if (!pending) {
      throw new BadRequestException('No pending authentication found');
    }

    const { pin } = pending;

    if (new Date() > pin.expiresAt) {
      this.pendingPins.delete(clientId);
      throw new BadRequestException('Authentication PIN has expired');
    }

    let response: PlexHttpResponse;
    try {
      response = await this.plexRequest({
        method: 'GET',
        path: `/api/v2/pins/${pin.id}`,
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

    let authToken: string | undefined;
    try {
      authToken = (JSON.parse(response.body) as { authToken?: string })
        .authToken;
    } catch (error) {
      this.logger.error('Failed to parse Plex PIN check response:', error);
      return null;
    }

    if (!authToken) {
      return null;
    }

    try {
      const user = await this.getPlexUserInfo(authToken, clientId);
      this.pendingPins.delete(clientId);
      return user;
    } catch (error) {
      this.logger.error('Failed to get Plex user info:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Drop a pending PIN when the user abandons the Plex window
   */
  cancelPlexPin(clientId: string): void {
    this.pendingPins.delete(clientId);
  }

  /**
   * Get Plex user information using their auth token
   * Public method for direct auth token usage (e.g., from frontend after OAuth)
   */
  async getPlexUserFromToken(authToken: string): Promise<PlexUser> {
    const clientId = this.generateClientId();
    return this.getPlexUserInfo(authToken, clientId);
  }

  /**
   * Get Plex user information using their auth token
   */
  private async getPlexUserInfo(
    authToken: string,
    clientId: string,
  ): Promise<PlexUser> {
    const { statusCode, body } = await this.plexRequest({
      method: 'GET',
      path: '/api/v2/user',
      clientId,
      authToken,
    });

    if (statusCode !== 200) {
      this.logger.error(`Plex user info error: ${statusCode}`);
      throw new Error('Failed to get Plex user info');
    }

    return this.parsePlexResponse(
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

  private parsePlexResponse<TRaw, TResult>(
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

  private plexRequest(options: {
    method: 'GET' | 'POST';
    path: string;
    clientId: string;
    authToken?: string;
    body?: string;
  }): Promise<PlexHttpResponse> {
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

  /**
   * Check if a Plex user is on the server (has access)
   */
  async isPlexUserOnServer(
    plexUserId: string,
    _serverToken: string,
  ): Promise<boolean> {
    // The UserPreference entity stores Plex user IDs synced from the server
    const userPreference = await this.userPreferenceRepository.findOne({
      where: { userId: plexUserId },
    });

    return userPreference !== null;
  }

  /**
   * Get user preference by Plex user ID
   */
  async getUserPreferenceByPlexId(
    plexUserId: string,
  ): Promise<UserPreference | null> {
    return this.userPreferenceRepository.findOne({
      where: { userId: plexUserId },
    });
  }

  /**
   * Check if any admin has linked their Plex account
   */
  async getAdminWithPlexLinked(): Promise<AdminUser | null> {
    return this.adminUserRepository
      .createQueryBuilder('admin')
      .where('admin.plexUserId IS NOT NULL')
      .getOne();
  }

  /**
   * Link a Plex account to an admin user
   */
  async linkPlexAccountToAdmin(
    adminId: string,
    plexUser: PlexUser,
  ): Promise<AdminUser> {
    // Check if this Plex account is already linked to another admin
    const existingLink = await this.adminUserRepository.findOne({
      where: { plexUserId: String(plexUser.id) },
    });

    if (existingLink && existingLink.id !== adminId) {
      throw new BadRequestException(
        'This Plex account is already linked to another admin',
      );
    }

    // Update admin with Plex info
    await this.adminUserRepository.update(adminId, {
      plexUserId: String(plexUser.id),
      plexUsername: plexUser.username,
      plexEmail: plexUser.email,
      plexThumb: plexUser.thumb,
    });

    return this.adminUserRepository.findOneOrFail({ where: { id: adminId } });
  }

  /**
   * Unlink Plex account from admin
   */
  async unlinkPlexAccountFromAdmin(adminId: string): Promise<AdminUser> {
    this.logger.log(`Unlinking Plex account from admin ${adminId}`);

    // First verify the admin exists and has Plex linked
    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    // Clear the Plex fields using raw SQL update to properly set NULL
    await this.adminUserRepository
      .createQueryBuilder()
      .update(AdminUser)
      .set({
        plexUserId: null,
        plexUsername: null,
        plexEmail: null,
        plexThumb: null,
      })
      .where('id = :id', { id: adminId })
      .execute();

    // Fetch fresh from DB to confirm
    const freshAdmin = await this.adminUserRepository.findOneOrFail({
      where: { id: adminId },
    });

    return freshAdmin;
  }

  /**
   * Check if any admin has Plex OAuth enabled (has linked account)
   */
  async hasPlexOAuthEnabled(): Promise<boolean> {
    return (await this.getAdminWithPlexLinked()) !== null;
  }

  /**
   * Clean up expired pending pins
   */
  private cleanupExpiredPins(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [clientId, data] of this.pendingPins.entries()) {
      if (now - data.createdAt > maxAge || new Date() > data.pin.expiresAt) {
        this.pendingPins.delete(clientId);
      }
    }
  }
}
