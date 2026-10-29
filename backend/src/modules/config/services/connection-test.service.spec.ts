import { PlexErrorCode } from '@/types/plex-errors';
import { containing } from '@/test-matchers';
import { SmtpSettings } from '@/modules/config/services/smtp-config';
import { ConfigService } from '@/modules/config/services/config.service';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';
import {
  ConfigTestbed,
  createConfigTestbed,
} from '@/modules/config/services/config-testbed.fixture';
import type { Mock } from 'vitest';

const mockCreateTransport =
  vi.fn<(...args: unknown[]) => { verify: Mock; sendMail: Mock }>();

vi.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

type MailOptions = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

describe('ConnectionTestService', () => {
  let testbed: ConfigTestbed;
  let service: ConnectionTestService;
  let config: ConfigService;
  let settingsRepo: ConfigTestbed['settingsRepo'];
  let emailService: ConfigTestbed['emailService'];
  let emailTemplateService: ConfigTestbed['emailTemplateService'];
  let verify: Mock;
  let sendMail: Mock<(...args: [MailOptions]) => Promise<unknown>>;
  let plexConnectionService: ConfigTestbed['plexConnectionService'];

  const build = async () => (await testbed.build()).get(ConnectionTestService);

  beforeEach(async () => {
    verify = vi.fn().mockResolvedValue(true);
    sendMail = vi
      .fn<(...args: [MailOptions]) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'abc' });
    mockCreateTransport.mockReset().mockReturnValue({ verify, sendMail });

    testbed = createConfigTestbed();
    ({
      settingsRepo,
      emailService,
      emailTemplateService,
      plexConnectionService,
    } = testbed);
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
    const smtp = (overrides: Partial<SmtpSettings> = {}) =>
      emailService.loadSmtpSettings.mockResolvedValue({
        SMTP_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'guardian',
        SMTP_PASSWORD: 'secret',
        SMTP_FROM_EMAIL: 'from@example.com',
        SMTP_FROM_NAME: 'Guardian',
        SMTP_USE_TLS: true,
        SMTP_TO_EMAILS: 'admin@example.com',
        ...overrides,
      });

    const sentMail = () => sendMail.mock.calls[0][0];

    beforeEach(() => {
      smtp();
    });

    it('refuses while SMTP is switched off', async () => {
      smtp({ SMTP_ENABLED: false });

      await expect(service.testSMTPConnection()).resolves.toEqual({
        success: false,
        message: 'SMTP email notifications are disabled',
      });
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('reports an invalid configuration without dialling out', async () => {
      smtp({ SMTP_TO_EMAILS: '' });

      await expect(service.testSMTPConnection()).resolves.toMatchObject({
        success: false,
        message: containing('No recipient email addresses'),
      });
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('verifies the server before sending anything', async () => {
      await service.testSMTPConnection();

      expect(verify).toHaveBeenCalled();
      expect(verify.mock.invocationCallOrder[0]).toBeLessThan(
        sendMail.mock.invocationCallOrder[0],
      );
    });

    it('sends the rendered test email from the configured identity', async () => {
      await service.testSMTPConnection();

      expect(emailTemplateService.generateSMTPTestEmail).toHaveBeenCalledWith(
        '2026-08-21 12:00:00',
      );
      expect(sentMail()).toMatchObject({
        from: 'Guardian <from@example.com>',
        to: ['admin@example.com'],
        subject: 'Guardian SMTP Test - Connection Successful',
        html: '<p>test</p>',
      });
    });

    it('names the single recipient in the success message', async () => {
      await expect(service.testSMTPConnection()).resolves.toEqual({
        success: true,
        message:
          'SMTP connection successful! Test email sent to admin@example.com',
      });
    });

    it('counts the recipients when there is more than one', async () => {
      smtp({ SMTP_TO_EMAILS: 'a@example.com, b@example.com' });

      await expect(service.testSMTPConnection()).resolves.toMatchObject({
        message: containing('2 recipients (a@example.com, b@example.com)'),
      });
    });

    it('translates a transport failure for the user', async () => {
      verify.mockRejectedValue(
        Object.assign(new Error('raw'), { code: 'EAUTH' }),
      );

      await expect(service.testSMTPConnection()).resolves.toEqual({
        success: false,
        message:
          'Authentication failed. Please check your username and password.',
      });
    });

    it('translates a rejected send for the user', async () => {
      sendMail.mockRejectedValue(
        Object.assign(new Error('raw'), { responseCode: 550 }),
      );

      await expect(service.testSMTPConnection()).resolves.toEqual({
        success: false,
        message: 'Email rejected by server. Please check recipient addresses.',
      });
    });

    it('reports an unexpected failure rather than throwing', async () => {
      emailService.loadSmtpSettings.mockRejectedValue(new Error('no route'));

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
