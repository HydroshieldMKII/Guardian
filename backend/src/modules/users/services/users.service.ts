import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../../../entities/user-preference.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserPreference)
    private readonly userPreferenceRepository: Repository<UserPreference>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
  ) {}

  // Get all users with preferences, creating default entries if there is a device but no user preference
  async getAllUsers(): Promise<UserPreference[]> {
    const usersFromDevices = await this.userDeviceRepository
      .createQueryBuilder('device')
      .select('device.userId', 'userId')
      .addSelect('device.username', 'username')
      .distinct(true)
      .getRawMany();

    const result: UserPreference[] = [];

    for (const user of usersFromDevices) {
      const preference = await this.userPreferenceRepository.findOne({
        where: { userId: user.userId },
      });

      if (preference) {
        result.push(preference);
      } else {
        console.log('Creating default preference for user:', user);

        // Create default preference entry
        const newPreference = this.userPreferenceRepository.create({
          userId: user.userId,
          username: user.username,
          defaultBlock: null, // null means use global default
        });

        // Save the preference to the database
        const savedPreference =
          await this.userPreferenceRepository.save(newPreference);
        result.push(savedPreference);
      }
    }

    return result;
  }

  async getUserPreference(userId: string): Promise<UserPreference | null> {
    return this.userPreferenceRepository.findOne({
      where: { userId },
    });
  }

  async updateUserPreference(
    userId: string,
    defaultBlock: boolean | null,
  ): Promise<UserPreference> {
    let preference = await this.userPreferenceRepository.findOne({
      where: { userId },
    });

    if (preference) {
      // Update existing preference
      preference.setDefaultBlockBoolean(defaultBlock);
      this.logger.log(
        `Updating preference for user: ${userId} to ${defaultBlock}`,
      );
    } else {
      // Fallback: Create new preference for the userId
      this.logger.warn(
        `No existing preference for user ${userId}, creating new entry`,
      );

      // Get username from devices
      const device = await this.userDeviceRepository.findOne({
        where: { userId },
      });

      // Create new preference entry
      preference = this.userPreferenceRepository.create({
        userId,
        username: device?.username || undefined,
        defaultBlock: null,
      });

      preference.setDefaultBlockBoolean(defaultBlock);
    }

    // Save the preference
    const savedPreference =
      await this.userPreferenceRepository.save(preference);

    // Update all pending devices for this user to match the new preference
    await this.updatePendingDevicesForUser(userId, defaultBlock);

    return savedPreference;
  }

  private async updatePendingDevicesForUser(
    userId: string,
    defaultBlock: boolean | null,
  ): Promise<void> {
    // Get effective default block setting
    const effectiveDefaultBlock =
      defaultBlock !== null
        ? defaultBlock
        : (await this.configService.getSetting('PLEX_GUARD_DEFAULT_BLOCK')) ===
            'true' ||
          (await this.configService.getSetting('PLEX_GUARD_DEFAULT_BLOCK')) ===
            true;

    // Find all pending (blocked) devices for this user
    const pendingDevices = await this.userDeviceRepository.find({
      where: { userId, status: 'pending' },
    });

    if (pendingDevices.length === 0) {
      return;
    }

    // Get the new status based on effective default block
    const newStatus = effectiveDefaultBlock ? 'pending' : 'approved';

    // Update all pending devices to the new status
    await this.userDeviceRepository.update(
      { userId, status: 'pending' },
      { status: newStatus },
    );

    this.logger.log(
      `Updated ${pendingDevices.length} pending device(s) for user ${userId} to status: ${newStatus} (user preference: ${defaultBlock === null ? 'global default' : defaultBlock ? 'block' : 'allow'})`,
    );
  }

  async getEffectiveDefaultBlock(userId: string): Promise<boolean> {
    const preference = await this.getUserPreference(userId);

    // If user has a specific preference, use it
    if (preference && preference.defaultBlock !== null) {
      return preference.getDefaultBlockBoolean()!;
    }

    // Otherwise use global default from config
    const defaultBlock = await this.configService.getSetting(
      'PLEX_GUARD_DEFAULT_BLOCK',
    );
    return defaultBlock === 'true' || defaultBlock === true;
  }
}
