import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DevicesController } from '@/modules/devices/devices.controller';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { PlexClient } from '@/modules/plex/services/plex-client';

describe('DevicesController', () => {
  let controller: DevicesController;
  let deviceTracking: Record<string, jest.Mock>;
  let plexClient: { terminateSession: jest.Mock };

  beforeEach(async () => {
    deviceTracking = {
      getAllDevices: jest.fn().mockResolvedValue([{ id: 1 }]),
      getPendingDevices: jest.fn().mockResolvedValue([{ id: 2 }]),
      getProcessedDevices: jest.fn().mockResolvedValue([{ id: 3 }]),
      getApprovedDevices: jest.fn().mockResolvedValue([{ id: 4 }]),
      approveDevice: jest.fn().mockResolvedValue(undefined),
      deleteDevice: jest.fn().mockResolvedValue(undefined),
      rejectDevice: jest.fn().mockResolvedValue(undefined),
      setPendingDevice: jest.fn().mockResolvedValue(undefined),
      renameDevice: jest.fn().mockResolvedValue(undefined),
      grantTemporaryAccess: jest.fn().mockResolvedValue(undefined),
      revokeTemporaryAccess: jest.fn().mockResolvedValue(undefined),
      updateExcludeFromConcurrentLimit: jest.fn().mockResolvedValue(undefined),
      markNoteAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      findDeviceByUserAndIdentifier: jest.fn().mockResolvedValue({
        id: 7,
        currentSessionKey: 'session-7',
      }),
    };

    plexClient = { terminateSession: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        { provide: DeviceTrackingService, useValue: deviceTracking },
        { provide: PlexClient, useValue: plexClient },
      ],
    }).compile();

    controller = module.get(DevicesController);
  });

  describe.each([
    ['getAllDevices', 'getAllDevices'],
    ['getPendingDevices', 'getPendingDevices'],
    ['getProcessedDevices', 'getProcessedDevices'],
    ['getApprovedDevices', 'getApprovedDevices'],
  ] as const)('%s', (method, serviceMethod) => {
    it('delegates to the tracking service', async () => {
      await expect(controller[method]()).resolves.toHaveLength(1);
      expect(deviceTracking[serviceMethod]).toHaveBeenCalled();
    });
  });

  describe.each([
    ['approveDevice', 'approveDevice', 'Device 5 approved successfully'],
    ['deleteDevice', 'deleteDevice', 'Device 5 deleted successfully'],
    [
      'rejectDevice',
      'rejectDevice',
      'Device 5 rejected and deleted successfully',
    ],
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
      expect(deviceTracking[serviceMethod]).toHaveBeenCalledWith(5);
    });

    it('propagates a service failure', async () => {
      deviceTracking[serviceMethod].mockRejectedValue(new Error('nope'));
      await expect(controller[method](5)).rejects.toThrow('nope');
    });
  });

  describe('renameDevice', () => {
    it('forwards the new name', async () => {
      await expect(
        controller.renameDevice(5, { newName: 'Living Room' }),
      ).resolves.toEqual({ message: 'Device 5 renamed successfully' });
      expect(deviceTracking.renameDevice).toHaveBeenCalledWith(
        5,
        'Living Room',
      );
    });
  });

  describe('grantTemporaryAccess', () => {
    it('forwards the duration and defaults the policy bypass to false', async () => {
      const result = await controller.grantTemporaryAccess(5, {
        durationMinutes: 30,
      });

      expect(deviceTracking.grantTemporaryAccess).toHaveBeenCalledWith(
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

      expect(deviceTracking.grantTemporaryAccess).toHaveBeenCalledWith(
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

      expect(deviceTracking.grantTemporaryAccess).toHaveBeenCalledTimes(2);
      expect(result.message).toBe(
        'Temporary access: 2 devices granted, 0 failed',
      );
      expect(result.results).toEqual([
        { deviceId: 1, success: true },
        { deviceId: 2, success: true },
      ]);
    });

    it('records a per-device failure without aborting the batch', async () => {
      deviceTracking.grantTemporaryAccess
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
      deviceTracking.grantTemporaryAccess.mockRejectedValue('just a string');

      const result = await controller.grantBatchTemporaryAccess({
        deviceIds: [1],
        durationMinutes: 15,
      });

      expect(result.results[0].error).toBe('just a string');
    });

    it.each([
      ['an empty device list', { deviceIds: [], durationMinutes: 5 }],
      ['a missing duration', { deviceIds: [1], durationMinutes: 0 }],
      ['a negative duration', { deviceIds: [1], durationMinutes: -5 }],
      ['a non-integer device id', { deviceIds: [1.5], durationMinutes: 5 }],
      ['a non-positive device id', { deviceIds: [0], durationMinutes: 5 }],
    ])('rejects %s with a 400', async (_label, body) => {
      await expect(
        controller.grantBatchTemporaryAccess(body),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(deviceTracking.grantTemporaryAccess).not.toHaveBeenCalled();
    });
  });

  describe('revokeDeviceByIdentifier', () => {
    it('reports back when no such device exists', async () => {
      deviceTracking.findDeviceByUserAndIdentifier.mockResolvedValue(null);

      await expect(
        controller.revokeDeviceByIdentifier('u1', 'dev-1'),
      ).resolves.toEqual({ message: 'Device not found' });
      expect(deviceTracking.rejectDevice).not.toHaveBeenCalled();
    });

    it('revokes, rejects, then terminates the live session', async () => {
      const result = await controller.revokeDeviceByIdentifier('u1', 'dev-1');

      expect(deviceTracking.revokeTemporaryAccess).toHaveBeenCalledWith(7);
      expect(deviceTracking.rejectDevice).toHaveBeenCalledWith(7);
      expect(plexClient.terminateSession).toHaveBeenCalledWith('session-7');
      expect(result.message).toBe('Device authorization revoked successfully');
    });

    it('skips termination when the device has no live session', async () => {
      deviceTracking.findDeviceByUserAndIdentifier.mockResolvedValue({
        id: 7,
        currentSessionKey: null,
      });

      await controller.revokeDeviceByIdentifier('u1', 'dev-1');
      expect(plexClient.terminateSession).not.toHaveBeenCalled();
    });

    it('treats a 404 from Plex as an already-ended session', async () => {
      plexClient.terminateSession.mockRejectedValue(
        new Error('Request failed with status 404'),
      );

      await expect(
        controller.revokeDeviceByIdentifier('u1', 'dev-1'),
      ).resolves.toEqual({
        message: 'Device authorization revoked successfully',
      });
    });

    it('surfaces any other termination failure as a 400', async () => {
      plexClient.terminateSession.mockRejectedValue(
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
