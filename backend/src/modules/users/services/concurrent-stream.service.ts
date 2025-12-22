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
   * Filter sessions to only those that count toward concurrent limit.
   * Excludes Plexamp sessions, excluded devices, and optionally temp access devices.
   */
  async filterCountableSessions(
    userId: string,
    sessions: PlexSession[],
  ): Promise<PlexSession[]> {
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

      const hasValidTempAccess =
        await this.deviceTrackingService.isTemporaryAccessValid(device);
      deviceTempAccessMap.set(device.deviceIdentifier, hasValidTempAccess);
    }

    const countable: PlexSession[] = [];

    for (const session of sessions) {
      const sessionUserId = String(
        session.User?.id || session.User?.uuid || '',
      );
      const deviceIdentifier = session.Player?.machineIdentifier;

      // Filter by user
      if (sessionUserId !== String(userId)) continue;
      if (!deviceIdentifier) continue;

      // Skip Plexamp sessions
      if (isPlexampSession(session)) {
        this.logger.debug(
          `Plexamp session excluded from concurrent stream count`,
        );
        continue;
      }

      // Skip devices marked as excluded
      if (deviceExclusionMap.get(deviceIdentifier)) {
        this.logger.debug(
          `Device ${deviceIdentifier} excluded from concurrent stream count`,
        );
        continue;
      }

      // Skip temp access devices if configured
      if (!includeTempAccess && deviceTempAccessMap.get(deviceIdentifier)) {
        this.logger.debug(
          `Device ${deviceIdentifier} with temp access excluded from concurrent stream count`,
        );
        continue;
      }

      countable.push(session);
    }

    return countable;
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
    const countable = await this.filterCountableSessions(userId, sessions);
    return countable.length;
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
