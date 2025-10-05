import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../../../entities/user-preference.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';
import { PlexClient } from '../../plex/services/plex-client';

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
    @Inject(forwardRef(() => PlexClient))
    private readonly plexClient: PlexClient,
  ) {}

  // Get all users with preferences
  async getAllUsers(): Promise<UserPreference[]> {
    return await this.userPreferenceRepository.find();
  }

  // Update user info directly from session data (called during session processing)
  async updateUserFromSessionData(userId: string, username?: string, avatarUrl?: string): Promise<void> {
    if (!userId) return;

    try {
      // Find existing user preference
      let preference = await this.userPreferenceRepository.findOne({
        where: { userId },
      });

      let needsUpdate = false;
      let isNewUser = false;

      if (!preference) {
        // Create new user preference if it doesn't exist
        preference = this.userPreferenceRepository.create({
          userId,
          username,
          avatarUrl,
          defaultBlock: null, // null means use global default
        });
        isNewUser = true;
        needsUpdate = true;
      } else {
        // Update existing preference if data has changed
        if (avatarUrl && preference.avatarUrl !== avatarUrl) {
          preference.avatarUrl = avatarUrl;
          needsUpdate = true;
        }
        
        if (username && !preference.username) {
          preference.username = username;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await this.userPreferenceRepository.save(preference);
        if (isNewUser) {
          this.logger.debug(`Created new user preference: ${userId} (${username})`);
        } else {
          this.logger.debug(`Updated user info: ${userId} (${username})`);
        }
      }
    } catch (error) {
      this.logger.error(`Error updating user from session data: ${userId}`, error);
    }
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
    const savedPreference = await this.userPreferenceRepository.save(preference);
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

  async syncUsersFromPlexTV(): Promise<{ updated: number; created: number; errors: number }> {
    let updated = 0;
    let created = 0;
    let errors = 0;

    try {
      this.logger.log('Starting Plex Home users sync from Plex.tv API...');
      
      // Fetch users from Plex.tv
      const response = await this.plexClient.getPlexUsers();
      
      if (!response || !response.users) {
        this.logger.warn('No users data received from Plex.tv API');
        return { updated: 0, created: 0, errors: 1 };
      }

      const users = Array.isArray(response.users) ? response.users : [response.users];
      this.logger.log(`Received ${users.length} users from Plex.tv`);

      // Process each user
      for (const user of users) {
        try {
          const userId = String(user.id);
          const username = user.username || user.title || user.friendlyName;
          const avatarUrl = user.thumb;

          if (!userId) {
            this.logger.warn('Skipping user with no ID', user);
            errors++;
            continue;
          }

          // Check if user exists to track creates vs updates
          const existingUser = await this.userPreferenceRepository.findOne({
            where: { userId },
          });

          // Upsert user preference (insert or update)
          await this.userPreferenceRepository.upsert(
            {
              userId,
              username,
              avatarUrl,
              // Only set defaultBlock for new users, preserve existing preference
              ...(existingUser ? {} : { defaultBlock: null }),
            },
            {
              conflictPaths: ['userId'],
              skipUpdateIfNoValuesChanged: true,
            },
          );

          if (!existingUser) {
            created++;
            this.logger.log(`Created new user: ${userId} (${username})`);
          } else {
            // Check if anything actually changed
            const hasChanges = 
              (username && existingUser.username !== username) ||
              (avatarUrl && existingUser.avatarUrl !== avatarUrl);
            
            if (hasChanges) {
              updated++;
              this.logger.debug(`Updated user: ${userId} (${username})`);
            }
          }
        } catch (userError) {
          this.logger.error(`Error processing user:`, userError);
          errors++;
        }
      }

      this.logger.log(
        `Plex Home users sync completed: ${created} created, ${updated} updated, ${errors} errors`,
      );

      return { updated, created, errors };
    } catch (error) {
      this.logger.error('Failed to sync users from Plex.tv:', error);
      return { updated, created, errors: errors + 1 };
    }
  }
}
