import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '@/entities/user-preference.entity';
import { PlexClient } from '@/modules/plex/services/plex-client';
import {
  PlexTvUser,
  parsePlexTvUsers,
} from '@/modules/users/services/plex-tv-users';

export interface PlexUserSyncResult {
  updated: number;
  created: number;
  errors: number;
}

type SyncOutcome = keyof PlexUserSyncResult | 'unchanged';

@Injectable()
export class PlexUserSyncService {
  private readonly logger = new Logger(PlexUserSyncService.name);

  constructor(
    @InjectRepository(UserPreference)
    private readonly userPreferenceRepository: Repository<UserPreference>,
    @Inject(forwardRef(() => PlexClient))
    private readonly plexClient: PlexClient,
  ) {}

  async syncUsersFromPlexTV(): Promise<PlexUserSyncResult> {
    this.logger.log('Starting Plex users sync from Plex.tv API...');
    const users = await this.fetchUsers();
    if (!users) {
      return { updated: 0, created: 0, errors: 1 };
    }

    const result: PlexUserSyncResult = { updated: 0, created: 0, errors: 0 };
    for (const user of users) {
      const outcome = await this.syncUser(user);
      if (outcome !== 'unchanged') result[outcome]++;
    }

    this.logger.log(
      `Plex users sync completed: ${result.created} created, ${result.updated} updated, ${result.errors} errors`,
    );
    return result;
  }

  private async fetchUsers(): Promise<PlexTvUser[] | null> {
    try {
      const response = await this.plexClient.getPlexUsers();
      const users = response ? parsePlexTvUsers(response) : [];
      if (users.length === 0) {
        this.logger.warn('No users found in Plex.tv API response');
        return null;
      }
      this.logger.log(`Received ${users.length} users from Plex.tv`);
      return users;
    } catch (error) {
      this.logger.error('Failed to sync users from Plex.tv:', error);
      return null;
    }
  }

  private async syncUser({
    id: userId,
    username,
    thumb: avatarUrl,
  }: PlexTvUser): Promise<SyncOutcome> {
    if (!userId) {
      this.logger.warn('Skipping user with no ID');
      return 'errors';
    }

    try {
      const existingUser = await this.userPreferenceRepository.findOne({
        where: { userId },
      });

      await this.userPreferenceRepository.upsert(
        {
          userId,
          username,
          avatarUrl,
          ...(existingUser ? { id: existingUser.id } : { defaultBlock: null }),
        },
        { conflictPaths: ['userId'], skipUpdateIfNoValuesChanged: true },
      );

      if (!existingUser) {
        this.logger.log(`Created new user: ${userId} (${username})`);
        return 'created';
      }

      const hasChanges =
        (!!username && existingUser.username !== username) ||
        (!!avatarUrl && existingUser.avatarUrl !== avatarUrl);
      if (!hasChanges) return 'unchanged';

      this.logger.debug(`Updated user: ${userId} (${username})`);
      return 'updated';
    } catch (error) {
      this.logger.error(`Error processing user ${userId}:`, error);
      return 'errors';
    }
  }
}
