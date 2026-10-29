import {
  Injectable,
  Logger,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { UserTimeRule } from '@/entities/user-time-rule.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { AppSettings } from '@/entities/app-settings.entity';
import { NotificationDispatchService } from '@/modules/notifications/services/notification-dispatch.service';
import {
  UserPortalDevice,
  UserPortalTimeRule,
  UserPortalUserRules,
  groupRulesByDevice,
  toPortalDevice,
  toPortalTimeRule,
} from '@/modules/user-portal/services/user-portal-view';

export interface UserPortalSettings {
  showRules: boolean;
  allowRejectedRequests: boolean;
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
    @Inject(forwardRef(() => NotificationDispatchService))
    private notificationDispatch: NotificationDispatchService,
  ) {}

  async getUserDevices(plexUserId: string): Promise<UserPortalDevice[]> {
    const devices = await this.userDeviceRepository.find({
      where: { userId: plexUserId },
      order: { lastSeen: 'DESC' },
    });

    const rulesByDevice = (await this.showsRules())
      ? groupRulesByDevice(
          await this.userTimeRuleRepository.find({
            where: { userId: plexUserId },
            order: { dayOfWeek: 'ASC', startTime: 'ASC' },
          }),
        )
      : new Map<string, UserPortalTimeRule[]>();

    const now = new Date();
    return devices.map((device) =>
      toPortalDevice(device, rulesByDevice.get(device.deviceIdentifier), now),
    );
  }

  async getUserRules(plexUserId: string): Promise<UserPortalUserRules | null> {
    if (!(await this.showsRules())) {
      return null;
    }

    const userPreference = await this.findPreference(plexUserId);
    const userWideRules = await this.userTimeRuleRepository.find({
      where: [
        { userId: plexUserId, deviceIdentifier: IsNull() },
        { userId: plexUserId, deviceIdentifier: '' },
      ],
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });

    return {
      networkPolicy: userPreference?.networkPolicy || 'both',
      ipAccessPolicy: userPreference?.ipAccessPolicy || 'all',
      allowedIPs: userPreference?.allowedIPs || undefined,
      concurrentStreamLimit: userPreference?.concurrentStreamLimit ?? null,
      effectiveConcurrentStreamLimit:
        userPreference?.concurrentStreamLimit ??
        (await this.globalStreamLimit()),
      defaultBlock: userPreference?.defaultBlock ?? null,
      effectiveDefaultBlock:
        userPreference?.defaultBlock ??
        (await this.getBooleanSetting('PLEX_GUARD_DEFAULT_BLOCK', false)),
      timeRules: userWideRules.map(toPortalTimeRule),
    };
  }

  async requestDeviceApproval(
    plexUserId: string,
    deviceId: number,
    description?: string,
  ): Promise<void> {
    const device = await this.findRequestableDevice(deviceId, plexUserId);

    await this.userDeviceRepository.update(deviceId, {
      requestDescription: description || '',
      requestSubmittedAt: new Date(),
    });

    if (description) {
      await this.notifyDeviceNote(plexUserId, device.deviceName, description);
    }

    this.logger.log(
      `User ${plexUserId} requested approval for device ${deviceId}`,
    );
  }

  async getPortalSettings(): Promise<UserPortalSettings> {
    return {
      showRules: await this.showsRules(),
      allowRejectedRequests: await this.allowsRejectedRequests(),
    };
  }

  private async findRequestableDevice(
    deviceId: number,
    plexUserId: string,
  ): Promise<UserDevice> {
    const device = await this.userDeviceRepository.findOne({
      where: { id: deviceId, userId: plexUserId },
    });
    if (!device) {
      throw new ForbiddenException('Device not found');
    }
    if (device.status === 'approved') {
      throw new ForbiddenException('Device is already approved');
    }
    if (device.requestSubmittedAt) {
      throw new ForbiddenException(
        'A note has already been submitted for this device. You can only submit once.',
      );
    }
    if (
      device.status === 'rejected' &&
      !(await this.allowsRejectedRequests())
    ) {
      throw new ForbiddenException(
        'Adding notes for rejected devices is not allowed',
      );
    }
    return device;
  }

  private async notifyDeviceNote(
    plexUserId: string,
    deviceName: UserDevice['deviceName'],
    description: string,
  ): Promise<void> {
    try {
      const userPreference = await this.findPreference(plexUserId);
      await this.notificationDispatch.createDeviceNoteNotification(
        plexUserId,
        userPreference?.username || 'Unknown User',
        deviceName,
        description,
      );
    } catch (error) {
      this.logger.error('Failed to send device note notification:', error);
    }
  }

  private findPreference(userId: string): Promise<UserPreference | null> {
    return this.userPreferenceRepository.findOne({ where: { userId } });
  }

  private showsRules(): Promise<boolean> {
    return this.getBooleanSetting('USER_PORTAL_SHOW_RULES', false);
  }

  private allowsRejectedRequests(): Promise<boolean> {
    return this.getBooleanSetting('USER_PORTAL_ALLOW_REJECTED_REQUESTS', true);
  }

  private async globalStreamLimit(): Promise<number> {
    const parsed = parseInt(
      (await this.getSetting('CONCURRENT_STREAM_LIMIT')) ?? '0',
      10,
    );
    return isNaN(parsed) ? 0 : parsed;
  }

  private async getSetting(key: string): Promise<string | null> {
    const setting = await this.appSettingsRepository.findOne({
      where: { key },
    });
    return setting?.value || null;
  }

  private async getBooleanSetting(
    key: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    const value = await this.getSetting(key);
    if (value === null) return defaultValue;
    return value === 'true';
  }
}
