import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { ConfigController } from '@/modules/config/config.controller';
import { ConfigService } from '@/modules/config/services/config.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import { AuthService } from '@/modules/auth/auth.service';
import { AdminUser } from '@/entities/admin-user.entity';

describe('ConfigController', () => {
  let controller: ConfigController;
  let configService: Record<string, jest.Mock>;
  let authService: { validatePassword: jest.Mock };

  const admin = Object.assign(new AdminUser(), {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: 'hash',
    sessionId: 'session-1',
    userType: 'admin' as const,
  });

  beforeEach(async () => {
    configService = {
      getVersionInfo: jest.fn().mockResolvedValue({ current: '1.3.5' }),
      getPublicSettings: jest.fn().mockResolvedValue([{ key: 'TIMEZONE' }]),
      getSetting: jest.fn().mockResolvedValue('UTC'),
      updateSetting: jest.fn().mockResolvedValue({ key: 'TIMEZONE' }),
      updateMultipleSettings: jest.fn().mockResolvedValue([{ key: 'A' }]),
      testPlexConnection: jest.fn().mockResolvedValue({ success: true }),
      testSMTPConnection: jest.fn().mockResolvedValue({ success: true }),
      testAppriseConnection: jest.fn().mockResolvedValue({ success: true }),
      getPlexConfigurationStatus: jest.fn().mockResolvedValue({
        configured: true,
      }),
      exportDatabase: jest.fn().mockResolvedValue({ settings: [] }),
      importDatabase: jest.fn().mockResolvedValue({ settings: 3 }),
      resetDatabase: jest.fn().mockResolvedValue(undefined),
      resetStreamCounts: jest.fn().mockResolvedValue(undefined),
      deleteAllDevices: jest.fn().mockResolvedValue(undefined),
      clearAllSessionHistory: jest.fn().mockResolvedValue(undefined),
    };

    authService = { validatePassword: jest.fn().mockResolvedValue(true) };

    const module = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: AppriseService, useValue: {} },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get(ConfigController);
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

  describe('getVersion', () => {
    it('returns the version payload', async () => {
      await expect(controller.getVersion()).resolves.toEqual({
        current: '1.3.5',
      });
    });

    it('maps a failure to a 500', async () => {
      configService.getVersionInfo.mockRejectedValue(new Error('boom'));
      expect(await statusOf(controller.getVersion())).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('getAllSettings', () => {
    it('returns the public settings', async () => {
      await expect(controller.getAllSettings()).resolves.toHaveLength(1);
    });

    it('maps a failure to a 500', async () => {
      configService.getPublicSettings.mockRejectedValue(new Error('boom'));
      expect(await statusOf(controller.getAllSettings())).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('getSetting', () => {
    it('returns the key and value', async () => {
      await expect(controller.getSetting('TIMEZONE')).resolves.toEqual({
        key: 'TIMEZONE',
        value: 'UTC',
      });
    });

    it('returns a 404 for an unknown key', async () => {
      configService.getSetting.mockResolvedValue(null);
      expect(await statusOf(controller.getSetting('NOPE'))).toBe(
        HttpStatus.NOT_FOUND,
      );
    });

    it('maps an unexpected failure to a 500', async () => {
      configService.getSetting.mockRejectedValue(new Error('boom'));
      expect(await statusOf(controller.getSetting('TIMEZONE'))).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('never reaches the database for a key this build does not declare', async () => {
      expect(await statusOf(controller.getSetting('NOT_A_SETTING'))).toBe(
        HttpStatus.NOT_FOUND,
      );
      expect(configService.getSetting).not.toHaveBeenCalled();
    });
  });

  describe('updateSetting', () => {
    it('forwards the key and value', async () => {
      const result = await controller.updateSetting('TIMEZONE', {
        value: 'UTC',
      });

      expect(configService.updateSetting).toHaveBeenCalledWith(
        'TIMEZONE',
        'UTC',
      );
      expect(result.message).toBe('Setting updated successfully');
    });

    it('refuses to write a key this build does not declare', async () => {
      expect(
        await statusOf(
          controller.updateSetting('NOT_A_SETTING', { value: 'x' }),
        ),
      ).toBe(HttpStatus.NOT_FOUND);
      expect(configService.updateSetting).not.toHaveBeenCalled();
    });

    it('maps a validation failure to a 400 carrying the message', async () => {
      configService.updateSetting.mockRejectedValue(new Error('bad value'));
      await expect(
        controller.updateSetting('TIMEZONE', { value: 'x' }),
      ).rejects.toThrow('bad value');
      expect(
        await statusOf(controller.updateSetting('TIMEZONE', { value: 'x' })),
      ).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('updateMultipleSettings', () => {
    it('forwards the batch', async () => {
      const settings = [{ key: 'DEFAULT_PAGE' as const, value: 'streams' }];
      const result = await controller.updateMultipleSettings(settings);

      expect(configService.updateMultipleSettings).toHaveBeenCalledWith(
        settings,
      );
      expect(result.message).toBe('Settings updated successfully');
    });

    it('maps a failure to a 400', async () => {
      configService.updateMultipleSettings.mockRejectedValue(
        new Error('invalid'),
      );
      expect(await statusOf(controller.updateMultipleSettings([]))).toBe(
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe.each([
    ['testPlexConnection', 'testPlexConnection'],
    ['testSMTPConnection', 'testSMTPConnection'],
    ['testAppriseConnection', 'testAppriseConnection'],
    ['getPlexStatus', 'getPlexConfigurationStatus'],
  ] as const)('%s', (method, serviceMethod) => {
    it('returns the service result', async () => {
      await expect(controller[method]()).resolves.toBeDefined();
      expect(configService[serviceMethod]).toHaveBeenCalled();
    });

    it('maps a failure to a 500', async () => {
      configService[serviceMethod].mockRejectedValue(new Error('boom'));
      expect(await statusOf(controller[method]())).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('exportDatabase', () => {
    const responseStub = () => {
      const setHeader = jest.fn();
      const send = jest.fn();
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
      configService.exportDatabase.mockRejectedValue(new Error('boom'));
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

      expect(configService.importDatabase).toHaveBeenCalledWith({
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
      configService.importDatabase.mockRejectedValue(new Error('bad schema'));
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
      expect(configService[serviceMethod]).toHaveBeenCalled();
    });

    it('refuses with a 403 on a bad password', async () => {
      authService.validatePassword.mockResolvedValue(false);
      expect(await statusOf(controller[method](dto, admin))).toBe(
        HttpStatus.FORBIDDEN,
      );
      expect(configService[serviceMethod]).not.toHaveBeenCalled();
    });

    it('maps a script failure to a 500', async () => {
      configService[serviceMethod].mockRejectedValue(new Error('script died'));
      expect(await statusOf(controller[method](dto, admin))).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });
});
