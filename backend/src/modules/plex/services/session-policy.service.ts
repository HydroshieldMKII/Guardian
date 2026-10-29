import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { TimePolicyService } from '@/modules/users/services/time-policy.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import {
  IPValidationResult,
  IPValidationService,
} from '@/common/services/ip-validation.service';
import { PlexSession, isPlexampSession } from '@/types/plex.types';
import { StopCode } from '@/common/utils/stop-codes';
import { DEFAULT_BLOCK_MESSAGES } from '@/common/utils/block-messages';

export interface PolicyDecision {
  shouldStop: boolean;
  reason?: string;
  stopCode?: StopCode;
}

const ALLOW: PolicyDecision = { shouldStop: false };

@Injectable()
export class SessionPolicyService {
  private readonly logger = new Logger(SessionPolicyService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    private usersService: UsersService,
    private timePolicyService: TimePolicyService,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    @Inject(forwardRef(() => TemporaryAccessService))
    private temporaryAccessService: TemporaryAccessService,
    private ipValidationService: IPValidationService,
  ) {}

  async evaluate(session: PlexSession): Promise<PolicyDecision> {
    try {
      const userId = session.User?.id || session.User?.uuid;
      const deviceIdentifier = session.Player?.machineIdentifier;

      if (!userId || !deviceIdentifier) {
        this.logger.warn(
          'Session missing user ID or device identifier, cannot determine approval status',
        );
        return ALLOW;
      }

      if (isPlexampSession(session)) {
        return ALLOW;
      }

      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });
      const hasTemporaryAccess =
        !!device &&
        (await this.temporaryAccessService.isTemporaryAccessValid(device));

      if (hasTemporaryAccess && device.temporaryAccessBypassPolicies) {
        this.logger.log(
          `Device ${deviceIdentifier} has temporary access with policy bypass enabled - allowing session`,
        );
        return ALLOW;
      }

      const ipDecision = await this.checkIPAccess(session, userId);
      if (ipDecision.shouldStop) {
        return ipDecision;
      }

      const timeDecision = await this.checkTimePolicy(userId, deviceIdentifier);
      if (timeDecision.shouldStop) {
        return timeDecision;
      }

      if (hasTemporaryAccess) {
        return ALLOW;
      }

      if (!device || device.status === 'pending') {
        return this.checkPendingDevice(userId);
      }

      if (device.status === 'rejected') {
        this.logger.warn(
          `Device ${deviceIdentifier} for user ${userId} is explicitly rejected.`,
        );
        return {
          shouldStop: true,
          reason:
            (await this.configService.getSetting('MSG_DEVICE_REJECTED')) ||
            DEFAULT_BLOCK_MESSAGES.deviceRejected,
          stopCode: 'DEVICE_REJECTED',
        };
      }

      return ALLOW;
    } catch (error) {
      this.logger.error('Error checking session approval status', error);
      return ALLOW;
    }
  }

  private async checkPendingDevice(userId: string): Promise<PolicyDecision> {
    const shouldBlock =
      await this.usersService.getEffectiveDefaultBlock(userId);
    if (!shouldBlock) {
      return ALLOW;
    }
    return {
      shouldStop: true,
      reason:
        (await this.configService.getSetting('MSG_DEVICE_PENDING')) ||
        DEFAULT_BLOCK_MESSAGES.devicePending,
      stopCode: 'DEVICE_PENDING',
    };
  }

  private async checkTimePolicy(
    userId: string,
    deviceIdentifier: string,
  ): Promise<PolicyDecision> {
    const isTimeAllowed = await this.timePolicyService.isTimeScheduleAllowed(
      userId,
      deviceIdentifier,
    );
    if (isTimeAllowed) {
      return ALLOW;
    }

    const timePolicySummary = await this.timePolicyService.getPolicySummary(
      userId,
      deviceIdentifier,
    );
    this.logger.warn(
      `Device ${deviceIdentifier} for user ${userId} is blocked by time policy: ${timePolicySummary}`,
    );

    return {
      shouldStop: true,
      reason:
        (await this.configService.getSetting('MSG_TIME_RESTRICTED')) ||
        DEFAULT_BLOCK_MESSAGES.timeRestricted,
      stopCode: 'TIME_RESTRICTED',
    };
  }

  private async checkIPAccess(
    session: PlexSession,
    userId: string,
  ): Promise<PolicyDecision> {
    const result = await this.validateIPAccess(session, userId);
    if (result.allowed) {
      return ALLOW;
    }
    this.logger.warn(`IP access denied for user ${userId}: ${result.reason}`);
    return {
      shouldStop: true,
      reason: `${result.reason}`,
      stopCode: result.stopCode,
    };
  }

  private async validateIPAccess(
    session: PlexSession,
    userId: string,
  ): Promise<IPValidationResult> {
    try {
      const clientIP = session.Player?.address;

      if (!clientIP) {
        return {
          allowed: false,
          reason: 'Invalid or missing client IP address from Plex',
        };
      }

      const userPreference = await this.userPreferenceRepository.findOne({
        where: { userId },
      });

      if (!userPreference) {
        return { allowed: true };
      }
      const [msgLanOnly, msgWanOnly, msgNotAllowed] = await Promise.all([
        this.configService.getSetting('MSG_IP_LAN_ONLY'),
        this.configService.getSetting('MSG_IP_WAN_ONLY'),
        this.configService.getSetting('MSG_IP_NOT_ALLOWED'),
      ]);
      return this.ipValidationService.validateIPAccess(
        clientIP,
        {
          networkPolicy: userPreference.networkPolicy || 'both',
          ipAccessPolicy: userPreference.ipAccessPolicy || 'all',
          allowedIPs: userPreference.allowedIPs || [],
        },
        {
          lanOnly: msgLanOnly ?? undefined,
          wanOnly: msgWanOnly ?? undefined,
          notAllowed: msgNotAllowed ?? undefined,
        },
      );
    } catch (error) {
      this.logger.error('Error validating IP access', error);
      return { allowed: true };
    }
  }
}
