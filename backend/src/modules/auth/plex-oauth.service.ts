import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as https from 'https';
import { AdminUser } from '../../entities/admin-user.entity';
import { UserPreference } from '../../entities/user-preference.entity';

// Plex OAuth configuration
const PLEX_OAUTH_URL = 'https://plex.tv/api/v2';
const PLEX_AUTH_URL = 'https://app.plex.tv/auth';
const PLEX_CLIENT_IDENTIFIER = 'Guardian-Plex-Manager';
const PLEX_PRODUCT = 'Guardian';
const PLEX_VERSION = '1.0.0';

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
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        strong: 'true',
        'X-Plex-Product': PLEX_PRODUCT,
        'X-Plex-Client-Identifier': clientId,
        'X-Plex-Version': PLEX_VERSION,
        'X-Plex-Platform': 'Web',
        'X-Plex-Device': 'Browser',
      }).toString();

      const options = {
        hostname: 'plex.tv',
        port: 443,
        path: '/api/v2/pins',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode !== 201 && res.statusCode !== 200) {
              this.logger.error(`Plex API error: ${res.statusCode} - ${data}`);
              return reject(new Error('Failed to create Plex PIN'));
            }

            const response = JSON.parse(data);
            const pin: PlexAuthPin = {
              id: response.id,
              code: response.code,
              clientIdentifier: clientId,
              expiresAt: new Date(response.expiresAt),
            };

            // Store the pending pin
            this.pendingPins.set(clientId, {
              pin,
              createdAt: Date.now(),
            });

            // Generate the auth URL
            const authUrl = `${PLEX_AUTH_URL}#?clientID=${encodeURIComponent(clientId)}&code=${encodeURIComponent(pin.code)}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PLEX_PRODUCT)}`;

            resolve({ pin, authUrl });
          } catch (error) {
            this.logger.error('Failed to parse Plex PIN response:', error);
            reject(new Error('Failed to parse Plex response'));
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error('Plex PIN request error:', error);
        reject(new Error('Failed to connect to Plex'));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Plex request timeout'));
      });

      req.write(postData);
      req.end();
    });
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

    // Check if PIN has expired
    if (new Date() > pin.expiresAt) {
      this.pendingPins.delete(clientId);
      throw new BadRequestException('Authentication PIN has expired');
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'plex.tv',
        port: 443,
        path: `/api/v2/pins/${pin.id}`,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': clientId,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              this.logger.error(`Plex PIN check error: ${res.statusCode}`);
              return resolve(null);
            }

            const response = JSON.parse(data);

            // If authToken is null, user hasn't authenticated yet
            if (!response.authToken) {
              return resolve(null);
            }

            // User authenticated! Get their info
            this.getPlexUserInfo(response.authToken, clientId)
              .then((user) => {
                // Clean up the pending pin
                this.pendingPins.delete(clientId);
                resolve(user);
              })
              .catch((error) => {
                this.logger.error('Failed to get Plex user info:', error);
                reject(error);
              });
          } catch (error) {
            this.logger.error('Failed to parse Plex PIN check response:', error);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error('Plex PIN check request error:', error);
        resolve(null);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
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
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'plex.tv',
        port: 443,
        path: '/api/v2/user',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Plex-Token': authToken,
          'X-Plex-Client-Identifier': clientId,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              this.logger.error(`Plex user info error: ${res.statusCode}`);
              return reject(new Error('Failed to get Plex user info'));
            }

            const response = JSON.parse(data);
            const user: PlexUser = {
              id: response.id,
              uuid: response.uuid,
              username: response.username,
              email: response.email,
              thumb: response.thumb,
              authToken: authToken,
            };

            resolve(user);
          } catch (error) {
            this.logger.error('Failed to parse Plex user info:', error);
            reject(new Error('Failed to parse Plex user info'));
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error('Plex user info request error:', error);
        reject(new Error('Failed to connect to Plex'));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Plex request timeout'));
      });

      req.end();
    });
  }

  /**
   * Check if a Plex user is on the server (has access)
   */
  async isPlexUserOnServer(
    plexUserId: string,
    serverToken: string,
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
   * Check if a Plex account is linked to an admin
   */
  async isPlexAccountLinkedToAdmin(plexUserId: string): Promise<AdminUser | null> {
    return this.adminUserRepository.findOne({
      where: { plexUserId: plexUserId },
    });
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

    this.logger.log(
      `Admin before unlink - plexUserId: ${admin.plexUserId}, plexUsername: ${admin.plexUsername}`,
    );

    // Clear the Plex fields using raw SQL update to properly set NULL
    await this.adminUserRepository
      .createQueryBuilder()
      .update(AdminUser)
      .set({
        plexUserId: null as any,
        plexUsername: null as any,
        plexEmail: null as any,
        plexThumb: null as any,
      })
      .where('id = :id', { id: adminId })
      .execute();

    // Fetch fresh from DB to confirm
    const freshAdmin = await this.adminUserRepository.findOneOrFail({
      where: { id: adminId },
    });

    this.logger.log(
      `Admin after unlink - plexUserId: ${freshAdmin.plexUserId}, plexUsername: ${freshAdmin.plexUsername}`,
    );

    return freshAdmin;
  }

  /**
   * Check if any admin has Plex OAuth enabled (has linked account)
   */
  async hasPlexOAuthEnabled(): Promise<boolean> {
    const adminWithPlex = await this.adminUserRepository
      .createQueryBuilder('admin')
      .where('admin.plexUserId IS NOT NULL')
      .getOne();

    return adminWithPlex !== null;
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
