import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../../../entities/user-preference.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';
import { PlexClient } from '../../plex/services/plex-client';
import { UsersService } from './users.service';

const preference = (overrides: Partial<UserPreference> = {}): UserPreference =>
  Object.assign(new UserPreference(), {
    id: 1,
    userId: 'u1',
    username: 'alice',
    hidden: false,
    defaultBlock: null,
    ...overrides,
  });

describe('UsersService', () => {
  let service: UsersService;
  let preferenceRepository: jest.Mocked<Repository<UserPreference>>;
  let deviceRepository: jest.Mocked<Repository<UserDevice>>;
  let configService: { getSetting: jest.Mock };
  let plexClient: { getPlexUsers: jest.Mock };

  beforeEach(async () => {
    preferenceRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: Partial<UserPreference>) => preference(value)),
      save: jest.fn((value: UserPreference) => Promise.resolve(value)),
      upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
    } as unknown as jest.Mocked<Repository<UserPreference>>;

    deviceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<UserDevice>>;

    configService = { getSetting: jest.fn().mockResolvedValue(true) };
    plexClient = { getPlexUsers: jest.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: deviceRepository,
        },
        { provide: ConfigService, useValue: configService },
        { provide: PlexClient, useValue: plexClient },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getAllUsers', () => {
    it('excludes hidden users by default', async () => {
      await service.getAllUsers();
      expect(preferenceRepository.find).toHaveBeenCalledWith({
        where: { hidden: false },
      });
    });

    it('includes hidden users when asked', async () => {
      await service.getAllUsers(true);
      expect(preferenceRepository.find).toHaveBeenCalledWith();
    });
  });

  describe('getHiddenUsers', () => {
    it('queries only hidden users', async () => {
      await service.getHiddenUsers();
      expect(preferenceRepository.find).toHaveBeenCalledWith({
        where: { hidden: true },
      });
    });
  });

  describe('visibility', () => {
    it('hides a user', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ hidden: false }),
      );
      const result = await service.hideUser('u1');
      expect(result.hidden).toBe(true);
    });

    it('shows a user', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ hidden: true }),
      );
      const result = await service.showUser('u1');
      expect(result.hidden).toBe(false);
    });

    it('toggles a visible user to hidden', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ hidden: false }),
      );
      const result = await service.toggleUserVisibility('u1');
      expect(result.hidden).toBe(true);
    });

    it('toggles a hidden user to visible', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ hidden: true }),
      );
      const result = await service.toggleUserVisibility('u1');
      expect(result.hidden).toBe(false);
    });

    it('throws when the user is unknown', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      await expect(service.hideUser('nope')).rejects.toThrow('User not found');
    });
  });

  describe('updateUserFromSessionData', () => {
    it('ignores a missing user id', async () => {
      await service.updateUserFromSessionData('');
      expect(preferenceRepository.findOne).not.toHaveBeenCalled();
    });

    it('creates a preference for an unknown user', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);

      await service.updateUserFromSessionData('u1', 'alice');

      expect(preferenceRepository.create).toHaveBeenCalledWith({
        userId: 'u1',
        username: 'alice',
        defaultBlock: null,
      });
      expect(preferenceRepository.save).toHaveBeenCalled();
    });

    it('leaves an existing preference alone', async () => {
      preferenceRepository.findOne.mockResolvedValue(preference());

      await service.updateUserFromSessionData('u1', 'alice');

      expect(preferenceRepository.save).not.toHaveBeenCalled();
    });

    it('swallows a repository failure', async () => {
      preferenceRepository.findOne.mockRejectedValue(new Error('db down'));
      await expect(
        service.updateUserFromSessionData('u1', 'alice'),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateUserPreference', () => {
    it('updates an existing preference', async () => {
      preferenceRepository.findOne.mockResolvedValue(preference());

      const result = await service.updateUserPreference('u1', true);

      expect(result.defaultBlock).toBe(true);
    });

    it('creates a preference when none exists', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      deviceRepository.findOne.mockResolvedValue(
        Object.assign(new UserDevice(), { username: 'bob' }),
      );

      const result = await service.updateUserPreference('u2', false);

      expect(preferenceRepository.create).toHaveBeenCalledWith({
        userId: 'u2',
        username: 'bob',
        defaultBlock: false,
      });
      expect(result.defaultBlock).toBe(false);
    });

    it('tolerates having no device to source a username from', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      deviceRepository.findOne.mockResolvedValue(null);

      await service.updateUserPreference('u2', null);

      expect(preferenceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: undefined }),
      );
    });
  });

  describe('updateUserIPPolicy', () => {
    it('applies each supplied field', async () => {
      preferenceRepository.findOne.mockResolvedValue(preference());

      const result = await service.updateUserIPPolicy('u1', {
        networkPolicy: 'lan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['10.0.0.0/8'],
      });

      expect(result.networkPolicy).toBe('lan');
      expect(result.ipAccessPolicy).toBe('restricted');
      expect(result.allowedIPs).toEqual(['10.0.0.0/8']);
    });

    it('leaves omitted fields untouched', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ networkPolicy: 'wan' }),
      );

      const result = await service.updateUserIPPolicy('u1', {
        ipAccessPolicy: 'all',
      });

      expect(result.networkPolicy).toBe('wan');
    });

    it('throws when the user has no preference row', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      await expect(service.updateUserIPPolicy('u1', {})).rejects.toThrow(
        'User preference not found',
      );
    });
  });

  describe('updateConcurrentStreamLimit', () => {
    it('sets a numeric limit', async () => {
      preferenceRepository.findOne.mockResolvedValue(preference());
      const result = await service.updateConcurrentStreamLimit('u1', 3);
      expect(result.concurrentStreamLimit).toBe(3);
    });

    it('sets zero for unlimited', async () => {
      preferenceRepository.findOne.mockResolvedValue(preference());
      const result = await service.updateConcurrentStreamLimit('u1', 0);
      expect(result.concurrentStreamLimit).toBe(0);
    });

    it('sets null to fall back to the global default', async () => {
      preferenceRepository.findOne.mockResolvedValue(preference());
      const result = await service.updateConcurrentStreamLimit('u1', null);
      expect(result.concurrentStreamLimit).toBeNull();
    });

    it('throws when the user has no preference row', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateConcurrentStreamLimit('u1', 3),
      ).rejects.toThrow('User preference not found');
    });
  });

  describe('getEffectiveDefaultBlock', () => {
    it('prefers an explicit user preference', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ defaultBlock: false }),
      );
      configService.getSetting.mockResolvedValue(true);

      await expect(service.getEffectiveDefaultBlock('u1')).resolves.toBe(false);
    });

    it('falls back to the global setting when the preference is null', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ defaultBlock: null }),
      );
      configService.getSetting.mockResolvedValue(true);

      await expect(service.getEffectiveDefaultBlock('u1')).resolves.toBe(true);
    });

    it('falls back to the global setting when there is no preference', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      configService.getSetting.mockResolvedValue(false);

      await expect(service.getEffectiveDefaultBlock('u1')).resolves.toBe(false);
    });
  });

  describe('syncUsersFromPlexTV', () => {
    const xml = `<MediaContainer>
      <User id="1" username="alice" thumb="a.png"/>
      <User id="2" title="bob" thumb="b.png"/>
    </MediaContainer>`;

    it('reports an error when Plex returns nothing', async () => {
      plexClient.getPlexUsers.mockResolvedValue(null);
      await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
        updated: 0,
        created: 0,
        errors: 1,
      });
    });

    it('creates users parsed from an XML response', async () => {
      plexClient.getPlexUsers.mockResolvedValue(xml);

      const result = await service.syncUsersFromPlexTV();

      expect(result.created).toBe(2);
      expect(preferenceRepository.upsert).toHaveBeenCalledTimes(2);
    });

    it('falls back to the title attribute for a username', async () => {
      plexClient.getPlexUsers.mockResolvedValue(
        '<User id="2" title="bob" thumb="b.png"/>',
      );

      await service.syncUsersFromPlexTV();

      expect(preferenceRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'bob' }),
        expect.anything(),
      );
    });

    it('reports an error when the XML holds no users', async () => {
      plexClient.getPlexUsers.mockResolvedValue('<MediaContainer/>');
      await expect(service.syncUsersFromPlexTV()).resolves.toEqual({
        updated: 0,
        created: 0,
        errors: 1,
      });
    });

    it('accepts an object response with a users array', async () => {
      plexClient.getPlexUsers.mockResolvedValue({
        users: [{ id: '1', username: 'alice' }],
      });

      const result = await service.syncUsersFromPlexTV();
      expect(result.created).toBe(1);
    });

    it('accepts an object response with a single user', async () => {
      plexClient.getPlexUsers.mockResolvedValue({
        users: { id: '1', username: 'alice' },
      });

      const result = await service.syncUsersFromPlexTV();
      expect(result.created).toBe(1);
    });

    it('counts a changed username as an update', async () => {
      plexClient.getPlexUsers.mockResolvedValue(
        '<User id="1" username="alice-new" thumb="a.png"/>',
      );
      preferenceRepository.findOne.mockResolvedValue(
        preference({ username: 'alice', avatarUrl: 'a.png' }),
      );

      const result = await service.syncUsersFromPlexTV();

      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('does not count an unchanged user as an update', async () => {
      plexClient.getPlexUsers.mockResolvedValue(
        '<User id="1" username="alice" thumb="a.png"/>',
      );
      preferenceRepository.findOne.mockResolvedValue(
        preference({ username: 'alice', avatarUrl: 'a.png' }),
      );

      const result = await service.syncUsersFromPlexTV();

      expect(result.updated).toBe(0);
    });

    it('counts a failing upsert as an error', async () => {
      plexClient.getPlexUsers.mockResolvedValue(
        '<User id="1" username="alice"/>',
      );
      preferenceRepository.upsert.mockRejectedValue(new Error('db down'));

      const result = await service.syncUsersFromPlexTV();

      expect(result.errors).toBe(1);
    });

    it('reports an error when the Plex call throws', async () => {
      plexClient.getPlexUsers.mockRejectedValue(new Error('offline'));

      const result = await service.syncUsersFromPlexTV();

      expect(result.errors).toBe(1);
    });
  });
});
