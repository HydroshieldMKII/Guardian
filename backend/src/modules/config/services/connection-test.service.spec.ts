import { PlexErrorCode } from '@/types/plex-errors';
import { ConfigService } from '@/modules/config/services/config.service';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';
import {
  ConfigTestbed,
  createConfigTestbed,
} from '@/modules/config/services/config-testbed.fixture';

describe('ConnectionTestService', () => {
  let testbed: ConfigTestbed;
  let service: ConnectionTestService;
  let config: ConfigService;
  let settingsRepo: ConfigTestbed['settingsRepo'];
  let emailService: ConfigTestbed['emailService'];
  let plexConnectionService: ConfigTestbed['plexConnectionService'];

  const build = async () => (await testbed.build()).get(ConnectionTestService);

  beforeEach(async () => {
    testbed = createConfigTestbed();
    ({ settingsRepo, emailService, plexConnectionService } = testbed);
    const module = await testbed.build();
    service = module.get(ConnectionTestService);
    config = module.get(ConfigService);
  });

  describe('testPlexConnection', () => {
    it('passes the stored server details through', async () => {
      await config.updateSetting('PLEX_SERVER_IP', '10.0.0.5');
      await config.updateSetting('PLEX_TOKEN', 'plex-token');
      await config.updateSetting('USE_SSL', true);

      await service.testPlexConnection();

      expect(plexConnectionService.testConnection).toHaveBeenCalledWith(
        '10.0.0.5',
        '32400',
        'plex-token',
        true,
        false,
      );
    });

    it('reports an unexpected failure as an unknown error', async () => {
      plexConnectionService.testConnection.mockRejectedValue(
        new Error('socket hang up'),
      );

      await expect(service.testPlexConnection()).resolves.toEqual({
        success: false,
        errorCode: PlexErrorCode.UNKNOWN_ERROR,
        message: 'Unexpected error testing Plex connection',
        details: 'socket hang up',
      });
    });
  });

  describe('testSMTPConnection', () => {
    it('hands the loaded settings to the email service', async () => {
      await service.testSMTPConnection();

      expect(emailService.loadSmtpSettings).toHaveBeenCalled();
      expect(emailService.toSmtpConfig).toHaveBeenCalledWith(
        await emailService.loadSmtpSettings.mock.results[0].value,
      );
    });

    it('forwards the config, the enabled flag and a timestamp', async () => {
      await service.testSMTPConnection();

      expect(emailService.testSMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com', port: 465 }),
        false,
        '2026-08-21 12:00:00',
      );
    });

    it('passes the enabled flag through as stored', async () => {
      emailService.loadSmtpSettings.mockResolvedValue({
        SMTP_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 465,
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        SMTP_FROM_EMAIL: '',
        SMTP_FROM_NAME: '',
        SMTP_USE_TLS: true,
        SMTP_TO_EMAILS: '',
      });

      await service.testSMTPConnection();

      expect(emailService.testSMTPConnection).toHaveBeenCalledWith(
        expect.anything(),
        true,
        expect.anything(),
      );
    });

    it('reports an unexpected failure rather than throwing', async () => {
      emailService.testSMTPConnection.mockRejectedValue(new Error('no route'));

      await expect(service.testSMTPConnection()).resolves.toEqual({
        success: false,
        message: 'Unexpected error: no route',
      });
    });
  });

  describe('testAppriseConnection', () => {
    it('delegates to the Apprise service', async () => {
      await expect(service.testAppriseConnection()).resolves.toEqual({
        success: true,
        message: 'ok',
      });
    });
  });

  describe('getPlexConfigurationStatus', () => {
    const configure = async () => {
      await config.updateSetting('PLEX_SERVER_IP', '10.0.0.5');
      await config.updateSetting('PLEX_TOKEN', 'plex-token');
    };

    it('reports an unconfigured server without testing the connection', async () => {
      await expect(service.getPlexConfigurationStatus()).resolves.toEqual({
        configured: false,
        hasValidCredentials: false,
        connectionStatus: 'Not configured',
      });
      expect(plexConnectionService.testConnection).not.toHaveBeenCalled();
    });

    it('reports a working connection', async () => {
      await configure();

      await expect(service.getPlexConfigurationStatus()).resolves.toEqual({
        configured: true,
        hasValidCredentials: true,
        connectionStatus: 'Connected',
      });
    });

    it('falls back to a generic message when the probe says nothing', async () => {
      await configure();
      plexConnectionService.testConnection.mockResolvedValue({ success: true });

      const status = await service.getPlexConfigurationStatus();
      expect(status.connectionStatus).toBe('Connected successfully');
    });

    it('prefixes a failure with its error code so the UI can parse it', async () => {
      await configure();
      plexConnectionService.testConnection.mockResolvedValue({
        success: false,
        errorCode: PlexErrorCode.INVALID_TOKEN,
        message: 'Bad token',
      });

      await expect(service.getPlexConfigurationStatus()).resolves.toEqual({
        configured: true,
        hasValidCredentials: false,
        connectionStatus: `${PlexErrorCode.INVALID_TOKEN}: Bad token`,
      });
    });

    it('reports a failed probe rather than throwing', async () => {
      await configure();
      plexConnectionService.testConnection.mockRejectedValue(
        new Error('socket hang up'),
      );

      await expect(service.getPlexConfigurationStatus()).resolves.toMatchObject(
        {
          configured: true,
          hasValidCredentials: false,
          connectionStatus: `${PlexErrorCode.UNKNOWN_ERROR}: Unexpected error testing Plex connection`,
        },
      );
    });
  });

  describe('settings that were never written', () => {
    it('dials Plex with empty strings rather than nulls', async () => {
      settingsRepo.find.mockResolvedValueOnce([]);
      const fresh = await build();
      settingsRepo.findOne.mockResolvedValue(null);

      await fresh.testPlexConnection();

      expect(plexConnectionService.testConnection).toHaveBeenCalledWith(
        '',
        '',
        '',
        false,
        false,
      );
    });
  });
});
