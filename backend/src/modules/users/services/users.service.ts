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
    // Get all existing user preferences
    const existingPreferences = await this.userPreferenceRepository.find();
    
    // Get users from devices with their latest avatar URLs
    const usersFromDevices = await this.userDeviceRepository
      .createQueryBuilder('device')
      .select('device.userId', 'userId')
      .addSelect('device.username', 'username')
      .addSelect('device.avatarUrl', 'avatarUrl')
      .where('device.avatarUrl IS NOT NULL') // Only get devices with avatar URLs
      .orderBy('device.lastSeen', 'DESC') // Get the most recent avatar URL
      .distinct(true)
      .getRawMany();

    const result: UserPreference[] = [...existingPreferences];
    const existingUserIds = new Set(existingPreferences.map(p => p.userId));

    // Update existing preferences with latest avatar URLs from devices
    for (const preference of existingPreferences) {
      const deviceUser = usersFromDevices.find(u => u.userId === preference.userId);
      if (deviceUser?.avatarUrl && (!preference.avatarUrl || preference.avatarUrl !== deviceUser.avatarUrl)) {
        this.logger.log(`Updating avatar URL for user ${preference.userId}: ${deviceUser.avatarUrl}`);
        preference.avatarUrl = deviceUser.avatarUrl;
        // Also update username if it's missing
        if (!preference.username && deviceUser.username) {
          preference.username = deviceUser.username;
        }
        await this.userPreferenceRepository.save(preference);
      }
    }

    // Also get all users from devices (including those without avatar URLs) for creating new preferences
    const allUsersFromDevices = await this.userDeviceRepository
      .createQueryBuilder('device')
      .select('device.userId', 'userId')
      .addSelect('device.username', 'username')
      .addSelect('device.avatarUrl', 'avatarUrl')
      .distinct(true)
      .getRawMany();

    // Create preferences for users with devices but no preferences
    for (const user of allUsersFromDevices) {
      if (!existingUserIds.has(user.userId)) {
        console.log('Creating default preference for user:', user);

        // Create default preference entry
        const newPreference = this.userPreferenceRepository.create({
          userId: user.userId,
          username: user.username,
          avatarUrl: user.avatarUrl,
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
      preference.defaultBlock = defaultBlock;
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
        defaultBlock: defaultBlock,
      });
    }

    // Save the preference
    const savedPreference =
      await this.userPreferenceRepository.save(preference);

    return savedPreference;
  }

  async getEffectiveDefaultBlock(userId: string): Promise<boolean> {
    const preference = await this.getUserPreference(userId);

    // If user has a specific preference, use it
    if (preference && preference.defaultBlock !== null) {
      return preference.defaultBlock;
    }

    // Otherwise use global default from config
    const defaultBlock = await this.configService.getSetting(
      'PLEX_GUARD_DEFAULT_BLOCK',
    );
    return defaultBlock;
  }
}
