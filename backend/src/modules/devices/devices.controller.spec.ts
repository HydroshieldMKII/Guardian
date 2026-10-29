import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DevicesController } from '@/modules/devices/devices.controller';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { SessionTerminationService } from '@/modules/plex/services/session-termination.service';
import type { Mock } from 'vitest';

describe('DevicesController', () => {
  let controller: DevicesController;
  let devices: Record<string, Mock>;
  let temporaryAccess: Record<string, Mock>;
  let sessionTermination: { terminateDeviceSessions: Mock };

  beforeEach(async () => {
    devices = {
      getAllDevices: vi.fn().mockResolvedValue([{ id: 1 }]),
      getPendingDevices: vi.fn().mockResolvedValue([{ id: 2 }]),
      getProcessedDevices: vi.fn().mockResolvedValue([{ id: 3 }]),
      getApprovedDevices: vi.fn().mockResolvedValue([{ id: 4 }]),
      approveDevice: vi.fn().mockResolvedValue(undefined),
      deleteDevice: vi.fn().mockResolvedValue(undefined),
      rejectDevice: vi.fn().mockResolvedValue(undefined),
      setPendingDevice: vi.fn().mockResolvedValue(undefined),
      renameDevice: vi.fn().mockResolvedValue(undefined),
      updateExcludeFromConcurrentLimit: vi.fn().mockResolvedValue(undefined),
      markNoteAsRead: vi.fn().mockResolvedValue(undefined),
      deleteNote: vi.fn().mockResolvedValue(undefined),
      findDeviceByUserAndIdentifier: vi.fn().mockResolvedValue({
        id: 7,
        currentSessionKey: 'session-7',
      }),
    };

    temporaryAccess = {
      grantTemporaryAccess: vi.fn().mockResolvedValue(undefined),
      revokeTemporaryAccess: vi.fn().mockResolvedValue(undefined),
    };

    sessionTermination = {
      terminateDeviceSessions: vi.fn().mockResolvedValue(1),
    };

    const module = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        { provide: DevicesService, useValue: devices },
        { provide: TemporaryAccessService, useValue: temporaryAccess },
        { provide: SessionTerminationService, useValue: sessionTermination },
      ],
    }).compile();

    controller = module.get(DevicesController);
  });

  const serviceMock = (method: string): Mock =>
    temporaryAccess[method] ?? devices[method];

  describe.each([
    ['getAllDevices', 'getAllDevices'],
    ['getPendingDevices', 'getPendingDevices'],
    ['getProcessedDevices', 'getProcessedDevices'],
    ['getApprovedDevices', 'getApprovedDevices'],
  ] as const)('%s', (method, serviceMethod) => {
    it('delegates to the devices service', async () => {
      await expect(controller[method]()).resolves.toHaveLength(1);
      expect(serviceMock(serviceMethod)).toHaveBeenCalled();
    });
  });

  describe.each([
    ['approveDevice', 'approveDevice', 'Device 5 approved successfully'],
    ['deleteDevice', 'deleteDevice', 'Device 5 deleted successfully'],
    ['rejectDevice', 'rejectDevice', 'Device 5 rejected successfully'],
    [
      'setPendingDevice',
      'setPendingDevice',
      'Device 5 set to pending successfully',
    ],
    [
      'revokeTemporaryAccess',
      'revokeTemporaryAccess',
      'Temporary access revoked for device 5',
    ],
    ['markNoteAsRead', 'markNoteAsRead', 'Note marked as read for device 5'],
    ['deleteNote', 'deleteNote', 'Note deleted for device 5'],
  ] as const)('%s', (method, serviceMethod, message) => {
    it('acts on the device and reports back', async () => {
      await expect(controller[method](5)).resolves.toEqual({ message });
      expect(serviceMock(serviceMethod)).toHaveBeenCalledWith(5);
    });

    it('propagates a service failure', async () => {
      serviceMock(serviceMethod).mockRejectedValue(new Error('nope'));
      await expect(controller[method](5)).rejects.toThrow('nope');
    });
  });

  describe('renameDevice', () => {
    it('forwards the new name', async () => {
      await expect(
        controller.renameDevice(5, { newName: 'Living Room' }),
      ).resolves.toEqual({ message: 'Device 5 renamed successfully' });
      expect(devices.renameDevice).toHaveBeenCalledWith(5, 'Living Room');
    });
  });

  describe('grantTemporaryAccess', () => {
    it('forwards the duration and defaults the policy bypass to false', async () => {
      const result = await controller.grantTemporaryAccess(5, {
        durationMinutes: 30,
      });

      expect(temporaryAccess.grantTemporaryAccess).toHaveBeenCalledWith(
        5,
        30,
        false,
      );
      expect(result.message).toContain('30 minutes');
    });

    it('honours an explicit policy bypass', async () => {
      await controller.grantTemporaryAccess(5, {
        durationMinutes: 10,
        bypassPolicies: true,
      });

      expect(temporaryAccess.grantTemporaryAccess).toHaveBeenCalledWith(
        5,
        10,
        true,
      );
    });
  });

  describe('updateExcludeFromConcurrentLimit', () => {
    it('reports an exclusion', async () => {
      const result = await controller.updateExcludeFromConcurrentLimit(5, {
        exclude: true,
      });
      expect(result.message).toBe(
        'Device 5 excluded from concurrent stream limit',
      );
    });

    it('reports an inclusion', async () => {
      const result = await controller.updateExcludeFromConcurrentLimit(5, {
        exclude: false,
      });
      expect(result.message).toBe(
        'Device 5 included in concurrent stream limit',
      );
    });
  });

  describe('grantBatchTemporaryAccess', () => {
    it('grants access to every device and summarises the outcome', async () => {
      const result = await controller.grantBatchTemporaryAccess({
        deviceIds: [1, 2],
        durationMinutes: 15,
      });

      expect(temporaryAccess.grantTemporaryAccess).toHaveBeenCalledTimes(2);
      expect(result.message).toBe(
        'Temporary access: 2 devices granted, 0 failed',
      );
      expect(result.results).toEqual([
        { deviceId: 1, success: true },
        { deviceId: 2, success: true },
      ]);
    });

    it('records a per-device failure without aborting the batch', async () => {
      temporaryAccess.grantTemporaryAccess
        .mockRejectedValueOnce(new Error('locked'))
        .mockResolvedValueOnce(undefined);

      const result = await controller.grantBatchTemporaryAccess({
        deviceIds: [1, 2],
        durationMinutes: 15,
      });

      expect(result.message).toBe(
        'Temporary access: 1 devices granted, 1 failed',
      );
      expect(result.results[0]).toEqual({
        deviceId: 1,
        success: false,
        error: 'locked',
      });
    });

    it('reports a non-Error rejection verbatim', async () => {
      temporaryAccess.grantTemporaryAccess.mockRejectedValue('just a string');

      const result = await controller.grantBatchTemporaryAccess({
        deviceIds: [1],
        durationMinutes: 15,
      });

      expect(result.results[0].error).toBe('just a string');
    });
  });

  describe('revokeDeviceByIdentifier', () => {
    it('answers 404 when no such device exists', async () => {
      devices.findDeviceByUserAndIdentifier.mockResolvedValue(null);

      await expect(
        controller.revokeDeviceByIdentifier('u1', 'dev-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(devices.rejectDevice).not.toHaveBeenCalled();
    });

    it('revokes, rejects, then terminates the live session', async () => {
      const result = await controller.revokeDeviceByIdentifier('u1', 'dev-1');

      expect(temporaryAccess.revokeTemporaryAccess).toHaveBeenCalledWith(7);
      expect(devices.rejectDevice).toHaveBeenCalledWith(7);
      expect(sessionTermination.terminateDeviceSessions).toHaveBeenCalledWith(
        'u1',
        'dev-1',
      );
      expect(result.message).toBe('Device authorization revoked successfully');
    });

    it('skips termination when the device has no live session', async () => {
      devices.findDeviceByUserAndIdentifier.mockResolvedValue({
        id: 7,
        currentSessionKey: null,
      });

      await controller.revokeDeviceByIdentifier('u1', 'dev-1');
      expect(sessionTermination.terminateDeviceSessions).not.toHaveBeenCalled();
    });

    it('treats a 404 from Plex as an already-ended session', async () => {
      sessionTermination.terminateDeviceSessions.mockRejectedValue(
        new Error('Request failed with status 404'),
      );

      await expect(
        controller.revokeDeviceByIdentifier('u1', 'dev-1'),
      ).resolves.toEqual({
        message: 'Device authorization revoked successfully',
      });
    });

    it('surfaces any other termination failure as a 400', async () => {
      sessionTermination.terminateDeviceSessions.mockRejectedValue(
        new Error('502 bad gateway'),
      );

      await expect(
        controller.revokeDeviceByIdentifier('u1', 'dev-1'),
      ).rejects.toBeInstanceOf(HttpException);
      await expect(
        controller.revokeDeviceByIdentifier('u1', 'dev-1'),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });
});
