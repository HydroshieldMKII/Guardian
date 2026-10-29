import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { anyDate } from '@/test-matchers';
import type { Mock } from 'vitest';

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceRepo: {
    find: Mock;
    findOne: Mock;
    update: Mock;
    manager: { transaction: Mock };
  };
  let temporaryAccess: { revokeTemporaryAccess: Mock };
  let transactionRepos: {
    history: { delete: Mock };
    devices: { delete: Mock };
  };

  beforeEach(async () => {
    transactionRepos = {
      history: { delete: vi.fn().mockResolvedValue({ affected: 3 }) },
      devices: { delete: vi.fn().mockResolvedValue({ affected: 1 }) },
    };
    deviceRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        transaction: vi.fn(async (run: (manager: unknown) => Promise<void>) =>
          run({
            getRepository: (entity: unknown) =>
              entity === SessionHistory
                ? transactionRepos.history
                : transactionRepos.devices,
          }),
        ),
      },
    };
    temporaryAccess = {
      revokeTemporaryAccess: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: TemporaryAccessService, useValue: temporaryAccess },
      ],
    }).compile();

    service = module.get(DevicesService);
  });

  describe('queries', () => {
    it('lists all devices newest-seen first', async () => {
      await service.getAllDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        order: { lastSeen: 'DESC' },
      });
    });

    it('lists pending devices newest-first', async () => {
      await service.getPendingDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        order: { firstSeen: 'DESC' },
      });
    });

    it('treats both approved and rejected devices as processed', async () => {
      await service.getProcessedDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: [{ status: 'approved' }, { status: 'rejected' }],
        order: { lastSeen: 'DESC' },
      });
    });

    it('lists approved devices', async () => {
      await service.getApprovedDevices();
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: { status: 'approved' },
        order: { lastSeen: 'DESC' },
      });
    });

    it('finds a device by user and identifier', async () => {
      await service.findDeviceByUserAndIdentifier('u1', 'dev-1');
      expect(deviceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: 'dev-1' },
      });
    });

    it('finds a device by identifier alone', async () => {
      await service.findDeviceByIdentifier('dev-1');
      expect(deviceRepo.findOne).toHaveBeenCalledWith({
        where: { deviceIdentifier: 'dev-1' },
      });
    });
  });

  describe('status changes', () => {
    it('approves a device and drops any temporary access', async () => {
      await service.approveDevice(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, { status: 'approved' });
      expect(temporaryAccess.revokeTemporaryAccess).toHaveBeenCalledWith(7);
    });

    it('rejects a device without touching temporary access', async () => {
      await service.rejectDevice(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, { status: 'rejected' });
      expect(temporaryAccess.revokeTemporaryAccess).not.toHaveBeenCalled();
    });

    it('sends a device back to pending and drops temporary access', async () => {
      await service.setPendingDevice(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, { status: 'pending' });
      expect(temporaryAccess.revokeTemporaryAccess).toHaveBeenCalledWith(7);
    });

    it('renames a device', async () => {
      await service.renameDevice(7, 'Attic TV');
      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        deviceName: 'Attic TV',
      });
    });

    it('excludes a device from the concurrent limit', async () => {
      await service.updateExcludeFromConcurrentLimit(7, true);
      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        excludeFromConcurrentLimit: true,
      });
    });

    it('includes a device back in the concurrent limit', async () => {
      await service.updateExcludeFromConcurrentLimit(7, false);
      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        excludeFromConcurrentLimit: false,
      });
    });

    it('marks a request note as read', async () => {
      await service.markNoteAsRead(7);
      expect(deviceRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ requestNoteReadAt: anyDate() }),
      );
    });

    it('clears every note column when deleting a note', async () => {
      await service.deleteNote(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, {
        requestDescription: null,
        requestSubmittedAt: null,
        requestNoteReadAt: null,
      });
    });
  });

  describe('missing devices', () => {
    beforeEach(() => {
      deviceRepo.update.mockResolvedValue({ affected: 0 });
    });

    it.each([
      ['approveDevice', (id: number) => service.approveDevice(id)],
      ['rejectDevice', (id: number) => service.rejectDevice(id)],
      ['setPendingDevice', (id: number) => service.setPendingDevice(id)],
      ['renameDevice', (id: number) => service.renameDevice(id, 'Name')],
      [
        'updateExcludeFromConcurrentLimit',
        (id: number) => service.updateExcludeFromConcurrentLimit(id, true),
      ],
      ['markNoteAsRead', (id: number) => service.markNoteAsRead(id)],
      ['deleteNote', (id: number) => service.deleteNote(id)],
    ])('%s answers 404 for an unknown id', async (_name, act) => {
      await expect(act(999999)).rejects.toBeInstanceOf(NotFoundException);
      expect(temporaryAccess.revokeTemporaryAccess).not.toHaveBeenCalled();
    });

    it('deleteDevice answers 404 for an unknown id', async () => {
      transactionRepos.devices.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteDevice(999999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteDevice', () => {
    it('removes the session history and the device in one transaction', async () => {
      await service.deleteDevice(7);

      expect(transactionRepos.history.delete).toHaveBeenCalledWith({
        userDeviceId: 7,
      });
      expect(transactionRepos.devices.delete).toHaveBeenCalledWith(7);
    });

    it('reports a transaction failure with context', async () => {
      transactionRepos.devices.delete.mockRejectedValue(
        new Error('foreign key'),
      );

      await expect(service.deleteDevice(7)).rejects.toThrow(
        'Device deletion failed: foreign key',
      );
    });
  });
});
