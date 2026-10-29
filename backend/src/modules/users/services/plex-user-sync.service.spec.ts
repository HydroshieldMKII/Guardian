import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserPreference } from '@/entities/user-preference.entity';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { PlexUserSyncService } from '@/modules/users/services/plex-user-sync.service';
import type { Mock } from 'vitest';

const preference = (overrides: Partial<UserPreference> = {}): UserPreference =>
  Object.assign(new UserPreference(), {
    id: 1,
    userId: '1',
    username: 'alice',
    avatarUrl: 'a.png',
    ...overrides,
  });

describe('PlexUserSyncService', () => {
  let service: PlexUserSyncService;
  let preferenceRepository: { findOne: Mock; upsert: Mock };
  let plexClient: { getPlexUsers: Mock };

  beforeEach(async () => {
    preferenceRepository = {
      findOne: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ identifiers: [] }),
    };
    plexClient = { getPlexUsers: vi.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        PlexUserSyncService,
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepository,
        },
        { provide: PlexClient, useValue: plexClient },
      ],
    }).compile();

    service = module.get(PlexUserSyncService);
  });

  it('reports an error when Plex returns nothing', async () => {
    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 0,
      errors: 1,
    });
  });

  it('reports an error when the response holds no users', async () => {
    plexClient.getPlexUsers.mockResolvedValue('<MediaContainer/>');
    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 0,
      errors: 1,
    });
  });

  it('reports an error when the Plex call throws', async () => {
    plexClient.getPlexUsers.mockRejectedValue(new Error('offline'));
    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 0,
      errors: 1,
    });
  });

  it('creates unknown users without a block preference', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User id="1" username="alice" thumb="a.png"/><User id="2" title="bob"/>',
    );

    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 2,
      errors: 0,
    });
    expect(preferenceRepository.upsert).toHaveBeenCalledWith(
      {
        userId: '1',
        username: 'alice',
        avatarUrl: 'a.png',
        defaultBlock: null,
      },
      { conflictPaths: ['userId'], skipUpdateIfNoValuesChanged: true },
    );
  });

  it('keeps the existing row and its block preference for a known user', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User id="1" username="alice" thumb="a.png"/>',
    );
    preferenceRepository.findOne.mockResolvedValue(preference({ id: 9 }));

    await service.syncUsersFromPlexTV();

    expect(preferenceRepository.upsert).toHaveBeenCalledWith(
      { userId: '1', username: 'alice', avatarUrl: 'a.png', id: 9 },
      expect.anything(),
    );
  });

  it('counts a changed username as an update', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User id="1" username="alice-new" thumb="a.png"/>',
    );
    preferenceRepository.findOne.mockResolvedValue(preference());

    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 1,
      created: 0,
      errors: 0,
    });
  });

  it('counts a changed avatar as an update', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User id="1" username="alice" thumb="new.png"/>',
    );
    preferenceRepository.findOne.mockResolvedValue(preference());

    await expect(service.syncUsersFromPlexTV()).resolves.toMatchObject({
      updated: 1,
    });
  });

  it('does not count an unchanged user', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User id="1" username="alice" thumb="a.png"/>',
    );
    preferenceRepository.findOne.mockResolvedValue(preference());

    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 0,
      errors: 0,
    });
  });

  it('does not count a user whose response omits the name and avatar', async () => {
    plexClient.getPlexUsers.mockResolvedValue('<User id="1"/>');
    preferenceRepository.findOne.mockResolvedValue(preference());

    await expect(service.syncUsersFromPlexTV()).resolves.toMatchObject({
      updated: 0,
    });
  });

  it('counts a user without an id as an error and keeps going', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User username="ghost"/><User id="2" username="bob"/>',
    );

    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 1,
      errors: 1,
    });
    expect(preferenceRepository.upsert).toHaveBeenCalledTimes(1);
  });

  it('counts a failing upsert as an error and keeps going', async () => {
    plexClient.getPlexUsers.mockResolvedValue(
      '<User id="1" username="alice"/><User id="2" username="bob"/>',
    );
    preferenceRepository.upsert.mockRejectedValueOnce(new Error('db down'));

    await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
      updated: 0,
      created: 1,
      errors: 1,
    });
  });
});
