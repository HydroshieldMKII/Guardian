import {
  Injectable,
  Logger,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { AppSettings } from '../../../entities/app-settings.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

export interface UserPortalDevice {
  id: number;
  deviceIdentifier: string;
  deviceName: string;
  devicePlatform: string;
  deviceProduct: string;
  status: 'pending' | 'approved' | 'rejected';
  firstSeen: Date;
  lastSeen: Date;
  requestDescription?: string;
  requestSubmittedAt?: Date;
  requestNoteReadAt?: Date;
  hasTemporaryAccess: boolean;
  temporaryAccessUntil?: Date;
  temporaryAccessBypassPolicies?: boolean;
  excludeFromConcurrentLimit: boolean;
  // Device-specific rules
  rules?: {
    timeRules: UserPortalTimeRule[];
  };
}

export interface UserPortalTimeRule {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  ruleName: string;
  enabled: boolean;
  deviceIdentifier?: string; // null for user-wide rules
}

export interface UserPortalUserRules {
  // User-level settings from UserPreference
  networkPolicy: 'both' | 'lan' | 'wan';
  ipAccessPolicy: 'all' | 'restricted';
  allowedIPs?: string[];
  concurrentStreamLimit: number | null; // null = global default, 0 = unlimited
  effectiveConcurrentStreamLimit: number; // The actual limit (resolved from user or global)
  defaultBlock: boolean | null; // null = global default
  // User-wide time rules (no device specified)
  timeRules: UserPortalTimeRule[];
}

@Injectable()
export class UserPortalService {
  private readonly logger = new Logger(UserPortalService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(UserTimeRule)
    private userTimeRuleRepository: Repository<UserTimeRule>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    @InjectRepository(AppSettings)
    private appSettingsRepository: Repository<AppSettings>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Get a setting value
   */
  private async getSetting(key: string): Promise<string | null> {
    const setting = await this.appSettingsRepository.findOne({
      where: { key },
    });
    return setting?.value || null;
  }

  /**
   * Get boolean setting with default
   */
  private async getBooleanSetting(
    key: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    const value = await this.getSetting(key);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  /**
   * Get user's devices (for the user portal)
   * Only returns devices for this specific Plex user
   * Includes device-specific rules if showRules is enabled
   */
  async getUserDevices(plexUserId: string): Promise<UserPortalDevice[]> {
    const devices = await this.userDeviceRepository.find({
      where: { userId: plexUserId },
      order: { lastSeen: 'DESC' },
    });

    const now = new Date();

    // Check if we should show rules
    const showRules = await this.getBooleanSetting(
      'USER_PORTAL_SHOW_RULES',
      false,
    );

    // Get device-specific time rules if showRules is enabled
    let deviceTimeRulesMap = new Map<string, UserPortalTimeRule[]>();
    if (showRules) {
      const deviceTimeRules = await this.userTimeRuleRepository.find({
        where: {
          userId: plexUserId,
        },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });

      // Group by device identifier (only device-specific rules)
      for (const rule of deviceTimeRules) {
        if (rule.deviceIdentifier) {
          const existing = deviceTimeRulesMap.get(rule.deviceIdentifier) || [];
          existing.push({
            id: rule.id,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            ruleName: rule.ruleName,
            enabled: rule.enabled,
            deviceIdentifier: rule.deviceIdentifier,
          });
          deviceTimeRulesMap.set(rule.deviceIdentifier, existing);
        }
      }
    }

    return devices.map((device) => {
      const deviceRules = deviceTimeRulesMap.get(device.deviceIdentifier);

      // Plexamp devices are always effectively approved (they bypass all checks)
      const isPlexamp = device.deviceProduct?.toLowerCase().includes('plexamp');
      const effectiveStatus = isPlexamp ? 'approved' : device.status;

      return {
        id: device.id,
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.deviceName || 'Unknown Device',
        devicePlatform: device.devicePlatform || 'Unknown',
        deviceProduct: device.deviceProduct || 'Unknown',
        status: effectiveStatus,
        firstSeen: device.firstSeen,
        lastSeen: device.lastSeen,
        requestDescription: device.requestDescription || undefined,
        requestSubmittedAt: device.requestSubmittedAt || undefined,
        requestNoteReadAt: device.requestNoteReadAt || undefined,
        hasTemporaryAccess:
          device.temporaryAccessUntil && device.temporaryAccessUntil > now,
        temporaryAccessUntil:
          device.temporaryAccessUntil && device.temporaryAccessUntil > now
            ? device.temporaryAccessUntil
            : undefined,
        temporaryAccessBypassPolicies:
          device.temporaryAccessUntil && device.temporaryAccessUntil > now
            ? device.temporaryAccessBypassPolicies
            : undefined,
        excludeFromConcurrentLimit: device.excludeFromConcurrentLimit,
        rules:
          showRules && deviceRules && deviceRules.length > 0
            ? {
                timeRules: deviceRules,
              }
            : undefined,
      };
    });
  }

  /**
   * Get all user rules (user preferences + user-wide time rules)
   * Returns null if showRules is disabled in settings
   */
  async getUserRules(plexUserId: string): Promise<UserPortalUserRules | null> {
    // Check if showing rules is enabled
    const showRules = await this.getBooleanSetting(
      'USER_PORTAL_SHOW_RULES',
      false,
    );

    if (!showRules) {
      return null;
    }

    // Get user preferences
    const userPreference = await this.userPreferenceRepository.findOne({
      where: { userId: plexUserId },
    });

    // Also get rules where deviceIdentifier is explicitly empty string or undefined
    const allUserTimeRules = await this.userTimeRuleRepository
      .createQueryBuilder('rule')
      .where('rule.userId = :userId', { userId: plexUserId })
      .andWhere(
        '(rule.deviceIdentifier IS NULL OR rule.deviceIdentifier = :empty)',
        { empty: '' },
      )
      .orderBy('rule.dayOfWeek', 'ASC')
      .addOrderBy('rule.startTime', 'ASC')
      .getMany();

    // Get the effective concurrent stream limit
    let effectiveConcurrentStreamLimit: number =
      userPreference?.concurrentStreamLimit ?? -1;
    if (
      effectiveConcurrentStreamLimit === -1 ||
      effectiveConcurrentStreamLimit === null
    ) {
      // Get global default
      const globalLimit = await this.appSettingsRepository.findOne({
        where: { key: 'CONCURRENT_STREAM_LIMIT' },
      });
      const parsed = globalLimit ? parseInt(globalLimit.value, 10) : 0;
      effectiveConcurrentStreamLimit = isNaN(parsed) ? 0 : parsed;
    }

    return {
      networkPolicy: userPreference?.networkPolicy || 'both',
      ipAccessPolicy: userPreference?.ipAccessPolicy || 'all',
      allowedIPs: userPreference?.allowedIPs || undefined,
      concurrentStreamLimit: userPreference?.concurrentStreamLimit ?? null,
      effectiveConcurrentStreamLimit,
      defaultBlock: userPreference?.defaultBlock ?? null,
      timeRules: allUserTimeRules.map((rule) => ({
        id: rule.id,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        ruleName: rule.ruleName,
        enabled: rule.enabled,
        deviceIdentifier: rule.deviceIdentifier || undefined,
      })),
    };
  }

  /**
   * Request device approval (for pending or rejected devices)
   * Adds a description to explain why they want access
   */
  async requestDeviceApproval(
    plexUserId: string,
    deviceId: number,
    description?: string,
  ): Promise<void> {
    // Find the device and verify ownership
    const device = await this.userDeviceRepository.findOne({
      where: { id: deviceId },
    });

    if (!device) {
      throw new ForbiddenException('Device not found');
    }

    // Verify the device belongs to this user
    if (device.userId !== plexUserId) {
      throw new ForbiddenException('Access denied to this device');
    }

    // Check if device can have approval requested
    if (device.status === 'approved') {
      throw new ForbiddenException('Device is already approved');
    }

    // Check if a request has already been submitted (only allow once per device)
    if (device.requestSubmittedAt) {
      throw new ForbiddenException(
        'A note has already been submitted for this device. You can only submit once.',
      );
    }

    // For rejected devices, check if note submission is allowed
    if (device.status === 'rejected') {
      const allowRejectedRequests = await this.getBooleanSetting(
        'USER_PORTAL_ALLOW_REJECTED_REQUESTS',
        true,
      );

      if (!allowRejectedRequests) {
        throw new ForbiddenException(
          'Adding notes for rejected devices is not allowed',
        );
      }
    }

    // Update device with request description
    await this.userDeviceRepository.update(deviceId, {
      requestDescription: description || '',
      requestSubmittedAt: new Date(),
    });

    // Send notification about the device note
    if (description) {
      try {
        // Get the username from UserPreference
        const userPreference = await this.userPreferenceRepository.findOne({
          where: { userId: plexUserId },
        });
        const username = userPreference?.username || 'Unknown User';

        await this.notificationsService.createDeviceNoteNotification(
          plexUserId,
          username,
          device.deviceName,
          description,
        );
      } catch (error) {
        this.logger.error('Failed to send device note notification:', error);
      }
    }

    this.logger.log(
      `User ${plexUserId} requested approval for device ${deviceId}`,
    );
  }

  /**
   * Get portal settings for the user
   */
  async getPortalSettings(): Promise<{
    showRules: boolean;
    allowRejectedRequests: boolean;
  }> {
    const showRules = await this.getBooleanSetting(
      'USER_PORTAL_SHOW_RULES',
      false,
    );
    const allowRejectedRequests = await this.getBooleanSetting(
      'USER_PORTAL_ALLOW_REJECTED_REQUESTS',
      true,
    );

    return {
      showRules,
      allowRejectedRequests,
    };
  }
}
