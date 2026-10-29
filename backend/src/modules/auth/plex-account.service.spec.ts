import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Not } from 'typeorm';
import { AdminUser } from '@/entities/admin-user.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { PlexAccountService } from '@/modules/auth/plex-account.service';
import type { Mock } from 'vitest';

describe('PlexAccountService', () => {
  let service: PlexAccountService;
  let adminRepo: Record<string, Mock>;
  let preferenceRepo: { findOne: Mock };

  beforeEach(async () => {
    adminRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      findOneOrFail: vi.fn().mockResolvedValue({ id: 'admin-1' }),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    preferenceRepo = { findOne: vi.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        PlexAccountService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepo,
        },
      ],
    }).compile();

    service = module.get(PlexAccountService);
  });

  describe('server access checks', () => {
    it('treats a synced user preference as proof of access', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: '9' });
      await expect(service.isPlexUserOnServer('9')).resolves.toBe(true);
    });

    it('denies a Plex user with no preference row', async () => {
      await expect(service.isPlexUserOnServer('9')).resolves.toBe(false);
    });
  });

  describe('admin Plex links', () => {
    it('finds any admin with a linked Plex account', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await expect(service.getAdminWithPlexLinked()).resolves.toEqual({
        id: 'admin-1',
      });
      expect(adminRepo.findOne).toHaveBeenCalledWith({
        where: { plexUserId: Not(IsNull()) },
      });
    });
  });

  describe('linkPlexAccountToAdmin', () => {
    const plexUser = {
      id: 9,
      uuid: 'uuid-9',
      username: 'guest',
      email: 'guest@example.com',
      thumb: 'thumb.png',
      authToken: 'tok',
    };

    it('stores the Plex identity against the admin', async () => {
      await service.linkPlexAccountToAdmin('admin-1', plexUser);

      expect(adminRepo.update).toHaveBeenCalledWith('admin-1', {
        plexUserId: '9',
        plexUsername: 'guest',
        plexEmail: 'guest@example.com',
        plexThumb: 'thumb.png',
      });
    });

    it('refuses a Plex account already linked elsewhere', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-2' });

      await expect(
        service.linkPlexAccountToAdmin('admin-1', plexUser),
      ).rejects.toThrow('This Plex account is already linked to another admin');
      expect(adminRepo.update).not.toHaveBeenCalled();
    });

    it('allows re-linking the same account to the same admin', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await expect(
        service.linkPlexAccountToAdmin('admin-1', plexUser),
      ).resolves.toEqual({ id: 'admin-1' });
    });
  });

  describe('unlinkPlexAccountFromAdmin', () => {
    it('nulls every Plex column for that admin', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await service.unlinkPlexAccountFromAdmin('admin-1');

      expect(adminRepo.update).toHaveBeenCalledWith('admin-1', {
        plexUserId: null,
        plexUsername: null,
        plexEmail: null,
        plexThumb: null,
      });
    });

    it('returns the refreshed admin row', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await expect(
        service.unlinkPlexAccountFromAdmin('admin-1'),
      ).resolves.toEqual({ id: 'admin-1' });
    });

    it('refuses an unknown admin', async () => {
      await expect(service.unlinkPlexAccountFromAdmin('ghost')).rejects.toThrow(
        'Admin not found',
      );
      expect(adminRepo.update).not.toHaveBeenCalled();
    });
  });
});
