import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UsersService } from '../../users/services/users.service';
import {
  PlexSession,
  DeviceInfo,
  PlexSessionsResponse,
} from '../../../types/plex.types';

@Injectable()
export class DeviceTrackingService {
  private readonly logger = new Logger(DeviceTrackingService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    private usersService: UsersService,
  ) {}

  // Function to process sessions and track devices
  async processSessionsForDeviceTracking(
    sessionsData: PlexSessionsResponse,
  ): Promise<void> {
    const sessions = this.extractSessionsFromData(sessionsData);

    if (!sessions || sessions.length === 0) {
      // this.logger.debug('No active sessions found for device tracking');
      return;
    }

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

      // Update user info directly from session data
      await this.usersService.updateUserFromSessionData(
        deviceInfo.userId,
        deviceInfo.username,
        deviceInfo.avatarUrl
      );

      await this.trackDevice(deviceInfo);
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

  // Function to track or update device info in the database
  private async trackDevice(deviceInfo: DeviceInfo): Promise<void> {
    try {
      // this.logger.debug(`Tracking device: ${deviceInfo.deviceIdentifier} for user: ${deviceInfo.userId} with session: ${deviceInfo.sessionKey}`);
      
      // Check if device already exists
      const existingDevice = await this.userDeviceRepository.findOne({
        where: {
          userId: deviceInfo.userId,
          deviceIdentifier: deviceInfo.deviceIdentifier,
        },
      });

      if (existingDevice) {
        // this.logger.debug(`Found existing device ${existingDevice.id}, updating...`);
        // Update existing device
        await this.updateExistingDevice(existingDevice, deviceInfo);
      } else {
        this.logger.debug(`Device not found, creating new device entry...`);
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
    
    // Only increment session count if this is a new session
    if (deviceInfo.sessionKey && existingDevice.currentSessionKey !== deviceInfo.sessionKey) {
      existingDevice.sessionCount += 1;
      existingDevice.currentSessionKey = deviceInfo.sessionKey;
      this.logger.debug(`New session started for device ${deviceInfo.deviceIdentifier}. Session count: ${existingDevice.sessionCount}`);
    }

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
    const defaultBlock = await this.usersService.getEffectiveDefaultBlock(
      deviceInfo.userId,
    ); // User wont have a preference yet, so this will return app default

    console.log('New device detected:', deviceInfo);

    const newDevice = this.userDeviceRepository.create({
      userId: deviceInfo.userId,
      username: deviceInfo.username,
      deviceIdentifier: deviceInfo.deviceIdentifier,
      deviceName: deviceInfo.deviceName,
      devicePlatform: deviceInfo.devicePlatform,
      deviceProduct: deviceInfo.deviceProduct,
      deviceVersion: deviceInfo.deviceVersion,
      status: 'pending',
      sessionCount: 1,
      currentSessionKey: deviceInfo.sessionKey,
      ipAddress: deviceInfo.ipAddress,
    });

    await this.userDeviceRepository.save(newDevice);

    this.logger.warn(
      `🚨 NEW DEVICE DETECTED! User: ${deviceInfo.username || deviceInfo.userId}, Device: ${deviceInfo.deviceName || deviceInfo.deviceIdentifier}, Platform: ${deviceInfo.devicePlatform || 'Unknown'}, Status: pending, App default action: ${defaultBlock ? 'Block' : 'Allow'}`,
    );
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

  async findDeviceByIdentifier(deviceIdentifier: string): Promise<UserDevice | null> {
    return this.userDeviceRepository.findOne({
      where: { deviceIdentifier },
    });
  }

  async approveDevice(deviceId: number): Promise<void> {
    // First update the status to approved
    await this.userDeviceRepository.update(deviceId, {
      status: 'approved',
    });

    // Then revoke any temporary access
    await this.revokeTemporaryAccess(deviceId);

    this.logger.log(`Device ${deviceId} has been approved`);
  }

  async rejectDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      status: 'rejected',
    });
    this.logger.log(`Device ${deviceId} has been rejected`);
  }

  async deleteDevice(deviceId: number): Promise<void> {
    try {
      await this.userDeviceRepository.manager.transaction(async transactionalEntityManager => {
        await transactionalEntityManager
          .getRepository(SessionHistory)
          .delete({ userDeviceId: deviceId });
        
        this.logger.debug(`Session history deleted for device ${deviceId}`);
        
        await transactionalEntityManager
          .getRepository(UserDevice)
          .delete(deviceId);
      });
      
      this.logger.log(`Device ${deviceId} and its related data have been deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete device ${deviceId}:`, error);
      throw new Error(`Device deletion failed: ${error.message}`);
    }
  }

  async renameDevice(deviceId: number, newName: string): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      deviceName: newName,
    });
    this.logger.log(`Device ${deviceId} has been renamed to "${newName}"`);
  }

  async grantTemporaryAccess(deviceId: number, durationMinutes: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    await this.userDeviceRepository.update(deviceId, {
      temporaryAccessUntil: expiresAt,
      temporaryAccessGrantedAt: now,
      temporaryAccessDurationMinutes: durationMinutes,
    });

    this.logger.log(`Granted temporary access to device ${deviceId} for ${durationMinutes} minutes (expires at ${expiresAt.toISOString()})`);
  }

  async revokeTemporaryAccess(deviceId: number): Promise<void> {
    await this.userDeviceRepository
      .createQueryBuilder()
      .update(UserDevice)
      .set({ 
        temporaryAccessUntil: () => 'NULL',
        temporaryAccessGrantedAt: () => 'NULL',
        temporaryAccessDurationMinutes: () => 'NULL'
      })
      .where('id = :deviceId', { deviceId })
      .execute();

    this.logger.log(`Revoked temporary access for device ${deviceId}`);
  }

  async isTemporaryAccessValid(device: UserDevice): Promise<boolean> {
    if (!device.temporaryAccessUntil) {
      return false;
    }

    const now = new Date();
    const isValid = device.temporaryAccessUntil > now;

    if (!isValid) {
      // Temporary access has expired, clean it up
      await this.revokeTemporaryAccess(device.id);
      this.logger.log(`Temporary access expired for device ${device.id}, cleaned up`);
    }

    return isValid;
  }

  async getTemporaryAccessTimeLeft(device: UserDevice): Promise<number | null> {
    if (!device.temporaryAccessUntil) {
      return null;
    }

    const now = new Date();
    const timeLeft = device.temporaryAccessUntil.getTime() - now.getTime();
    
    return timeLeft > 0 ? Math.ceil(timeLeft / (60 * 1000)) : 0; // Return minutes left
  }

  async clearSessionKey(sessionKey: string): Promise<void> {
    this.logger.debug(`Attempting to clear session key: ${sessionKey}`);
    
    // Find devices with this session key first
    const devicesWithSession = await this.userDeviceRepository.find({
      where: { currentSessionKey: sessionKey },
      select: ['id', 'deviceIdentifier', 'currentSessionKey']
    });
    
    this.logger.debug(`Found ${devicesWithSession.length} device(s) with session key ${sessionKey}`);
    
    // Clear specific session key for device that stopped streaming
    const result = await this.userDeviceRepository
      .createQueryBuilder()
      .update(UserDevice)
      .set({ currentSessionKey: () => 'NULL' })
      .where('current_session_key = :sessionKey', { sessionKey })
      .execute();

    // Find in session history and mark terminated at true
    await this.sessionHistoryRepository
          .createQueryBuilder()
          .update(SessionHistory)
          .set({ endedAt: () => 'CURRENT_TIMESTAMP'})
          .where('session_key = :sessionKey', { sessionKey })
          .execute();
      
    this.logger.debug(`Cleared session key for ${result.affected || 0} device(s) that stopped streaming (session: ${sessionKey})`);
  
  }

  async cleanupInactiveDevices(inactiveDays: number): Promise<{ deletedCount: number; deletedDevices: UserDevice[] }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const allDevices = await this.userDeviceRepository.find();

    if (allDevices.length === 0) {
      this.logger.log('No devices found in the database, skipping cleanup.');
      return { deletedCount: 0, deletedDevices: [] };
    }

    const inactiveDevices: UserDevice[] = [];
    
    for (const device of allDevices) {
      if (!device.lastSeen) {
        this.logger.warn(`Device ${device.id} has no lastSeen date, skipping...`);
        continue;
      }
      
      if (new Date(device.lastSeen) < cutoffDate) {
        inactiveDevices.push(device);
      }
    }

    this.logger.log(`Found ${inactiveDevices.length} inactive device(s) older than ${inactiveDays} days`);
    
    // Log which devices will be deleted
    for (const device of inactiveDevices) {
      this.logger.log(
        `Removing inactive device: ${device.deviceName || device.deviceIdentifier} ` +
        `(User: ${device.username || device.userId}, Last seen: ${device.lastSeen.toISOString()})`
      );
    }

    // Delete session history for inactive devices
    const inactiveDeviceIds = inactiveDevices.map(device => device.id);
    await this.sessionHistoryRepository.delete({ userDeviceId: In(inactiveDeviceIds) });
    this.logger.log(`Deleted session history for ${inactiveDevices.length} inactive device(s)`);

    // Delete the inactive devices
    const deviceIds = inactiveDevices.map(device => device.id);
    await this.userDeviceRepository.delete({ id: In(deviceIds) });

    this.logger.log(`Successfully removed ${inactiveDevices.length} inactive device(s)`);
    
    return { 
      deletedCount: inactiveDevices.length, 
      deletedDevices: inactiveDevices 
    };
  }
  
}
