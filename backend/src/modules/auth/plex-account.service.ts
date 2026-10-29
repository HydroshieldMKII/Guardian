import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AdminUser } from '@/entities/admin-user.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { PlexUser } from '@/modules/auth/plex-tv.client';

@Injectable()
export class PlexAccountService {
  private readonly logger = new Logger(PlexAccountService.name);

  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
  ) {}

  async isPlexUserOnServer(plexUserId: string): Promise<boolean> {
    const userPreference = await this.userPreferenceRepository.findOne({
      where: { userId: plexUserId },
    });
    return userPreference !== null;
  }

  async getAdminWithPlexLinked(): Promise<AdminUser | null> {
    return this.adminUserRepository.findOne({
      where: { plexUserId: Not(IsNull()) },
    });
  }

  async linkPlexAccountToAdmin(
    adminId: string,
    plexUser: PlexUser,
  ): Promise<AdminUser> {
    const existingLink = await this.adminUserRepository.findOne({
      where: { plexUserId: String(plexUser.id) },
    });

    if (existingLink && existingLink.id !== adminId) {
      throw new BadRequestException(
        'This Plex account is already linked to another admin',
      );
    }

    await this.adminUserRepository.update(adminId, {
      plexUserId: String(plexUser.id),
      plexUsername: plexUser.username,
      plexEmail: plexUser.email,
      plexThumb: plexUser.thumb,
    });

    return this.adminUserRepository.findOneOrFail({ where: { id: adminId } });
  }

  async unlinkPlexAccountFromAdmin(adminId: string): Promise<AdminUser> {
    this.logger.log(`Unlinking Plex account from admin ${adminId}`);

    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) {
      throw new Error('Admin not found');
    }

    await this.adminUserRepository.update(adminId, {
      plexUserId: null,
      plexUsername: null,
      plexEmail: null,
      plexThumb: null,
    });

    return this.adminUserRepository.findOneOrFail({ where: { id: adminId } });
  }
}
