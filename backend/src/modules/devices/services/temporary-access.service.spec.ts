import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { userDevice } from '@/modules/devices/services/user-device.fixture';
import { callArgs, containing } from '@/test-matchers';
import type { Mock } from 'vitest';

interface TemporaryAccessPatch {
  temporaryAccessDurationMinutes: number;
  temporaryAccessBypassPolicies: boolean;
  temporaryAccessUntil: Date;
}

describe('TemporaryAccessService', () => {
  let service: TemporaryAccessService;
  let deviceRepo: { update: Mock };
  let configService: { getTimezone: Mock };

  const revokedAccess = {
    temporaryAccessUntil: null,
    temporaryAccessGrantedAt: null,
    temporaryAccessDurationMinutes: null,
    temporaryAccessBypassPolicies: false,
  };

  beforeEach(async () => {
    deviceRepo = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
    configService = { getTimezone: vi.fn().mockResolvedValue('+00:00') };

    const module = await Test.createTestingModule({
      providers: [
        TemporaryAccessService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TemporaryAccessService);
  });

  describe('temporary access', () => {
    it('stores the expiry, duration and bypass flag', async () => {
      const before = Date.now();
      await service.grantTemporaryAccess(7, 30, true);

      const [id, patch] = callArgs<[number, TemporaryAccessPatch]>(
        deviceRepo.update,
      );
      expect(id).toBe(7);
      expect(patch.temporaryAccessDurationMinutes).toBe(30);
      expect(patch.temporaryAccessBypassPolicies).toBe(true);
      expect(patch.temporaryAccessUntil.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60 * 1000,
      );
    });

    it('answers 404 and logs nothing for an unknown device', async () => {
      deviceRepo.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.grantTemporaryAccess(999999, 30),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(configService.getTimezone).not.toHaveBeenCalled();
    });

    it('defaults to not bypassing policies', async () => {
      await service.grantTemporaryAccess(7, 30);
      expect(
        callArgs<[number, TemporaryAccessPatch]>(deviceRepo.update)[1]
          .temporaryAccessBypassPolicies,
      ).toBe(false);
    });

    it.each(['+05:30', '-08:00', 'not-an-offset'])(
      'grants access regardless of the configured timezone %s',
      async (timezone) => {
        configService.getTimezone.mockResolvedValue(timezone);
        await expect(
          service.grantTemporaryAccess(7, 30),
        ).resolves.toBeUndefined();
      },
    );

    it.each([
      ['+05:30', '2026-03-01 06:00:00 +05:30'],
      ['-08:00', '2026-02-28 16:30:00 -08:00'],
      ['not-an-offset', '2026-03-01T00:30:00.000Z'],
    ])(
      'logs the expiry in the configured timezone %s whatever the host timezone',
      async (timezone, expiry) => {
        vi.useFakeTimers({ now: new Date('2026-03-01T00:00:00Z') });
        const hostOffset = vi
          .spyOn(Date.prototype, 'getTimezoneOffset')
          .mockReturnValue(240);
        configService.getTimezone.mockResolvedValue(timezone);

        try {
          await service.grantTemporaryAccess(7, 30);
        } finally {
          hostOffset.mockRestore();
          vi.useRealTimers();
        }

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          containing(`(expires at ${expiry})`),
        );
      },
    );

    it('nulls every temporary access column when revoking', async () => {
      await service.revokeTemporaryAccess(7);

      expect(deviceRepo.update).toHaveBeenCalledWith(7, revokedAccess);
    });

    it('answers 404 when revoking access of an unknown device', async () => {
      deviceRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.revokeTemporaryAccess(7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cleans up lapsed access of a device deleted meanwhile', async () => {
      deviceRepo.update.mockResolvedValue({ affected: 0 });
      const lapsed = userDevice({
        temporaryAccessUntil: new Date(Date.now() - 60_000),
      });

      await expect(service.isTemporaryAccessValid(lapsed)).resolves.toBe(false);
    });

    it('accepts access that has not expired', async () => {
      const active = userDevice({
        temporaryAccessUntil: new Date(Date.now() + 60_000),
      });

      await expect(service.isTemporaryAccessValid(active)).resolves.toBe(true);
      expect(deviceRepo.update).not.toHaveBeenCalled();
    });

    it('rejects and cleans up access that has lapsed', async () => {
      const lapsed = userDevice({
        temporaryAccessUntil: new Date(Date.now() - 60_000),
      });

      await expect(service.isTemporaryAccessValid(lapsed)).resolves.toBe(false);
      expect(deviceRepo.update).toHaveBeenCalledWith(1, revokedAccess);
    });

    it('rejects a device that never had temporary access', async () => {
      await expect(service.isTemporaryAccessValid(userDevice())).resolves.toBe(
        false,
      );
      expect(deviceRepo.update).not.toHaveBeenCalled();
    });

    it('reports the remaining minutes, rounded up', async () => {
      const active = userDevice({
        temporaryAccessUntil: new Date(Date.now() + 90_000),
      });
      expect(service.getTemporaryAccessTimeLeft(active)).toBe(2);
    });

    it('reports zero once the window has passed', async () => {
      const lapsed = userDevice({
        temporaryAccessUntil: new Date(Date.now() - 60_000),
      });
      expect(service.getTemporaryAccessTimeLeft(lapsed)).toBe(0);
    });

    it('reports null for a device with no temporary access', () => {
      expect(service.getTemporaryAccessTimeLeft(userDevice())).toBeNull();
    });
  });
});
