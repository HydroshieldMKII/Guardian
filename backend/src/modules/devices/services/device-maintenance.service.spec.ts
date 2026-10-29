import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersService } from '@/modules/users/services/users.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { DeviceMaintenanceService } from '@/modules/devices/services/device-maintenance.service';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { userDevice } from '@/modules/devices/services/user-device.fixture';
import { callArgs } from '@/test-matchers';

describe('DeviceMaintenanceService', () => {
  let service: DeviceMaintenanceService;
  let deviceRepo: Record<'find' | 'save' | 'delete', jest.Mock>;
  let historyRepo: { delete: jest.Mock };
  let usersService: { getEffectiveDefaultBlock: jest.Mock };
  let configService: { getSetting: jest.Mock };
  let devicesService: { getPendingDevices: jest.Mock };

  beforeEach(async () => {
    deviceRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((entity: UserDevice) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    historyRepo = { delete: jest.fn().mockResolvedValue({ affected: 2 }) };
    usersService = {
      getEffectiveDefaultBlock: jest.fn().mockResolvedValue(true),
    };
    configService = { getSetting: jest.fn().mockResolvedValue(false) };
    devicesService = { getPendingDevices: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        DeviceMaintenanceService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: getRepositoryToken(SessionHistory), useValue: historyRepo },
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
        { provide: DevicesService, useValue: devicesService },
      ],
    }).compile();

    service = module.get(DeviceMaintenanceService);
  });

  const savedDevice = (call = 0): UserDevice =>
    callArgs<[UserDevice]>(deviceRepo.save, call)[0];

  describe('enforceStrictModeOnPendingDevices', () => {
    it('does nothing when strict mode is off', async () => {
      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        0,
      );
      expect(devicesService.getPendingDevices).not.toHaveBeenCalled();
    });

    it('does nothing when there is nothing pending', async () => {
      configService.getSetting.mockResolvedValue(true);
      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        0,
      );
      expect(deviceRepo.save).not.toHaveBeenCalled();
    });

    it('applies the block policy to each pending device', async () => {
      configService.getSetting.mockResolvedValue(true);
      devicesService.getPendingDevices.mockResolvedValue([
        userDevice({ id: 1 }),
        userDevice({ id: 2 }),
      ]);

      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        2,
      );
      expect(savedDevice(0).status).toBe('rejected');
      expect(savedDevice(1).status).toBe('rejected');
    });

    it('approves when the user default is allow', async () => {
      configService.getSetting.mockResolvedValue(true);
      usersService.getEffectiveDefaultBlock.mockResolvedValue(false);
      devicesService.getPendingDevices.mockResolvedValue([userDevice()]);

      await service.enforceStrictModeOnPendingDevices();
      expect(savedDevice().status).toBe('approved');
    });

    it('still applies the policy to a device with no name', async () => {
      configService.getSetting.mockResolvedValue(true);
      devicesService.getPendingDevices.mockResolvedValue([
        userDevice({ deviceName: null, username: null }),
      ]);

      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        1,
      );
      expect(savedDevice().status).toBe('rejected');
    });

    it('rejects Plexamp devices like any other', async () => {
      configService.getSetting.mockResolvedValue(true);
      devicesService.getPendingDevices.mockResolvedValue([
        userDevice({ deviceProduct: 'Plexamp' }),
      ]);

      await service.enforceStrictModeOnPendingDevices();
      expect(savedDevice().status).toBe('rejected');
    });

    it('counts only the devices it managed to update', async () => {
      configService.getSetting.mockResolvedValue(true);
      devicesService.getPendingDevices.mockResolvedValue([
        userDevice({ id: 1 }),
        userDevice({ id: 2 }),
      ]);
      deviceRepo.save
        .mockRejectedValueOnce(new Error('locked'))
        .mockImplementation((entity: UserDevice) => Promise.resolve(entity));

      await expect(service.enforceStrictModeOnPendingDevices()).resolves.toBe(
        1,
      );
    });
  });

  describe('cleanupInactiveDevices', () => {
    it('reports nothing to do on an empty database', async () => {
      await expect(service.cleanupInactiveDevices(30)).resolves.toEqual({
        deletedCount: 0,
        deletedDevices: [],
      });
      expect(deviceRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes devices last seen before the cutoff', async () => {
      const stale = userDevice({
        id: 1,
        lastSeen: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      });
      const active = userDevice({ id: 2, lastSeen: new Date() });
      deviceRepo.find.mockResolvedValue([stale, active]);

      const result = await service.cleanupInactiveDevices(30);

      expect(result.deletedCount).toBe(1);
      expect(result.deletedDevices).toEqual([stale]);
      expect(deviceRepo.delete).toHaveBeenCalledWith({ id: In([1]) });
      expect(historyRepo.delete).toHaveBeenCalledWith({
        userDeviceId: In([1]),
      });
    });

    it('names a device by its identifier when it has no name', async () => {
      deviceRepo.find.mockResolvedValue([
        userDevice({
          id: 1,
          deviceName: null,
          username: null,
          lastSeen: new Date('2026-01-01T00:00:00Z'),
        }),
      ]);

      const result = await service.cleanupInactiveDevices(30);
      expect(result.deletedCount).toBe(1);
    });

    it('skips a device with no last-seen date', async () => {
      deviceRepo.find.mockResolvedValue([
        userDevice({ id: 1, lastSeen: undefined }),
      ]);

      const result = await service.cleanupInactiveDevices(30);
      expect(result.deletedCount).toBe(0);
    });

    it('keeps every device when none are stale', async () => {
      deviceRepo.find.mockResolvedValue([userDevice({ lastSeen: new Date() })]);

      const result = await service.cleanupInactiveDevices(30);
      expect(result.deletedCount).toBe(0);
      expect(deviceRepo.delete).toHaveBeenCalledWith({ id: In([]) });
    });
  });
});
