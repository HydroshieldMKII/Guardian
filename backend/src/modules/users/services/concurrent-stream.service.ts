import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { ConfigService } from '../../config/services/config.service';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import {
  PlexSessionsResponse,
  PlexSession,
  isPlexampSession,
} from '../../../types/plex.types';

export interface ConcurrentStreamResult {
  allowed: boolean;
  reason?: string;
  stopCode?: string;
  currentStreams: number;
  limit: number;
}

/**
 * Concurrent Stream Service
 *
 * Validates concurrent stream limits per user.
 * Supports global limits, per-user overrides, and device exclusions.
 */
@Injectable()
export class ConcurrentStreamService {
  private readonly logger = new Logger(ConcurrentStreamService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    @Inject(forwardRef(() => DeviceTrackingService))
    private deviceTrackingService: DeviceTrackingService,
  ) {}

  /**
   * Get the effective concurrent stream limit for a user.
   * Returns 0 if unlimited.
   */
  async getEffectiveLimit(userId: string): Promise<number> {
    // Check user-specific override first
    const userPreference = await this.userPreferenceRepository.findOne({
      where: { userId },
    });

    if (
      userPreference?.concurrentStreamLimit !== null &&
      userPreference?.concurrentStreamLimit !== undefined
    ) {
      return userPreference.concurrentStreamLimit;
    }

    // Fall back to global setting
    const globalLimit = await this.configService.getSetting(
      'CONCURRENT_STREAM_LIMIT',
    );
    return typeof globalLimit === 'number' ? globalLimit : 0;
  }

  /**
   * Count current active streams for a user from session data.
   * Excludes Plexamp sessions, devices marked as excluded from concurrent limit,
   * and optionally excludes devices with temporary access.
   */
  async countActiveStreams(
    userId: string,
    sessionsData: PlexSessionsResponse,
  ): Promise<number> {
    const sessions = sessionsData?.MediaContainer?.Metadata || [];

    // Get settings for temp access inclusion
    const includeTempAccess = await this.configService.getSetting(
      'CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS',
    );

    // Get all devices for this user to check exclusion flags
    const userDevices = await this.userDeviceRepository.find({
      where: { userId },
    });

    const deviceExclusionMap = new Map<string, boolean>();
    const deviceTempAccessMap = new Map<string, boolean>();

    for (const device of userDevices) {
      deviceExclusionMap.set(
        device.deviceIdentifier,
        device.excludeFromConcurrentLimit,
      );

      // Check if device has valid temporary access
      const hasValidTempAccess =
        await this.deviceTrackingService.isTemporaryAccessValid(device);
      deviceTempAccessMap.set(device.deviceIdentifier, hasValidTempAccess);
    }

    let count = 0;
    for (const session of sessions) {
      const sessionUserId = String(
        session.User?.id || session.User?.uuid || '',
      );
      const deviceIdentifier = session.Player?.machineIdentifier;

      // Ensure string comparison for user IDs (Plex can return numbers or strings)
      if (sessionUserId !== String(userId)) continue;
      if (!deviceIdentifier) continue;

      // Skip Plexamp sessions - they don't count toward concurrent limit
      if (isPlexampSession(session)) {
        this.logger.debug(
          `Plexamp session excluded from concurrent stream count`,
        );
        continue;
      }

      // Skip devices marked as excluded from concurrent limit
      if (deviceExclusionMap.get(deviceIdentifier)) {
        this.logger.debug(
          `Device ${deviceIdentifier} excluded from concurrent stream count`,
        );
        continue;
      }

      // Skip temp access devices if configured to exclude them
      if (!includeTempAccess && deviceTempAccessMap.get(deviceIdentifier)) {
        this.logger.debug(
          `Device ${deviceIdentifier} with temp access excluded from concurrent stream count`,
        );
        continue;
      }

      count++;
    }

    return count;
  }

  /**
   * Validate if a new session from a device would exceed the concurrent stream limit.
   * Returns whether the session is allowed and details about the limit.
   * @param playerProduct - Optional player product name (e.g., 'Plexamp') to check for exclusions
   */
  async validateConcurrentLimit(
    userId: string,
    deviceIdentifier: string,
    sessionsData: PlexSessionsResponse,
    playerProduct?: string,
  ): Promise<ConcurrentStreamResult> {
    // Plexamp is always excluded from concurrent limit checks
    if (isPlexampSession(playerProduct)) {
      this.logger.debug('Plexamp device excluded from concurrent limit check');
      return {
        allowed: true,
        currentStreams: 0,
        limit: 0,
      };
    }

    const limit = await this.getEffectiveLimit(userId);

    // 0 means unlimited
    if (limit === 0) {
      return {
        allowed: true,
        currentStreams: 0,
        limit: 0,
      };
    }

    // Check if this specific device is excluded
    const device = await this.userDeviceRepository.findOne({
      where: { userId, deviceIdentifier },
    });

    if (device?.excludeFromConcurrentLimit) {
      this.logger.debug(
        `Device ${deviceIdentifier} is excluded from concurrent limit check`,
      );
      return {
        allowed: true,
        currentStreams: 0,
        limit,
      };
    }

    // Check temp access exclusion
    const includeTempAccess = await this.configService.getSetting(
      'CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS',
    );

    if (
      !includeTempAccess &&
      device &&
      (await this.deviceTrackingService.isTemporaryAccessValid(device))
    ) {
      this.logger.debug(
        `Device ${deviceIdentifier} with temp access is excluded from concurrent limit check`,
      );
      return {
        allowed: true,
        currentStreams: 0,
        limit,
      };
    }

    // Count ALL current streams for this user (not excluding current device)
    // We count all streams and check if over the limit
    const currentStreams = await this.countActiveStreams(
      userId,
      sessionsData,
    );

    this.logger.debug(
      `Concurrent limit check for user ${userId}, device ${deviceIdentifier}: ` +
        `currentStreams=${currentStreams}, limit=${limit}`,
    );

    // Check if current streams exceed the limit
    // If user has 2 streams and limit is 1, terminate the excess
    if (currentStreams > limit) {
      const message = await this.configService.getSetting(
        'MSG_CONCURRENT_LIMIT',
      );
      return {
        allowed: false,
        reason:
          (message as string) ||
          'You have reached your concurrent stream limit. Please stop another stream before starting a new one.',
        stopCode: 'CONCURRENT_LIMIT',
        currentStreams,
        limit,
      };
    }

    return {
      allowed: true,
      currentStreams,
      limit,
    };
  }

  /**
   * Get concurrent stream info for a user (for display purposes).
   */
  async getConcurrentStreamInfo(
    userId: string,
    sessionsData?: PlexSessionsResponse,
  ): Promise<{
    limit: number;
    currentStreams: number;
    isUnlimited: boolean;
  }> {
    const limit = await this.getEffectiveLimit(userId);
    const currentStreams = sessionsData
      ? await this.countActiveStreams(userId, sessionsData)
      : 0;

    return {
      limit,
      currentStreams,
      isUnlimited: limit === 0,
    };
  }
}
