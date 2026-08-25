import { Test } from '@nestjs/testing';
import { EmailService, SMTPConfig, SmtpSettings } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { ConfigService } from './config.service';
import { TimezoneService } from './timezone.service';

const mockCreateTransport = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

type TransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  tls: { rejectUnauthorized: boolean };
  connectionTimeout: number;
};

type MailOptions = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};

describe('EmailService', () => {
  let service: EmailService;
  let verify: jest.Mock;
  let sendMail: jest.Mock;
  let templateService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let timezoneService: { formatTimestamp: jest.Mock };
  let stored: SmtpSettings;

  const workingSettings = (): SmtpSettings => ({
    SMTP_ENABLED: true,
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_USER: 'guardian',
    SMTP_PASSWORD: 'secret',
    SMTP_FROM_EMAIL: 'from@example.com',
    SMTP_FROM_NAME: 'Guardian',
    SMTP_USE_TLS: true,
    SMTP_TO_EMAILS: 'admin@example.com',
  });

  const config = (overrides: Partial<SMTPConfig> = {}): SMTPConfig => ({
    host: 'smtp.example.com',
    port: 587,
    user: 'guardian',
    password: 'secret',
    fromEmail: 'from@example.com',
    fromName: 'Guardian',
    useTLS: true,
    toEmails: ['admin@example.com'],
    ...overrides,
  });

  const transportOptions = () =>
    mockCreateTransport.mock.calls[0][0] as TransportOptions;

  const sentMail = () => sendMail.mock.calls[0][0] as MailOptions;

  beforeEach(async () => {
    jest.clearAllMocks();
    stored = workingSettings();

    verify = jest.fn().mockResolvedValue(true);
    sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
    mockCreateTransport.mockReturnValue({ verify, sendMail });

    templateService = {
      generateSMTPTestEmail: jest.fn().mockReturnValue('<p>test</p>'),
      generateNotificationEmail: jest.fn().mockReturnValue('<p>notice</p>'),
    };

    configService = {
      getSetting: jest.fn((key: keyof SmtpSettings) =>
        Promise.resolve(stored[key]),
      ),
      getCurrentTimeInTimezone: jest
        .fn()
        .mockResolvedValue(new Date('2026-08-21T12:00:00Z')),
    };

    timezoneService = {
      formatTimestamp: jest.fn().mockReturnValue('2026-08-21 12:00:00'),
    };

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EmailTemplateService, useValue: templateService },
        { provide: ConfigService, useValue: configService },
        { provide: TimezoneService, useValue: timezoneService },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  describe('loadSmtpSettings', () => {
    it('reads every SMTP setting', async () => {
      await service.loadSmtpSettings();

      for (const key of Object.keys(stored)) {
        expect(configService.getSetting).toHaveBeenCalledWith(key);
      }
    });

    it('returns the stored values', async () => {
      await expect(service.loadSmtpSettings()).resolves.toEqual(stored);
    });

    it('substitutes defaults for settings that were never written', async () => {
      configService.getSetting.mockResolvedValue(null);

      await expect(service.loadSmtpSettings()).resolves.toEqual({
        SMTP_ENABLED: false,
        SMTP_HOST: '',
        SMTP_PORT: 0,
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        SMTP_FROM_EMAIL: '',
        SMTP_FROM_NAME: '',
        SMTP_USE_TLS: false,
        SMTP_TO_EMAILS: '',
      });
    });
  });

  describe('toSmtpConfig', () => {
    it('maps the stored settings onto a transport config', () => {
      expect(service.toSmtpConfig(stored)).toEqual({
        host: 'smtp.example.com',
        port: 587,
        user: 'guardian',
        password: 'secret',
        fromEmail: 'from@example.com',
        fromName: 'Guardian',
        useTLS: true,
        toEmails: ['admin@example.com'],
      });
    });

    it('honours the boolean TLS setting rather than a string', () => {
      expect(service.toSmtpConfig(stored).useTLS).toBe(true);
      expect(
        service.toSmtpConfig({ ...stored, SMTP_USE_TLS: false }).useTLS,
      ).toBe(false);
    });

    it('splits recipients on commas, semicolons and newlines', () => {
      const result = service.toSmtpConfig({
        ...stored,
        SMTP_TO_EMAILS:
          'a@example.com, b@example.com;c@example.com\nd@example.com',
      });

      expect(result.toEmails).toEqual([
        'a@example.com',
        'b@example.com',
        'c@example.com',
        'd@example.com',
      ]);
    });

    it('yields an empty recipient list when none are configured', () => {
      expect(
        service.toSmtpConfig({ ...stored, SMTP_TO_EMAILS: '' }).toEmails,
      ).toEqual([]);
    });

    it('drops blank entries left by trailing separators', () => {
      expect(
        service.toSmtpConfig({
          ...stored,
          SMTP_TO_EMAILS: 'a@example.com,,  ,b@example.com,',
        }).toEmails,
      ).toEqual(['a@example.com', 'b@example.com']);
    });
  });

  describe('testSMTPConnection', () => {
    const test = (overrides: Partial<SMTPConfig> = {}, enabled = true) =>
      service.testSMTPConnection(config(overrides), enabled, 'ts');

    it('refuses while SMTP is switched off', async () => {
      await expect(test({}, false)).resolves.toEqual({
        success: false,
        message: 'SMTP email notifications are disabled',
      });
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it.each([
      ['host', { host: '' }],
      ['port', { port: 0 }],
      ['user', { user: '' }],
      ['password', { password: '' }],
      ['from address', { fromEmail: '' }],
    ] as const)('refuses without a %s', async (_field, overrides) => {
      await expect(test(overrides)).resolves.toMatchObject({
        success: false,
        message: expect.stringContaining('Missing required SMTP configuration'),
      });
    });

    it.each([25, 2525])('refuses TLS on port %s', async (port) => {
      await expect(test({ port })).resolves.toEqual({
        success: false,
        message:
          'TLS is not supported on this port. Please use port 465 or 587.',
      });
    });

    it.each([465, 587])('accepts TLS on port %s', async (port) => {
      await expect(test({ port })).resolves.toMatchObject({ success: true });
    });

    it('allows any port when TLS is off', async () => {
      await expect(test({ port: 25, useTLS: false })).resolves.toMatchObject({
        success: true,
      });
    });

    it('refuses with no recipients', async () => {
      await expect(test({ toEmails: [] })).resolves.toMatchObject({
        message: expect.stringContaining('No recipient email addresses'),
      });
    });

    it('names the recipients it could not parse', async () => {
      await expect(
        test({ toEmails: ['fine@example.com', 'nope', 'also bad'] }),
      ).resolves.toEqual({
        success: false,
        message: 'Invalid email format(s): nope, also bad',
      });
    });

    it('only negotiates implicit TLS on port 465', async () => {
      await test({ port: 465 });
      expect(transportOptions().secure).toBe(true);

      mockCreateTransport.mockClear();
      await test({ port: 587 });
      expect(transportOptions().secure).toBe(false);
    });

    it('passes the credentials to the transport', async () => {
      await test();

      expect(transportOptions()).toMatchObject({
        host: 'smtp.example.com',
        port: 587,
        auth: { user: 'guardian', pass: 'secret' },
        connectionTimeout: 15000,
      });
    });

    it('verifies the server before sending anything', async () => {
      await test();

      expect(verify).toHaveBeenCalled();
      expect(verify.mock.invocationCallOrder[0]).toBeLessThan(
        sendMail.mock.invocationCallOrder[0],
      );
    });

    it('sends from the display name when one is set', async () => {
      await test();
      expect(sentMail().from).toBe('Guardian <from@example.com>');
    });

    it('falls back to the bare address with no display name', async () => {
      await test({ fromName: undefined });
      expect(sentMail().from).toBe('from@example.com');
    });

    it('names the single recipient in the success message', async () => {
      await expect(test()).resolves.toEqual({
        success: true,
        message:
          'SMTP connection successful! Test email sent to admin@example.com',
      });
    });

    it('counts the recipients when there is more than one', async () => {
      await expect(
        test({ toEmails: ['a@example.com', 'b@example.com'] }),
      ).resolves.toMatchObject({
        message: expect.stringContaining(
          '2 recipients (a@example.com, b@example.com)',
        ),
      });
    });

    it.each([
      [
        'EAUTH',
        'Authentication failed. Please check your username and password.',
      ],
      [
        'ECONNECTION',
        'Failed to connect to SMTP server. Please check the host and port.',
      ],
      ['ETIMEDOUT', 'Connection timed out. Please check your email settings.'],
      ['ENOTFOUND', 'SMTP server not found. Please check the hostname.'],
    ])('translates a %s failure', async (code, message) => {
      verify.mockRejectedValue(Object.assign(new Error('raw'), { code }));

      await expect(test()).resolves.toEqual({ success: false, message });
    });

    it.each([
      [535, 'Authentication failed. Please verify your credentials.'],
      [550, 'Email rejected by server. Please check recipient addresses.'],
    ])('translates response code %s', async (responseCode, message) => {
      sendMail.mockRejectedValue(
        Object.assign(new Error('raw'), { responseCode }),
      );

      await expect(test()).resolves.toEqual({ success: false, message });
    });

    it('surfaces an unrecognised failure verbatim', async () => {
      verify.mockRejectedValue(new Error('socket hang up'));

      await expect(test()).resolves.toEqual({
        success: false,
        message: 'SMTP error: socket hang up',
      });
    });
  });

  describe('sendEmail', () => {
    const notice = {
      type: 'info' as const,
      text: 'hello',
      username: 'vincent',
    };

    it('does nothing while SMTP is disabled', async () => {
      stored.SMTP_ENABLED = false;
      await service.sendEmail(notice);

      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('does nothing when the configuration is incomplete', async () => {
      stored.SMTP_HOST = '';
      await service.sendEmail(notice);

      expect(sendMail).not.toHaveBeenCalled();
    });

    it('stamps the message with the configured timezone', async () => {
      await service.sendEmail(notice);

      expect(configService.getCurrentTimeInTimezone).toHaveBeenCalled();
      expect(sentMail().text).toContain('2026-08-21 12:00:00');
    });

    it('swallows a transport failure rather than throwing', async () => {
      sendMail.mockRejectedValue(new Error('relay refused'));

      await expect(service.sendEmail(notice)).resolves.toBeUndefined();
    });

    it('renders the body through the template service', async () => {
      await service.sendEmail(notice);

      expect(templateService.generateNotificationEmail).toHaveBeenCalled();
      expect(sentMail().html).toBe('<p>notice</p>');
    });
  });

  describe('notification subjects', () => {
    const subjectFor = async (send: () => Promise<void>) => {
      await send();
      return sentMail().subject;
    };

    it('labels a blocked stream', async () => {
      await expect(
        subjectFor(() =>
          service.sendBlockedEmail(
            'vincent',
            'Living Room TV',
            'DEVICE_PENDING',
          ),
        ),
      ).resolves.toBe('Guardian Alert: Stream Blocked - Living Room TV');
    });

    it('labels a new device', async () => {
      await expect(
        subjectFor(() =>
          service.sendNewDeviceEmail('new device', 'vincent', 'Shield'),
        ),
      ).resolves.toBe('Guardian Alert: New Device Detected - Shield');
    });

    it('labels a location change', async () => {
      await expect(
        subjectFor(() =>
          service.sendLocationChangeEmail(
            'vincent',
            'Shield',
            '10.0.0.1',
            '1.2.3.4',
          ),
        ),
      ).resolves.toBe('Guardian Alert: Device Location Changed - Shield');
    });

    it('describes an unrecognised stop code rather than dropping it', async () => {
      const sendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue();

      await service.sendBlockedEmail('vincent', 'Shield', 'MYSTERY');

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'A streaming session was blocked: MYSTERY',
        }),
      );
      sendEmail.mockRestore();
    });

    it('labels a device note', async () => {
      await expect(
        subjectFor(() =>
          service.sendDeviceNoteEmail('vincent', 'Shield', 'please approve'),
        ),
      ).resolves.toBe('Guardian Alert: Device Note Received - Shield');
    });

    it.each([
      ['warning', 'Guardian Warning - Shield', 'WARNING'],
      ['error', 'Guardian Error - Shield', 'ERROR'],
      ['info', 'Guardian Notification - Shield', 'NOTIFICATION'],
    ] as const)('labels a %s notification', async (type, subject, label) => {
      await service.sendEmail({
        type,
        text: 'x',
        username: 'vincent',
        deviceName: 'Shield',
      });

      expect(sentMail().subject).toBe(subject);
      const [, , statusLabel] =
        templateService.generateNotificationEmail.mock.calls[0];
      expect(statusLabel).toBe(label);
    });

    it('describes a block with no stop code generically', async () => {
      await service.sendEmail({
        type: 'block',
        text: 'x',
        username: 'vincent',
      });

      const [, , , mainMessage] =
        templateService.generateNotificationEmail.mock.calls[0];
      expect(mainMessage).toBe(
        'A streaming session has been blocked on your Plex server',
      );
    });

    it('omits the device from the subject when there is none', async () => {
      await expect(
        subjectFor(() => service.sendNewDeviceEmail('new device', 'vincent')),
      ).resolves.toBe('Guardian Alert: New Device Detected');
    });
  });

  describe('notification bodies', () => {
    it('describes the stop code behind a block', async () => {
      await service.sendBlockedEmail('vincent', 'Shield', 'DEVICE_PENDING');

      const [, , , mainMessage] =
        templateService.generateNotificationEmail.mock.calls[0];
      expect(typeof mainMessage).toBe('string');
      expect(mainMessage).not.toBe('');
    });

    it('carries the old and new address on a location change', async () => {
      await service.sendLocationChangeEmail(
        'vincent',
        'Shield',
        '10.0.0.1',
        '1.2.3.4',
      );

      const call = templateService.generateNotificationEmail.mock.calls[0];
      expect(call).toContain('1.2.3.4');
      expect(call).toContain('10.0.0.1');
    });

    it('carries the note text through', async () => {
      await service.sendDeviceNoteEmail('vincent', 'Shield', 'please approve');

      expect(templateService.generateNotificationEmail.mock.calls[0]).toContain(
        'please approve',
      );
    });

    it('swallows a failure raised while building a notification', async () => {
      templateService.generateNotificationEmail.mockImplementation(() => {
        throw new Error('template blew up');
      });

      await expect(
        service.sendNewDeviceEmail('new device', 'vincent', 'Shield'),
      ).resolves.toBeUndefined();
    });
  });
});
