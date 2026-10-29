import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserPreference } from '@/entities/user-preference.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { UsersService } from '@/modules/users/services/users.service';

type IpPolicyField = 'networkPolicy' | 'ipAccessPolicy' | 'allowedIPs';

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
  let preferenceRepository: Record<
    'find' | 'findOne' | 'create' | 'save',
    jest.Mock
  >;
  let deviceRepository: { findOne: jest.Mock };
  let configService: { getSetting: jest.Mock };

  beforeEach(async () => {
    preferenceRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: Partial<UserPreference>) => preference(value)),
      save: jest.fn((value: UserPreference) => Promise.resolve(value)),
    };

    deviceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    configService = { getSetting: jest.fn().mockResolvedValue(true) };

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

    it('rejects a user with neither a preference nor a device', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      deviceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserPreference('u2', null),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(preferenceRepository.save).not.toHaveBeenCalled();
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

    it.each<[IpPolicyField, Parameters<UsersService['updateUserIPPolicy']>[1]]>(
      [
        ['networkPolicy', { ipAccessPolicy: 'all', allowedIPs: [] }],
        ['ipAccessPolicy', { networkPolicy: 'lan', allowedIPs: ['5.6.7.8'] }],
        ['allowedIPs', { networkPolicy: 'lan', ipAccessPolicy: 'all' }],
      ],
    )('leaves %s alone when the update omits it', async (field, updates) => {
      const stored = preference({
        networkPolicy: 'wan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['1.2.3.4'],
      });
      preferenceRepository.findOne.mockResolvedValue(stored);

      const result = await service.updateUserIPPolicy('u1', updates);
      const before: Pick<UserPreference, IpPolicyField> = {
        networkPolicy: 'wan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['1.2.3.4'],
      };

      expect(result[field]).toEqual(before[field]);
    });

    it('throws when the user has no preference row', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      await expect(service.updateUserIPPolicy('u1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each<[string, Parameters<UsersService['updateUserIPPolicy']>[1]]>([
      ['an empty list', { ipAccessPolicy: 'restricted', allowedIPs: [] }],
      ['no list', { ipAccessPolicy: 'restricted' }],
    ])('rejects restricted access with %s', async (_label, updates) => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ ipAccessPolicy: 'all', allowedIPs: [] }),
      );
      await expect(
        service.updateUserIPPolicy('u1', updates),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(preferenceRepository.save).not.toHaveBeenCalled();
    });

    it('rejects emptying the list of a restricted user', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ ipAccessPolicy: 'restricted', allowedIPs: ['1.2.3.4'] }),
      );
      await expect(
        service.updateUserIPPolicy('u1', { allowedIPs: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still lets an unrelated change through for legacy restricted-empty data', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ ipAccessPolicy: 'restricted', allowedIPs: [] }),
      );
      const result = await service.updateUserIPPolicy('u1', {
        networkPolicy: 'lan',
      });
      expect(result.networkPolicy).toBe('lan');
    });

    it('allows clearing the list when switching back to all', async () => {
      preferenceRepository.findOne.mockResolvedValue(
        preference({ ipAccessPolicy: 'restricted', allowedIPs: ['1.2.3.4'] }),
      );
      const result = await service.updateUserIPPolicy('u1', {
        ipAccessPolicy: 'all',
        allowedIPs: [],
      });
      expect(result.allowedIPs).toEqual([]);
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

    it('blocks nothing when the global setting was never written', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      configService.getSetting.mockResolvedValue(null);

      await expect(service.getEffectiveDefaultBlock('u1')).resolves.toBe(false);
    });
  });
});
