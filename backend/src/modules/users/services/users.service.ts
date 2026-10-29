import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '@/entities/user-preference.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigService } from '@/modules/config/services/config.service';

type VisibilityAction = 'hide' | 'show' | 'toggle';

export interface IpPolicyUpdate {
  networkPolicy?: 'both' | 'lan' | 'wan';
  ipAccessPolicy?: 'all' | 'restricted';
  allowedIPs?: string[];
}

const describeStreamLimit = (limit: number | null): string => {
  if (limit === null) return 'global default';
  return limit === 0 ? 'unlimited' : String(limit);
};

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

  async getAllUsers(includeHidden: boolean = false): Promise<UserPreference[]> {
    if (includeHidden) {
      return await this.userPreferenceRepository.find();
    }
    return await this.userPreferenceRepository.find({
      where: { hidden: false },
    });
  }

  async getHiddenUsers(): Promise<UserPreference[]> {
    return await this.userPreferenceRepository.find({
      where: { hidden: true },
    });
  }

  async updateUserVisibility(
    userId: string,
    action: VisibilityAction,
  ): Promise<UserPreference> {
    const user = await this.requirePreference(userId, 'User not found');
    user.hidden = action === 'toggle' ? !user.hidden : action === 'hide';
    return await this.userPreferenceRepository.save(user);
  }

  async toggleUserVisibility(userId: string): Promise<UserPreference> {
    return this.updateUserVisibility(userId, 'toggle');
  }

  async hideUser(userId: string): Promise<UserPreference> {
    return this.updateUserVisibility(userId, 'hide');
  }

  async showUser(userId: string): Promise<UserPreference> {
    return this.updateUserVisibility(userId, 'show');
  }

  async updateUserFromSessionData(
    userId: string | null,
    username?: string | null,
  ): Promise<void> {
    if (!userId) return;

    try {
      if (await this.getUserPreference(userId)) return;

      await this.userPreferenceRepository.save(
        this.userPreferenceRepository.create({
          userId,
          username,
          defaultBlock: null,
        }),
      );
      this.logger.debug(`Created new user preference: ${userId} (${username})`);
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
    const preference = await this.getUserPreference(userId);

    if (preference) {
      preference.defaultBlock = defaultBlock;
      this.logger.log(
        `Updating preference for user: ${userId} to ${defaultBlock}`,
      );
      return await this.userPreferenceRepository.save(preference);
    }

    const device = await this.userDeviceRepository.findOne({
      where: { userId },
    });
    if (!device) {
      throw new NotFoundException('User not found');
    }
    this.logger.warn(
      `No existing preference for user ${userId}, creating new entry`,
    );
    return await this.userPreferenceRepository.save(
      this.userPreferenceRepository.create({
        userId,
        username: device?.username || undefined,
        defaultBlock,
      }),
    );
  }

  async updateUserIPPolicy(
    userId: string,
    updates: IpPolicyUpdate,
  ): Promise<UserPreference> {
    const preference = await this.requirePreference(userId);

    const changesAllowList =
      updates.ipAccessPolicy !== undefined || updates.allowedIPs !== undefined;
    const effectivePolicy = updates.ipAccessPolicy ?? preference.ipAccessPolicy;
    const effectiveIPs = updates.allowedIPs ?? preference.allowedIPs ?? [];
    if (
      changesAllowList &&
      effectivePolicy === 'restricted' &&
      effectiveIPs.length === 0
    ) {
      throw new BadRequestException(
        'A restricted IP access policy needs at least one allowed address',
      );
    }

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

    return await this.userPreferenceRepository.save(preference);
  }

  async updateConcurrentStreamLimit(
    userId: string,
    concurrentStreamLimit: number | null,
  ): Promise<UserPreference> {
    const preference = await this.requirePreference(userId);

    preference.concurrentStreamLimit = concurrentStreamLimit;
    this.logger.log(
      `Updating concurrent stream limit for user: ${userId} to ${describeStreamLimit(concurrentStreamLimit)}`,
    );

    return await this.userPreferenceRepository.save(preference);
  }

  async getEffectiveDefaultBlock(userId: string): Promise<boolean> {
    const preference = await this.getUserPreference(userId);
    if (preference && preference.defaultBlock !== null) {
      return preference.defaultBlock;
    }

    const defaultBlock = await this.configService.getSetting(
      'PLEX_GUARD_DEFAULT_BLOCK',
    );
    return defaultBlock ?? false;
  }

  private async requirePreference(
    userId: string,
    missingMessage = 'User preference not found. Does the user exist?',
  ): Promise<UserPreference> {
    const preference = await this.getUserPreference(userId);
    if (!preference) {
      throw new NotFoundException(missingMessage);
    }
    return preference;
  }
}
