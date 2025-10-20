import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../../../entities/user-preference.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';
import { PlexClient } from '../../plex/services/plex-client';
import { Logger } from '@nestjs/common';

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
  async getAllUsers(includeHidden: boolean = false): Promise<UserPreference[]> {
    if (includeHidden) {
      return await this.userPreferenceRepository.find();
    }
    return await this.userPreferenceRepository.find({
      where: { hidden: false },
    });
  }

  // Get only hidden users
  async getHiddenUsers(): Promise<UserPreference[]> {
    return await this.userPreferenceRepository.find({
      where: { hidden: true },
    });
  }

  // Toggle user visibility (hide/show)
  async toggleUserVisibility(userId: string): Promise<UserPreference> {
    const user = await this.userPreferenceRepository.findOne({
      where: { userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    user.hidden = !user.hidden;
    return await this.userPreferenceRepository.save(user);
  }

  // Hide a user
  async hideUser(userId: string): Promise<UserPreference> {
    const user = await this.userPreferenceRepository.findOne({
      where: { userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    user.hidden = true;
    return await this.userPreferenceRepository.save(user);
  }

  // Show a user (unhide)
  async showUser(userId: string): Promise<UserPreference> {
    const user = await this.userPreferenceRepository.findOne({
      where: { userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    user.hidden = false;
    return await this.userPreferenceRepository.save(user);
  }

  // Create user if not exists
  async updateUserFromSessionData(
    userId: string,
    username?: string,
    avatarUrl?: string,
  ): Promise<void> {
    if (!userId) return;

    try {
      // Check if user preference exists
      const preference = await this.userPreferenceRepository.findOne({
        where: { userId },
      });

      if (!preference) {
        // Create new user preference if it doesn't exist
        const newPreference = this.userPreferenceRepository.create({
          userId,
          username,
          defaultBlock: null, // null means use global default
        });

        await this.userPreferenceRepository.save(newPreference);
        this.logger.debug(
          `Created new user preference: ${userId} (${username})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating user from session data: ${userId}`,
        error,
      );
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
    const savedPreference =
      await this.userPreferenceRepository.save(preference);
    return savedPreference;
  }

  async updateUserIPPolicy(
    userId: string,
    updates: {
      networkPolicy?: 'both' | 'lan' | 'wan';
      ipAccessPolicy?: 'all' | 'restricted';
      allowedIPs?: string[];
    },
  ): Promise<UserPreference> {
    let preference = await this.userPreferenceRepository.findOne({
      where: { userId },
    });

    if (preference) {
      // Update existing preference
      if (updates.networkPolicy !== undefined) {
        preference.networkPolicy = updates.networkPolicy;
      }
      if (updates.ipAccessPolicy !== undefined) {
        preference.ipAccessPolicy = updates.ipAccessPolicy;
      }
      if (updates.allowedIPs !== undefined) {
        preference.allowedIPs = updates.allowedIPs;
      }
      this.logger.log(
        `Updating IP policy for user: ${userId}`,
        JSON.stringify(updates),
      );
    } else {
      throw new Error('User preference not found. Does the user exist?');
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

  private parseUsersFromXML(xmlString: string): any[] {
    try {
      const users: any[] = [];
      const userMatches = xmlString.match(/<User[^>]*>/g);

      if (!userMatches) {
        this.logger.debug('No User elements found in XML response');
        return [];
      }

      for (const userMatch of userMatches) {
        const user: any = {};

        // Extract attributes from the User element
        const idMatch = userMatch.match(/id="([^"]*)"/);
        const usernameMatch =
          userMatch.match(/username="([^"]*)"/) ||
          userMatch.match(/title="([^"]*)"/);
        const thumbMatch = userMatch.match(/thumb="([^"]*)"/);
        const friendlyNameMatch = userMatch.match(/friendlyName="([^"]*)"/);

        if (idMatch) user.id = idMatch[1];
        if (usernameMatch) user.username = usernameMatch[1];
        if (thumbMatch) user.thumb = thumbMatch[1];
        if (friendlyNameMatch) user.friendlyName = friendlyNameMatch[1];

        users.push(user);
      }

      this.logger.debug(`Parsed ${users.length} users from XML response`);
      return users;
    } catch (error) {
      this.logger.error('Failed to parse XML response:', error);
      return [];
    }
  }

  async syncUsersFromPlexTV(): Promise<{
    updated: number;
    created: number;
    errors: number;
  }> {
    let updated = 0;
    let created = 0;
    let errors = 0;

    try {
      this.logger.log('Starting Plex users sync from Plex.tv API...');

      // Fetch users from Plex.tv
      const response = await this.plexClient.getPlexUsers();

      if (!response) {
        this.logger.warn('No users data received from Plex.tv API');
        return { updated: 0, created: 0, errors: 1 };
      }

      // Parse XML response
      let users: any[] = [];
      if (typeof response === 'string') {
        this.logger.debug('Parsing XML response from Plex.tv');
        users = this.parseUsersFromXML(response);
      } else if (response.users) {
        users = Array.isArray(response.users)
          ? response.users
          : [response.users];
      }

      if (!users || users.length === 0) {
        this.logger.warn('No users found in Plex.tv API response');
        return { updated: 0, created: 0, errors: 1 };
      }
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

          // Prepare user data for upsert
          const userData = {
            userId,
            username,
            avatarUrl,
            // Only set defaultBlock for new users, preserve existing preference
            ...(existingUser ? {} : { defaultBlock: null }),
          };

          // Include id for existing users to avoid the TypeORM error
          if (existingUser) {
            userData['id'] = existingUser.id;
          }

          // Upsert user preference
          await this.userPreferenceRepository.upsert(userData, {
            conflictPaths: ['userId'],
            skipUpdateIfNoValuesChanged: true,
          });

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
        `Plex users sync completed: ${created} created, ${updated} updated, ${errors} errors`,
      );

      return { updated, created, errors };
    } catch (error) {
      this.logger.error('Failed to sync users from Plex.tv:', error);
      return { updated, created, errors: errors + 1 };
    }
  }
}
