import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../entities/user-device.entity';
import {
  PlexSession,
  DeviceInfo,
  PlexSessionsResponse,
} from '../types/plex.types';

@Injectable()
export class DeviceTrackingService {
  private readonly logger = new Logger(DeviceTrackingService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
  ) {}

  async processSessionsForDeviceTracking(
    sessionsData: PlexSessionsResponse,
  ): Promise<void> {
    const sessions = this.extractSessionsFromData(sessionsData);

    if (!sessions || sessions.length === 0) {
      this.logger.debug('No active sessions found for device tracking');
      return;
    }

    // this.logger.log(
    //   `Processing ${sessions.length} sessions for device tracking`,
    // );

    for (const session of sessions) {
      try {
        await this.processSession(session);
      } catch (error) {
        this.logger.error(
          'Error processing sessions for device tracking:',
          error,
        );
      }
    }
  }

  private extractSessionsFromData(data: PlexSessionsResponse): PlexSession[] {
    if (!data || !data.MediaContainer) {
      return [];
    }

    return data.MediaContainer.Metadata || [];
  }

  private async processSession(session: PlexSession): Promise<void> {
    try {
      const deviceInfo = this.extractDeviceInfo(session);

      if (!deviceInfo.userId || !deviceInfo.deviceIdentifier) {
        this.logger.warn(
          'Session missing required user ID or device identifier',
          {
            userId: deviceInfo.userId,
            deviceIdentifier: deviceInfo.deviceIdentifier,
          },
        );
        return;
      }

      await this.trackDevice(deviceInfo);
    } catch (error) {
      this.logger.error('Error processing session', error);
    }
  }

  private extractDeviceInfo(session: PlexSession): DeviceInfo {
    return {
      userId: session.User?.id || session.User?.uuid || 'unknown',
      username: session.User?.title,
      deviceIdentifier: session.Player?.machineIdentifier || 'unknown',
      deviceName: session.Player?.device || session.Player?.title,
      devicePlatform: session.Player?.platform,
      deviceProduct: session.Player?.product,
      deviceVersion: session.Player?.version,
      userAgent: session.Player?.userAgent,
      ipAddress: session.Player?.address,
    };
  }

  private async trackDevice(deviceInfo: DeviceInfo): Promise<void> {
    try {
      // Check if device already exists
      const existingDevice = await this.userDeviceRepository.findOne({
        where: {
          userId: deviceInfo.userId,
          deviceIdentifier: deviceInfo.deviceIdentifier,
        },
      });

      if (existingDevice) {
        // Update existing device
        await this.updateExistingDevice(existingDevice, deviceInfo);
      } else {
        // Create new device entry
        await this.createNewDevice(deviceInfo);
      }
    } catch (error) {
      this.logger.error('Error tracking device', error);
      throw error;
    }
  }

  private async updateExistingDevice(
    existingDevice: UserDevice,
    deviceInfo: DeviceInfo,
  ): Promise<void> {
    existingDevice.lastSeen = new Date();
    existingDevice.sessionCount += 1;

    // Update device info if it has changed or was null
    if (deviceInfo.deviceName && !existingDevice.deviceName) {
      existingDevice.deviceName = deviceInfo.deviceName;
    }
    if (deviceInfo.devicePlatform && !existingDevice.devicePlatform) {
      existingDevice.devicePlatform = deviceInfo.devicePlatform;
    }
    if (deviceInfo.deviceProduct && !existingDevice.deviceProduct) {
      existingDevice.deviceProduct = deviceInfo.deviceProduct;
    }
    if (deviceInfo.deviceVersion) {
      existingDevice.deviceVersion = deviceInfo.deviceVersion;
    }
    if (deviceInfo.userAgent) {
      existingDevice.userAgent = deviceInfo.userAgent;
    }
    if (deviceInfo.ipAddress) {
      existingDevice.ipAddress = deviceInfo.ipAddress;
    }
    if (deviceInfo.username && !existingDevice.username) {
      existingDevice.username = deviceInfo.username;
    }

    await this.userDeviceRepository.save(existingDevice);
    // this.logger.debug(
    //   `Updated existing device for user ${deviceInfo.userId}: ${deviceInfo.deviceIdentifier}`,
    // );
  }

  private async createNewDevice(deviceInfo: DeviceInfo): Promise<void> {
    const defaultBlock = process.env.PLEX_GUARD_DEFAULT_BLOCK === 'true';

    console.log('New device detected:', deviceInfo);

    const newDevice = this.userDeviceRepository.create({
      userId: deviceInfo.userId,
      username: deviceInfo.username,
      deviceIdentifier: deviceInfo.deviceIdentifier,
      deviceName: deviceInfo.deviceName,
      devicePlatform: deviceInfo.devicePlatform,
      deviceProduct: deviceInfo.deviceProduct,
      deviceVersion: deviceInfo.deviceVersion,
      status: 'pending', // New devices start as pending
      sessionCount: 1,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
    });

    await this.userDeviceRepository.save(newDevice);

    this.logger.warn(
      `🚨 NEW DEVICE DETECTED! User: ${deviceInfo.username || deviceInfo.userId}, Device: ${deviceInfo.deviceName || deviceInfo.deviceIdentifier}, Platform: ${deviceInfo.devicePlatform || 'Unknown'}`,
    );
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return this.userDeviceRepository.find({
      where: { userId },
      order: { lastSeen: 'DESC' },
    });
  }

  async getAllDevices(): Promise<UserDevice[]> {
    return this.userDeviceRepository.find({
      order: { lastSeen: 'DESC' },
    });
  }

  async getPendingDevices(): Promise<UserDevice[]> {
    return this.userDeviceRepository.find({
      where: { status: 'pending' },
      order: { firstSeen: 'DESC' },
    });
  }

  async getProcessedDevices(): Promise<UserDevice[]> {
    return this.userDeviceRepository.find({
      where: [{ status: 'approved' }, { status: 'rejected' }],
      order: { lastSeen: 'DESC' },
    });
  }

  async getApprovedDevices(): Promise<UserDevice[]> {
    return this.userDeviceRepository.find({
      where: { status: 'approved' },
      order: { lastSeen: 'DESC' },
    });
  }

  async findDeviceByUserAndIdentifier(
    userId: string,
    deviceIdentifier: string,
  ): Promise<UserDevice | null> {
    return this.userDeviceRepository.findOne({
      where: { userId, deviceIdentifier },
    });
  }

  async approveDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      status: 'approved',
    });
    this.logger.log(`Device ${deviceId} has been approved`);
  }

  async rejectDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      status: 'rejected',
    });
    this.logger.log(`Device ${deviceId} has been rejected`);
  }

  async deleteDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.delete(deviceId);
    this.logger.log(`Device ${deviceId} has been rejected and deleted`);
  }
}
