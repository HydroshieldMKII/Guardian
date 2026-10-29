import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigController } from '@/modules/config/config.controller';
import { ConfigService } from '@/modules/config/services/config.service';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';

describe('ConfigController', () => {
  let controller: ConfigController;
  let services: Record<string, jest.Mock>;

  const pick = (...methods: string[]) =>
    Object.fromEntries(methods.map((method) => [method, services[method]]));

  beforeEach(async () => {
    services = {
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
    };

    const module = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        {
          provide: ConfigService,
          useValue: pick(
            'getVersionInfo',
            'getPublicSettings',
            'getSetting',
            'updateSetting',
            'updateMultipleSettings',
          ),
        },
        {
          provide: ConnectionTestService,
          useValue: pick(
            'testPlexConnection',
            'testSMTPConnection',
            'testAppriseConnection',
            'getPlexConfigurationStatus',
          ),
        },
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
      services.getVersionInfo.mockRejectedValue(new Error('boom'));
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
      services.getPublicSettings.mockRejectedValue(new Error('boom'));
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
      services.getSetting.mockResolvedValue(null);
      expect(await statusOf(controller.getSetting('NOPE'))).toBe(
        HttpStatus.NOT_FOUND,
      );
    });

    it('returns a 404 for a declared key that has no stored value', async () => {
      services.getSetting.mockResolvedValue(null);
      expect(await statusOf(controller.getSetting('TIMEZONE'))).toBe(
        HttpStatus.NOT_FOUND,
      );
      expect(services.getSetting).toHaveBeenCalledWith('TIMEZONE');
    });

    it('maps an unexpected failure to a 500', async () => {
      services.getSetting.mockRejectedValue(new Error('boom'));
      expect(await statusOf(controller.getSetting('TIMEZONE'))).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('never reaches the database for a key this build does not declare', async () => {
      expect(await statusOf(controller.getSetting('NOT_A_SETTING'))).toBe(
        HttpStatus.NOT_FOUND,
      );
      expect(services.getSetting).not.toHaveBeenCalled();
    });
  });

  describe('updateSetting', () => {
    it('forwards the key and value', async () => {
      const result = await controller.updateSetting('TIMEZONE', {
        value: 'UTC',
      });

      expect(services.updateSetting).toHaveBeenCalledWith('TIMEZONE', 'UTC');
      expect(result.message).toBe('Setting updated successfully');
    });

    it('refuses to write a key this build does not declare', async () => {
      expect(
        await statusOf(
          controller.updateSetting('NOT_A_SETTING', { value: 'x' }),
        ),
      ).toBe(HttpStatus.NOT_FOUND);
      expect(services.updateSetting).not.toHaveBeenCalled();
    });

    it('maps a validation failure to a 400 carrying the message', async () => {
      services.updateSetting.mockRejectedValue(new Error('bad value'));
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

      expect(services.updateMultipleSettings).toHaveBeenCalledWith(settings);
      expect(result.message).toBe('Settings updated successfully');
    });

    it('maps a failure to a 400', async () => {
      services.updateMultipleSettings.mockRejectedValue(new Error('invalid'));
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
      expect(services[serviceMethod]).toHaveBeenCalled();
    });

    it('maps a failure to a 500', async () => {
      services[serviceMethod].mockRejectedValue(new Error('boom'));
      expect(await statusOf(controller[method]())).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('an error without a message', () => {
    it.each([
      [
        'updateSetting',
        () => controller.updateSetting('TIMEZONE', { value: 'x' }),
        'Failed to update setting',
      ],
      [
        'updateMultipleSettings',
        () => controller.updateMultipleSettings([]),
        'Failed to update settings',
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
