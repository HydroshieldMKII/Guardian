import { Test } from '@nestjs/testing';
import { UsersController } from '@/modules/users/users.controller';
import { UsersService } from '@/modules/users/services/users.service';
import { ConcurrentStreamService } from '@/modules/users/services/concurrent-stream.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Record<string, jest.Mock>;
  let concurrentStreamService: { getEffectiveLimit: jest.Mock };

  const preference = { userId: 'u1', hidden: false, concurrentStreamLimit: 3 };

  beforeEach(async () => {
    usersService = {
      getAllUsers: jest.fn().mockResolvedValue([{ id: 'u1' }]),
      getHiddenUsers: jest.fn().mockResolvedValue([preference]),
      getUserPreference: jest.fn().mockResolvedValue(preference),
      updateUserPreference: jest.fn().mockResolvedValue(preference),
      hideUser: jest.fn().mockResolvedValue({ ...preference, hidden: true }),
      showUser: jest.fn().mockResolvedValue(preference),
      toggleUserVisibility: jest.fn().mockResolvedValue(preference),
      updateUserIPPolicy: jest.fn().mockResolvedValue(preference),
      updateConcurrentStreamLimit: jest.fn().mockResolvedValue(preference),
    };

    concurrentStreamService = {
      getEffectiveLimit: jest.fn().mockResolvedValue(3),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        {
          provide: ConcurrentStreamService,
          useValue: concurrentStreamService,
        },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  it('lists users', async () => {
    await expect(controller.getAllUsers()).resolves.toHaveLength(1);
  });

  it('lists hidden users', async () => {
    await expect(controller.getHiddenUsers()).resolves.toEqual([preference]);
  });

  it('reads a single preference', async () => {
    await expect(controller.getUserPreference('u1')).resolves.toBe(preference);
    expect(usersService.getUserPreference).toHaveBeenCalledWith('u1');
  });

  it('updates the default block flag', async () => {
    const result = await controller.updateUserPreference('u1', {
      defaultBlock: true,
    });

    expect(usersService.updateUserPreference).toHaveBeenCalledWith('u1', true);
    expect(result.message).toBe('User preference updated successfully');
  });

  it('hides a user', async () => {
    const result = await controller.hideUser('u1');
    expect(result.message).toBe('User hidden successfully');
    expect(usersService.hideUser).toHaveBeenCalledWith('u1');
  });

  it('shows a user', async () => {
    const result = await controller.showUser('u1');
    expect(result.message).toBe('User shown successfully');
  });

  it('reports the resulting state when toggling visibility to hidden', async () => {
    usersService.toggleUserVisibility.mockResolvedValue({
      ...preference,
      hidden: true,
    });

    const result = await controller.toggleUserVisibility('u1');
    expect(result.message).toBe('User hidden successfully');
  });

  it('reports the resulting state when toggling visibility to shown', async () => {
    const result = await controller.toggleUserVisibility('u1');
    expect(result.message).toBe('User shown successfully');
  });

  it('forwards the whole IP policy payload', async () => {
    const dto = {
      networkPolicy: 'lan' as const,
      ipAccessPolicy: 'restricted' as const,
      allowedIPs: ['10.0.0.0/8'],
    };

    await controller.updateUserIPPolicy('u1', dto);
    expect(usersService.updateUserIPPolicy).toHaveBeenCalledWith('u1', dto);
  });

  it('updates the concurrent stream limit', async () => {
    const result = await controller.updateConcurrentStreamLimit('u1', {
      concurrentStreamLimit: 5,
    });

    expect(usersService.updateConcurrentStreamLimit).toHaveBeenCalledWith(
      'u1',
      5,
    );
    expect(result.message).toBe(
      'User concurrent stream limit updated successfully',
    );
  });

  describe('getConcurrentStreamInfo', () => {
    it('reports an overridden limit', async () => {
      await expect(controller.getConcurrentStreamInfo('u1')).resolves.toEqual({
        limit: 3,
        effectiveLimit: 3,
        isUnlimited: false,
        isOverridden: true,
      });
    });

    it('reports an inherited limit when the user has no override', async () => {
      usersService.getUserPreference.mockResolvedValue({
        ...preference,
        concurrentStreamLimit: null,
      });

      const result = await controller.getConcurrentStreamInfo('u1');
      expect(result.limit).toBeNull();
      expect(result.isOverridden).toBe(false);
    });

    it('treats a zero effective limit as unlimited', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(0);
      const result = await controller.getConcurrentStreamInfo('u1');
      expect(result.isUnlimited).toBe(true);
    });

    it('falls back to null when the user has no preference row', async () => {
      usersService.getUserPreference.mockResolvedValue(null);
      const result = await controller.getConcurrentStreamInfo('u1');
      expect(result.limit).toBeNull();
      expect(result.isOverridden).toBe(false);
    });
  });
});
