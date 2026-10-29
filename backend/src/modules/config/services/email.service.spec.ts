import { Test } from '@nestjs/testing';
import { EmailService } from './email.service';
import { SmtpSettings } from './smtp-config';
import { EmailTemplateService } from './email-template.service';
import { ConfigService } from './config.service';
import { TimezoneService } from './timezone.service';
import { EMAIL_PALETTE } from '@/common/utils/email-palette';

const mockCreateTransport = jest.fn<{ sendMail: jest.Mock }, unknown[]>();

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

type MailOptions = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};

describe('EmailService', () => {
  let service: EmailService;
  let sendMail: jest.Mock<Promise<unknown>, [MailOptions]>;
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

  const sentMail = () => sendMail.mock.calls[0][0];

  beforeEach(async () => {
    jest.clearAllMocks();
    stored = workingSettings();

    sendMail = jest
      .fn<Promise<unknown>, [MailOptions]>()
      .mockResolvedValue({ messageId: 'abc' });
    mockCreateTransport.mockReturnValue({ sendMail });

    templateService = {
      generateNotificationEmail: jest.fn().mockReturnValue('<p>notice</p>'),
      generatePasswordResetEmail: jest.fn().mockReturnValue('<p>reset</p>'),
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

  describe('sendEmail', () => {
    const notice = {
      type: 'block' as const,
      text: 'hello',
      username: 'testuser',
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
            'testuser',
            'Living Room TV',
            'DEVICE_PENDING',
          ),
        ),
      ).resolves.toBe('Guardian Alert: Stream Blocked - Living Room TV');
    });

    it('labels a new device', async () => {
      await expect(
        subjectFor(() =>
          service.sendNewDeviceEmail('new device', 'testuser', 'Shield'),
        ),
      ).resolves.toBe('Guardian Alert: New Device Detected - Shield');
    });

    it('labels a location change', async () => {
      await expect(
        subjectFor(() =>
          service.sendLocationChangeEmail(
            'testuser',
            'Shield',
            '10.0.0.1',
            '1.2.3.4',
          ),
        ),
      ).resolves.toBe('Guardian Alert: Device Location Changed - Shield');
    });

    it('describes a block that carries no stop code generically', async () => {
      const sendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue();

      await service.sendBlockedEmail('testuser', 'Shield', undefined);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'A streaming session has been blocked on your Plex server',
        }),
      );
      sendEmail.mockRestore();
    });

    it('labels a device note', async () => {
      await expect(
        subjectFor(() =>
          service.sendDeviceNoteEmail('testuser', 'Shield', 'please approve'),
        ),
      ).resolves.toBe('Guardian Alert: Device Note Received - Shield');
    });

    it.each([
      ['block', EMAIL_PALETTE.danger],
      ['new-device', EMAIL_PALETTE.info],
      ['location-change', EMAIL_PALETTE.warning],
      ['device-note', EMAIL_PALETTE.accent],
    ] as const)('paints a %s notification', async (type, colour) => {
      await service.sendEmail({
        type,
        text: 'x',
        username: 'testuser',
        deviceName: 'Shield',
      });

      const [, statusColor] = templateService.generateNotificationEmail.mock
        .calls[0] as [unknown, string];
      expect(statusColor).toBe(colour);
    });

    it('describes a block with no stop code generically', async () => {
      await service.sendEmail({
        type: 'block',
        text: 'x',
        username: 'testuser',
      });

      const [, , mainMessage] = templateService.generateNotificationEmail.mock
        .calls[0] as [unknown, unknown, string];
      expect(mainMessage).toBe(
        'A streaming session has been blocked on your Plex server',
      );
    });

    it('omits the device from the subject when there is none', async () => {
      await expect(
        subjectFor(() => service.sendNewDeviceEmail('new device', 'testuser')),
      ).resolves.toBe('Guardian Alert: New Device Detected');
    });
  });

  describe('notification bodies', () => {
    it('describes the stop code behind a block', async () => {
      await service.sendBlockedEmail('testuser', 'Shield', 'DEVICE_PENDING');

      const [, , , mainMessage] = templateService.generateNotificationEmail.mock
        .calls[0] as [unknown, unknown, unknown, string];
      expect(typeof mainMessage).toBe('string');
      expect(mainMessage).not.toBe('');
    });

    it('carries the old and new address on a location change', async () => {
      await service.sendLocationChangeEmail(
        'testuser',
        'Shield',
        '10.0.0.1',
        '1.2.3.4',
      );

      const call = templateService.generateNotificationEmail.mock
        .calls[0] as unknown[];
      expect(call).toContain('1.2.3.4');
      expect(call).toContain('10.0.0.1');
    });

    it('carries the note text through', async () => {
      await service.sendDeviceNoteEmail('testuser', 'Shield', 'please approve');

      expect(templateService.generateNotificationEmail.mock.calls[0]).toContain(
        'please approve',
      );
    });

    it('lists the user, device, type and reason in the plain text part', async () => {
      await service.sendBlockedEmail('testuser', 'Shield', 'DEVICE_PENDING');

      const { subject, text } = sentMail();
      const [, , mainMessage] = templateService.generateNotificationEmail.mock
        .calls[0] as [unknown, unknown, string];
      expect(text).toBe(
        `${subject}\n\n${mainMessage}\n\nUser: testuser\nDevice: Shield\nType: BLOCK\nReason: DEVICE_PENDING\n\nNotification sent at: 2026-08-21 12:00:00`,
      );
    });

    it('leaves the device and reason out of the plain text when absent', async () => {
      await service.sendNewDeviceEmail('new device', 'testuser');

      expect(sentMail().text).not.toContain('Device:');
      expect(sentMail().text).not.toContain('Reason:');
      expect(sentMail().text).toContain('User: testuser\nType: NEW-DEVICE\n');
    });

    it('writes to the configured notification recipients', async () => {
      stored.SMTP_TO_EMAILS = 'a@example.com; b@example.com';
      await service.sendDeviceNoteEmail('testuser', 'Shield', 'hi');

      expect(sentMail().to).toEqual(['a@example.com', 'b@example.com']);
    });

    it('swallows a failure raised while building a notification', async () => {
      templateService.generateNotificationEmail.mockImplementation(() => {
        throw new Error('template blew up');
      });

      await expect(
        service.sendNewDeviceEmail('new device', 'testuser', 'Shield'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    const send = () =>
      service.sendPasswordResetEmail(
        'owner@example.com',
        'owner',
        'https://guardian.example.com/reset-password?token=abc',
        15,
      );

    it('writes only to the address that asked, not the notification list', async () => {
      await send();

      expect(sentMail().to).toEqual(['owner@example.com']);
    });

    it('sends from the configured identity', async () => {
      await send();

      expect(sentMail().from).toBe('Guardian <from@example.com>');
    });

    it('falls back to the bare address without a from name', async () => {
      stored.SMTP_FROM_NAME = '';
      await send();

      expect(sentMail().from).toBe('from@example.com');
    });

    it('names the subject so it is not mistaken for an alert', async () => {
      await send();

      expect(sentMail().subject).toBe('Guardian: Reset your password');
    });

    it('repeats the link in the plain text part', async () => {
      await send();

      expect(sentMail().text).toContain(
        'https://guardian.example.com/reset-password?token=abc',
      );
      expect(sentMail().text).toContain('15 minutes');
    });

    it('renders the body from the template', async () => {
      await send();

      expect(templateService.generatePasswordResetEmail).toHaveBeenCalledWith(
        'owner',
        'https://guardian.example.com/reset-password?token=abc',
        15,
        '2026-08-21 12:00:00',
      );
      expect(sentMail().html).toBe('<p>reset</p>');
    });

    it('sends nothing while SMTP is disabled', async () => {
      stored.SMTP_ENABLED = false;
      await send();

      expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends nothing while the SMTP settings are incomplete', async () => {
      stored.SMTP_HOST = '';
      await send();

      expect(sendMail).not.toHaveBeenCalled();
    });

    it('swallows a transport failure', async () => {
      sendMail.mockRejectedValue(new Error('relay refused'));

      await expect(send()).resolves.toBeUndefined();
    });
  });
});
