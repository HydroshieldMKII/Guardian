import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { isPlexampDevice } from '@/common/utils/plexamp.utils';
import { DevicesService } from '@/modules/devices/services/devices.service';
import {
  isStrictModeEnabled,
  strictModeStatus,
} from '@/modules/devices/services/strict-mode';

@Injectable()
export class DeviceMaintenanceService {
  private readonly logger = new Logger(DeviceMaintenanceService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    private usersService: UsersService,
    private configService: ConfigService,
    private devicesService: DevicesService,
  ) {}

  async enforceStrictModeOnPendingDevices(): Promise<number> {
    if (!(await isStrictModeEnabled(this.configService))) {
      return 0;
    }

    const pendingDevices = await this.devicesService.getPendingDevices();
    if (pendingDevices.length === 0) {
      return 0;
    }

    this.logger.log(
      `Strict mode enabled: Processing ${pendingDevices.length} pending device(s)`,
    );

    let processedCount = 0;
    for (const device of pendingDevices) {
      if (await this.applyStrictMode(device)) {
        processedCount++;
      }
    }

    if (processedCount > 0) {
      this.logger.log(
        `Strict mode enforcement complete: ${processedCount} device(s) processed`,
      );
    }

    return processedCount;
  }

  async cleanupInactiveDevices(
    inactiveDays: number,
  ): Promise<{ deletedCount: number; deletedDevices: UserDevice[] }> {
    const allDevices = await this.userDeviceRepository.find();

    if (allDevices.length === 0) {
      this.logger.log('No devices found in the database, skipping cleanup.');
      return { deletedCount: 0, deletedDevices: [] };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
    const inactiveDevices = allDevices.filter((device) => {
      if (!device.lastSeen) {
        this.logger.warn(
          `Device ${device.id} has no lastSeen date, skipping...`,
        );
        return false;
      }
      return new Date(device.lastSeen) < cutoffDate;
    });

    this.logger.log(
      `Found ${inactiveDevices.length} inactive device(s) older than ${inactiveDays} days`,
    );

    for (const device of inactiveDevices) {
      this.logger.log(
        `Removing inactive device: ${device.deviceName || device.deviceIdentifier} ` +
          `(User: ${device.username || device.userId}, Last seen: ${device.lastSeen.toISOString()})`,
      );
    }

    const inactiveDeviceIds = inactiveDevices.map((device) => device.id);
    await this.sessionHistoryRepository.delete({
      userDeviceId: In(inactiveDeviceIds),
    });
    this.logger.log(
      `Deleted session history for ${inactiveDevices.length} inactive device(s)`,
    );

    await this.userDeviceRepository.delete({ id: In(inactiveDeviceIds) });
    this.logger.log(
      `Successfully removed ${inactiveDevices.length} inactive device(s)`,
    );

    return {
      deletedCount: inactiveDevices.length,
      deletedDevices: inactiveDevices,
    };
  }

  private async applyStrictMode(device: UserDevice): Promise<boolean> {
    try {
      const defaultBlock = await this.usersService.getEffectiveDefaultBlock(
        device.userId,
      );
      device.status = strictModeStatus(device, defaultBlock);
      await this.userDeviceRepository.save(device);

      this.logger.log(
        `Strict mode: Device "${device.deviceName || device.deviceIdentifier}" for user "${device.username || device.userId}" -> ${device.status}${isPlexampDevice(device) ? ' (Plexamp)' : ''}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error processing device ${device.deviceIdentifier} in strict mode:`,
        error,
      );
      return false;
    }
  }
}
