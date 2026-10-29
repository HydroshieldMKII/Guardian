import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { errorMessage } from '@/common/utils/error-types';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { serialTransaction } from '@/database/serial-transaction';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private temporaryAccessService: TemporaryAccessService,
  ) {}

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

  async findDeviceByIdentifier(
    deviceIdentifier: string,
  ): Promise<UserDevice | null> {
    return this.userDeviceRepository.findOne({
      where: { deviceIdentifier },
    });
  }

  async approveDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, { status: 'approved' });
    await this.temporaryAccessService.revokeTemporaryAccess(deviceId);
    this.logger.log(`Device ${deviceId} has been approved`);
  }

  async rejectDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, { status: 'rejected' });
    this.logger.log(`Device ${deviceId} has been rejected`);
  }

  async setPendingDevice(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, { status: 'pending' });
    await this.temporaryAccessService.revokeTemporaryAccess(deviceId);
    this.logger.log(`Device ${deviceId} has been set to pending`);
  }

  async deleteDevice(deviceId: number): Promise<void> {
    try {
      await serialTransaction(
        this.userDeviceRepository.manager,
        async (transactionalEntityManager) => {
          await transactionalEntityManager
            .getRepository(SessionHistory)
            .delete({ userDeviceId: deviceId });

          this.logger.debug(`Session history deleted for device ${deviceId}`);

          await transactionalEntityManager
            .getRepository(UserDevice)
            .delete(deviceId);
        },
      );

      this.logger.log(
        `Device ${deviceId} and its related data have been deleted`,
      );
    } catch (error) {
      this.logger.error(`Failed to delete device ${deviceId}:`, error);
      throw new Error(`Device deletion failed: ${errorMessage(error)}`);
    }
  }

  async renameDevice(deviceId: number, newName: string): Promise<void> {
    await this.userDeviceRepository.update(deviceId, { deviceName: newName });
    this.logger.log(`Device ${deviceId} has been renamed to "${newName}"`);
  }

  async updateExcludeFromConcurrentLimit(
    deviceId: number,
    exclude: boolean,
  ): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      excludeFromConcurrentLimit: exclude,
    });
    this.logger.log(
      `Device ${deviceId} ${exclude ? 'excluded from' : 'included in'} concurrent stream limit`,
    );
  }

  async markNoteAsRead(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      requestNoteReadAt: new Date(),
    });
    this.logger.log(`Note marked as read for device ${deviceId}`);
  }

  async deleteNote(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      requestDescription: null,
      requestSubmittedAt: null,
      requestNoteReadAt: null,
    });
    this.logger.log(`Note deleted for device ${deviceId}`);
  }
}
