import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { DatabaseController } from '@/modules/config/database.controller';
import { DatabaseMaintenanceService } from '@/modules/config/services/database-maintenance.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import { AuthService } from '@/modules/auth/auth.service';
import { AdminUser } from '@/entities/admin-user.entity';
import type { Mock } from 'vitest';

describe('DatabaseController', () => {
  let controller: DatabaseController;
  let services: Record<string, Mock>;
  let authService: { validatePassword: Mock };

  const pick = (...methods: string[]) =>
    Object.fromEntries(methods.map((method) => [method, services[method]]));

  const admin = Object.assign(new AdminUser(), {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: 'hash',
    sessionId: 'session-1',
    userType: 'admin' as const,
  });

  beforeEach(async () => {
    services = {
      exportDatabase: vi.fn().mockResolvedValue({ settings: [] }),
      importDatabase: vi.fn().mockResolvedValue({ settings: 3 }),
      resetDatabase: vi.fn().mockResolvedValue(undefined),
      resetStreamCounts: vi.fn().mockResolvedValue(undefined),
      deleteAllDevices: vi.fn().mockResolvedValue(undefined),
      clearAllSessionHistory: vi.fn().mockResolvedValue(undefined),
    };

    authService = { validatePassword: vi.fn().mockResolvedValue(true) };

    const module = await Test.createTestingModule({
      controllers: [DatabaseController],
      providers: [
        {
          provide: DatabaseMaintenanceService,
          useValue: pick('exportDatabase', 'importDatabase', 'resetDatabase'),
        },
        {
          provide: DatabaseService,
          useValue: pick(
            'resetStreamCounts',
            'deleteAllDevices',
            'clearAllSessionHistory',
          ),
        },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get(DatabaseController);
  });

  const statusOf = async (call: Promise<unknown>) => {
    try {
      await call;
      throw new Error('expected the call to reject');
    } catch (error) {
      if (error instanceof HttpException) return error.getStatus();
      throw error;
    }
  };

  describe('exportDatabase', () => {
    const responseStub = () => {
      const setHeader = vi.fn();
      const send = vi.fn();
      const stub: Pick<Response, 'setHeader' | 'send'> = { setHeader, send };
      return { res: stub as Response, setHeader, send };
    };

    it('streams the export as a JSON attachment', async () => {
      const { res, setHeader, send } = responseStub();
      await controller.exportDatabase(res);

      expect(setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(send).toHaveBeenCalledWith({ settings: [] });
    });

    it('names the file with a filesystem-safe timestamp', async () => {
      const { res, setHeader } = responseStub();
      await controller.exportDatabase(res);

      const disposition = (setHeader.mock.calls as [string, string][]).find(
        ([header]) => header === 'Content-Disposition',
      )?.[1];

      expect(disposition).toMatch(
        /^attachment; filename="guardian-backup-[\dTZ-]+\.json"$/,
      );
    });

    it('maps a failure to a 500', async () => {
      services.exportDatabase.mockRejectedValue(new Error('boom'));
      expect(
        await statusOf(controller.exportDatabase(responseStub().res)),
      ).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('importDatabase', () => {
    const upload = (contents: string) => ({
      buffer: Buffer.from(contents, 'utf8'),
    });

    it('parses the upload and forwards it', async () => {
      const result = await controller.importDatabase(upload('{"settings":[]}'));

      expect(services.importDatabase).toHaveBeenCalledWith({
        settings: [],
      });
      expect(result.imported).toEqual({ settings: 3 });
    });

    it('rejects a missing file with a 400', async () => {
      expect(await statusOf(controller.importDatabase(undefined))).toBe(
        HttpStatus.BAD_REQUEST,
      );
    });

    it('rejects malformed JSON with a 400', async () => {
      expect(
        await statusOf(controller.importDatabase(upload('not json'))),
      ).toBe(HttpStatus.BAD_REQUEST);
    });

    it('maps a service failure to a 500', async () => {
      services.importDatabase.mockRejectedValue(new Error('bad schema'));
      expect(await statusOf(controller.importDatabase(upload('{}')))).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe.each([
    ['resetDatabase', 'resetDatabase', 'Database reset successfully'],
    [
      'resetStreamCounts',
      'resetStreamCounts',
      'Stream counts reset successfully',
    ],
    [
      'deleteAllDevices',
      'deleteAllDevices',
      'All devices deleted successfully',
    ],
    [
      'clearSessionHistory',
      'clearAllSessionHistory',
      'Session history cleared successfully',
    ],
  ] as const)('%s', (method, serviceMethod, message) => {
    const dto = { password: 'hunter2' };

    it('runs the script once the password checks out', async () => {
      await expect(controller[method](dto, admin)).resolves.toEqual({
        message,
      });
      expect(authService.validatePassword).toHaveBeenCalledWith(
        'admin-1',
        'hunter2',
      );
      expect(services[serviceMethod]).toHaveBeenCalled();
    });

    it('refuses with a 403 on a bad password', async () => {
      authService.validatePassword.mockResolvedValue(false);
      expect(await statusOf(controller[method](dto, admin))).toBe(
        HttpStatus.FORBIDDEN,
      );
      expect(services[serviceMethod]).not.toHaveBeenCalled();
    });

    it('maps a script failure to a 500', async () => {
      services[serviceMethod].mockRejectedValue(new Error('script died'));
      expect(await statusOf(controller[method](dto, admin))).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  it('maps a password check failure to a 500 carrying the message', async () => {
    authService.validatePassword.mockRejectedValue(new Error('db down'));
    await expect(
      controller.resetDatabase({ password: 'x' }, admin),
    ).rejects.toThrow('db down');
  });

  describe('an error without a message', () => {
    const dto = { password: 'hunter2' };

    it.each([
      [
        'importDatabase',
        () => controller.importDatabase({ buffer: Buffer.from('{}') }),
        'Failed to import database',
      ],
      [
        'resetDatabase',
        () => controller.resetDatabase(dto, admin),
        'Failed to reset database',
      ],
      [
        'resetStreamCounts',
        () => controller.resetStreamCounts(dto, admin),
        'Failed to reset stream counts',
      ],
      [
        'deleteAllDevices',
        () => controller.deleteAllDevices(dto, admin),
        'Failed to delete all devices',
      ],
      [
        'clearAllSessionHistory',
        () => controller.clearSessionHistory(dto, admin),
        'Failed to clear session history',
      ],
    ] as const)(
      'reports a generic message when %s fails silently',
      async (serviceMethod, call, message) => {
        services[serviceMethod].mockRejectedValue(new Error(''));
        await expect(call()).rejects.toThrow(message);
      },
    );
  });
});
