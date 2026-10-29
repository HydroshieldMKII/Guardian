import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PLEX_PRODUCT,
  PlexAuthPin,
  PlexTvClient,
  PlexUser,
} from '@/modules/auth/plex-tv.client';

const PLEX_AUTH_URL = 'https://app.plex.tv/auth';
const PLEX_CLIENT_IDENTIFIER = 'Guardian-Plex-Manager';
const PIN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const PIN_MAX_AGE_MS = 10 * 60 * 1000;

@Injectable()
export class PlexOAuthService {
  private readonly logger = new Logger(PlexOAuthService.name);
  private pendingPins = new Map<
    string,
    { pin: PlexAuthPin; createdAt: number }
  >();

  constructor(private readonly plexTv: PlexTvClient) {
    setInterval(() => this.cleanupExpiredPins(), PIN_CLEANUP_INTERVAL_MS);
  }

  generateClientId(): string {
    return `${PLEX_CLIENT_IDENTIFIER}-${crypto.randomBytes(8).toString('hex')}`;
  }

  async createPlexPin(
    clientId: string,
  ): Promise<{ pin: PlexAuthPin; authUrl: string }> {
    const pin = await this.plexTv.createPin(clientId);
    this.pendingPins.set(clientId, { pin, createdAt: Date.now() });

    const authUrl = `${PLEX_AUTH_URL}#?clientID=${encodeURIComponent(clientId)}&code=${encodeURIComponent(pin.code)}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PLEX_PRODUCT)}`;

    return { pin, authUrl };
  }

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

    const authToken = await this.plexTv.getPinAuthToken(pin.id, clientId);
    if (!authToken) {
      return null;
    }

    try {
      const user = await this.plexTv.getUser(authToken, clientId);
      this.pendingPins.delete(clientId);
      return user;
    } catch (error) {
      this.logger.error('Failed to get Plex user info:', error);
      throw error;
    }
  }

  cancelPlexPin(clientId: string): void {
    this.pendingPins.delete(clientId);
  }

  async getPlexUserFromToken(authToken: string): Promise<PlexUser> {
    return this.plexTv.getUser(authToken, this.generateClientId());
  }

  private cleanupExpiredPins(): void {
    const now = Date.now();
    for (const [clientId, data] of this.pendingPins.entries()) {
      if (
        now - data.createdAt > PIN_MAX_AGE_MS ||
        new Date() > data.pin.expiresAt
      ) {
        this.pendingPins.delete(clientId);
      }
    }
  }
}
