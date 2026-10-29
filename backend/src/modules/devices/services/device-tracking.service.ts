import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { ConfigService } from '@/modules/config/services/config.service';
import {
  PlexSession,
  DeviceInfo,
  PlexSessionsResponse,
} from '@/types/plex.types';
import { isPlexampDevice } from '@/common/utils/plexamp.utils';
import { DeviceEventsService } from '@/modules/devices/services/device-events.service';
import { SessionKeyRegistry } from '@/modules/devices/services/session-key-registry';
import {
  isStrictModeEnabled,
  strictModeStatus,
} from '@/modules/devices/services/strict-mode';

@Injectable()
export class DeviceTrackingService {
  private readonly logger = new Logger(DeviceTrackingService.name);
  private readonly sessionKeys = new SessionKeyRegistry();

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    private usersService: UsersService,
    private configService: ConfigService,
    private deviceEvents: DeviceEventsService,
  ) {}

  async processSessionsForDeviceTracking(
    sessionsData: PlexSessionsResponse,
  ): Promise<void> {
    const sessions = sessionsData?.MediaContainer?.Metadata ?? [];

    for (const session of sessions) {
      await this.processSession(session);
    }
  }

  cleanupStaleSessionKeys(): void {
    const cleanedCount = this.sessionKeys.pruneStale();
    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} stale session key entries from memory`,
      );
    }
  }

  async clearSessionKey(sessionKey: string): Promise<void> {
    this.logger.debug(`Attempting to clear session key: ${sessionKey}`);

    const devicesWithSession = await this.userDeviceRepository.find({
      where: { currentSessionKey: sessionKey },
      select: ['id', 'deviceIdentifier', 'currentSessionKey', 'userId'],
    });

    this.logger.debug(
      `Found ${devicesWithSession.length} device(s) with session key ${sessionKey}`,
    );

    for (const device of devicesWithSession) {
      this.sessionKeys.forget(device, sessionKey);
    }

    const result = await this.userDeviceRepository.update(
      { currentSessionKey: sessionKey },
      { currentSessionKey: null },
    );

    await this.sessionHistoryRepository.update(
      { sessionKey, endedAt: IsNull() },
      { endedAt: new Date() },
    );

    this.logger.debug(
      `Cleared session key for ${result.affected || 0} device(s) that stopped streaming (session: ${sessionKey})`,
    );
  }

  private async processSession(session: PlexSession): Promise<void> {
    try {
      const deviceInfo = this.extractDeviceInfo(session);

      await this.usersService.updateUserFromSessionData(
        deviceInfo.userId,
        deviceInfo.username,
        deviceInfo.avatarUrl,
      );

      const existingDevice = await this.userDeviceRepository.findOne({
        where: {
          userId: deviceInfo.userId,
          deviceIdentifier: deviceInfo.deviceIdentifier,
        },
      });

      if (existingDevice) {
        await this.updateExistingDevice(existingDevice, deviceInfo);
      } else {
        this.logger.debug(`Device not found, creating new device entry...`);
        await this.createNewDevice(deviceInfo);
      }
    } catch (error) {
      this.logger.error('Error processing session', error);
    }
  }

  private extractDeviceInfo(session: PlexSession): DeviceInfo {
    return {
      userId: session.User?.id || session.User?.uuid || 'unknown',
      username: session.User?.title,
      avatarUrl: session.User?.thumb,
      deviceIdentifier: session.Player?.machineIdentifier || 'unknown',
      sessionKey: session.sessionKey,
      deviceName: session.Player?.device || session.Player?.title,
      devicePlatform: session.Player?.platform,
      deviceProduct: session.Player?.product,
      deviceVersion: session.Player?.version,
      ipAddress: session.Player?.address,
    };
  }

  private async updateExistingDevice(
    existingDevice: UserDevice,
    deviceInfo: DeviceInfo,
  ): Promise<void> {
    existingDevice.lastSeen = new Date();
    this.countNewSession(existingDevice, deviceInfo);
    this.fillMissingDetails(existingDevice, deviceInfo);
    this.updateIpAddress(existingDevice, deviceInfo);
    await this.userDeviceRepository.save(existingDevice);
  }

  private countNewSession(device: UserDevice, deviceInfo: DeviceInfo): void {
    if (!deviceInfo.sessionKey) {
      return;
    }

    const isNewSession = this.sessionKeys.recordSession(
      deviceInfo,
      deviceInfo.sessionKey,
      device.currentSessionKey,
    );
    if (!isNewSession) {
      return;
    }

    device.sessionCount += 1;
    device.currentSessionKey = deviceInfo.sessionKey;
    this.logger.debug(
      `New session started for device ${deviceInfo.deviceIdentifier}. Session count: ${device.sessionCount}`,
    );
  }

  private fillMissingDetails(device: UserDevice, deviceInfo: DeviceInfo): void {
    if (deviceInfo.deviceName && !device.deviceName) {
      device.deviceName = deviceInfo.deviceName;
    }
    if (deviceInfo.devicePlatform && !device.devicePlatform) {
      device.devicePlatform = deviceInfo.devicePlatform;
    }
    if (deviceInfo.deviceProduct && !device.deviceProduct) {
      device.deviceProduct = deviceInfo.deviceProduct;
    }
    if (deviceInfo.deviceVersion) {
      device.deviceVersion = deviceInfo.deviceVersion;
    }
    if (deviceInfo.username && !device.username) {
      device.username = deviceInfo.username;
    }
  }

  private updateIpAddress(device: UserDevice, deviceInfo: DeviceInfo): void {
    if (!deviceInfo.ipAddress || deviceInfo.ipAddress === device.ipAddress) {
      return;
    }

    if (device.ipAddress) {
      this.logger.log(
        `Device location changed for ${deviceInfo.deviceIdentifier}: ${device.ipAddress} -> ${deviceInfo.ipAddress}`,
      );
      this.deviceEvents.emitLocationChange({
        userId: deviceInfo.userId,
        username: deviceInfo.username || device.username || 'Unknown',
        deviceName:
          deviceInfo.deviceName || device.deviceName || 'Unknown Device',
        deviceIdentifier: deviceInfo.deviceIdentifier,
        oldIpAddress: device.ipAddress,
        newIpAddress: deviceInfo.ipAddress,
        sessionKey: deviceInfo.sessionKey,
      });
    }

    device.ipAddress = deviceInfo.ipAddress;
  }

  private async createNewDevice(deviceInfo: DeviceInfo): Promise<void> {
    const defaultBlock = await this.usersService.getEffectiveDefaultBlock(
      deviceInfo.userId,
    );
    const isStrictMode = await isStrictModeEnabled(this.configService);
    const initialStatus = isStrictMode
      ? strictModeStatus(deviceInfo, defaultBlock)
      : 'pending';

    this.logger.log('New device detected', {
      userId: deviceInfo.userId,
      username: deviceInfo.username,
      deviceName: deviceInfo.deviceName,
      deviceIdentifier: deviceInfo.deviceIdentifier,
      platform: deviceInfo.devicePlatform,
      strictMode: isStrictMode,
      isPlexampDevice: isPlexampDevice(deviceInfo),
      initialStatus,
    });

    const newDevice = this.userDeviceRepository.create({
      userId: deviceInfo.userId,
      username: deviceInfo.username,
      deviceIdentifier: deviceInfo.deviceIdentifier,
      deviceName: deviceInfo.deviceName,
      devicePlatform: deviceInfo.devicePlatform,
      deviceProduct: deviceInfo.deviceProduct,
      deviceVersion: deviceInfo.deviceVersion,
      status: initialStatus,
      sessionCount: 1,
      currentSessionKey: deviceInfo.sessionKey,
      ipAddress: deviceInfo.ipAddress,
    });

    await this.userDeviceRepository.save(newDevice);

    const statusMessage = isStrictMode
      ? `Status: ${initialStatus} (strict mode)`
      : `Status: pending, App default action: ${defaultBlock ? 'Block' : 'Allow'}`;

    this.logger.warn(
      `NEW DEVICE DETECTED! User: ${deviceInfo.username || deviceInfo.userId}, IP: ${deviceInfo.ipAddress || 'Unknown IP'}, Device: ${deviceInfo.deviceName || deviceInfo.deviceIdentifier}, Platform: ${deviceInfo.devicePlatform || 'Unknown'}, ${statusMessage}`,
    );

    this.deviceEvents.emitNewDevice({
      userId: deviceInfo.userId,
      username: deviceInfo.username || 'Unknown User',
      deviceName: deviceInfo.deviceName || 'Unknown Device',
      deviceIdentifier: deviceInfo.deviceIdentifier,
      ipAddress: deviceInfo.ipAddress || 'Unknown IP',
      platform: deviceInfo.devicePlatform || 'Unknown',
      sessionKey: deviceInfo.sessionKey ?? undefined,
    });
  }
}
