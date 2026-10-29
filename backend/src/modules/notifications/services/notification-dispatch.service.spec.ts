import { Notification } from '@/entities/notification.entity';
import { NotificationDispatchService } from '@/modules/notifications/services/notification-dispatch.service';
import {
  createNotificationsTestbed,
  NotificationsTestbed,
} from '@/modules/notifications/services/notifications-testbed.fixture';
import { callResult } from '@/test-matchers';

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let notificationRepo: NotificationsTestbed['notificationRepo'];
  let deviceRepo: NotificationsTestbed['deviceRepo'];
  let appriseService: NotificationsTestbed['appriseService'];
  let emailService: NotificationsTestbed['emailService'];
  let enabled: Set<string>;

  const createdNotification = (): Notification =>
    callResult<Notification>(notificationRepo.create);

  beforeEach(async () => {
    const testbed = await createNotificationsTestbed();
    ({ notificationRepo, deviceRepo, appriseService, emailService, enabled } =
      testbed);
    service = testbed.module.get(NotificationDispatchService);
  });

  describe('createNewDeviceNotification', () => {
    const notify = () =>
      service.createNewDeviceNotification(
        'u1',
        'testuser',
        'Living Room TV',
        '10.0.0.5',
        9,
      );

    it('stores nothing when in-app notifications are off', async () => {
      await expect(notify()).resolves.toBeNull();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('stores nothing when only the global in-app switch is on', async () => {
      enabled.add('IN_APP_ENABLED');
      await expect(notify()).resolves.toBeNull();
    });

    it('stores an in-app notification when both switches are on', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_NEW_DEVICE');

      const result = await notify();

      expect(result).toMatchObject({
        userId: 'u1',
        type: 'info',
        sessionHistoryId: 9,
        text: 'New device detected for testuser on Living Room TV - 10.0.0.5',
      });
    });

    it('truncates a very long device name in the message', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_NEW_DEVICE');

      const result = await service.createNewDeviceNotification(
        'u1',
        'testuser',
        'A'.repeat(45),
        '10.0.0.5',
      );

      expect(result?.text).toContain(`${'A'.repeat(30)}...`);
    });

    it('emails when SMTP notifications are on', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_NEW_DEVICE');

      await notify();

      expect(emailService.sendNewDeviceEmail).toHaveBeenCalledWith(
        expect.stringContaining('New device detected'),
        'testuser',
        'Living Room TV',
        '10.0.0.5',
      );
    });

    it('still returns the in-app notification when the email fails', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_NEW_DEVICE');
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_NEW_DEVICE');
      emailService.sendNewDeviceEmail.mockRejectedValue(new Error('no relay'));

      await expect(notify()).resolves.not.toBeNull();
    });

    it('pushes through Apprise when enabled', async () => {
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_NEW_DEVICE');

      await notify();

      expect(appriseService.sendNewDeviceNotification).toHaveBeenCalledWith(
        'testuser',
        'Living Room TV',
        '10.0.0.5',
      );
    });

    it('survives an Apprise failure', async () => {
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_NEW_DEVICE');
      appriseService.sendNewDeviceNotification.mockRejectedValue(
        new Error('bad url'),
      );

      await expect(notify()).resolves.toBeNull();
    });
  });

  describe('createStreamBlockedNotification', () => {
    beforeEach(() => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_BLOCK');
    });

    const blocked = (stopCode?: string) =>
      service.createStreamBlockedNotification(
        'u1',
        'testuser',
        'dev-1',
        stopCode,
        9,
        '10.0.0.5',
      );

    it.each([
      ['DEVICE_PENDING', 'device needs approval'],
      ['DEVICE_REJECTED', 'device is not allowed'],
      ['IP_POLICY_LAN_ONLY', 'restricted to LAN only'],
      ['IP_POLICY_WAN_ONLY', 'restricted to WAN only'],
      ['IP_POLICY_NOT_ALLOWED', 'not in the allowed list'],
      ['TIME_RESTRICTED', "schedule doesn't allow streaming"],
      ['CONCURRENT_LIMIT', 'exceeded concurrent stream limit'],
    ])('explains a %s block', async (stopCode, expected) => {
      const result = await blocked(stopCode);
      expect(result?.text).toContain(expected);
    });

    it('echoes an unrecognised stop code verbatim', async () => {
      const result = await blocked('SOMETHING_NEW');
      expect(result?.text).toContain('SOMETHING_NEW');
    });

    it('falls back to a generic message with no stop code', async () => {
      const result = await blocked();
      expect(result?.text).toBe(
        'Stream blocked for testuser on Unknown Device',
      );
    });

    it('uses the stored device name when there is one', async () => {
      deviceRepo.findOne.mockResolvedValue({ deviceName: 'Living Room TV' });
      const result = await blocked('DEVICE_PENDING');
      expect(result?.text).toContain('Living Room TV');
    });

    it('truncates a very long stored device name', async () => {
      deviceRepo.findOne.mockResolvedValue({ deviceName: 'B'.repeat(45) });
      const result = await blocked('DEVICE_PENDING');
      expect(result?.text).toContain(`${'B'.repeat(30)}...`);
    });

    it('falls back to Unknown Device when the lookup fails', async () => {
      deviceRepo.findOne.mockRejectedValue(new Error('db down'));
      const result = await blocked('DEVICE_PENDING');
      expect(result?.text).toContain('Unknown Device');
    });

    it('records the notification as a block', async () => {
      const result = await blocked('DEVICE_PENDING');
      expect(result?.type).toBe('block');
    });

    it('emails the block with the stop code', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_BLOCK');

      await blocked('DEVICE_PENDING');

      expect(emailService.sendBlockedEmail).toHaveBeenCalledWith(
        'testuser',
        'Unknown Device',
        'DEVICE_PENDING',
        '10.0.0.5',
      );
    });

    it('emails N/A when there is no stop code', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_BLOCK');

      await blocked();

      expect(emailService.sendBlockedEmail).toHaveBeenCalledWith(
        'testuser',
        'Unknown Device',
        'N/A',
        '10.0.0.5',
      );
    });

    it('pushes the block through Apprise', async () => {
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_BLOCK');

      await blocked('DEVICE_PENDING');

      expect(appriseService.sendBlockedNotification).toHaveBeenCalledWith(
        'testuser',
        'Unknown Device',
        '10.0.0.5',
        'DEVICE_PENDING',
      );
    });

    it('survives failures from both channels', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_BLOCK');
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_BLOCK');
      emailService.sendBlockedEmail.mockRejectedValue(new Error('no relay'));
      appriseService.sendBlockedNotification.mockRejectedValue(
        new Error('bad url'),
      );

      await expect(blocked('DEVICE_PENDING')).resolves.not.toBeNull();
    });

    it('stores nothing when in-app block notifications are off', async () => {
      enabled.delete('IN_APP_NOTIFY_ON_BLOCK');
      await expect(blocked('DEVICE_PENDING')).resolves.toBeNull();
    });
  });

  describe('createLocationChangeNotification', () => {
    const moved = () =>
      service.createLocationChangeNotification(
        'u1',
        'testuser',
        'Living Room TV',
        '10.0.0.5',
        '203.0.113.9',
        9,
      );

    it('describes the move with an arrow', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_LOCATION_CHANGE');

      const result = await moved();
      expect(result?.text).toBe(
        'Device location changed for testuser on Living Room TV - 10.0.0.5 → 203.0.113.9',
      );
    });

    it('stores nothing when location notifications are off', async () => {
      await expect(moved()).resolves.toBeNull();
    });

    it('emails the move with both addresses', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_LOCATION_CHANGE');

      await moved();

      expect(emailService.sendLocationChangeEmail).toHaveBeenCalledWith(
        'testuser',
        'Living Room TV',
        '10.0.0.5',
        '203.0.113.9',
      );
    });

    it('pushes the move through Apprise', async () => {
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_LOCATION_CHANGE');

      await moved();
      expect(appriseService.sendLocationChangeNotification).toHaveBeenCalled();
    });

    it('survives failures from both channels', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_LOCATION_CHANGE');
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_LOCATION_CHANGE');
      emailService.sendLocationChangeEmail.mockRejectedValue(
        new Error('no relay'),
      );
      appriseService.sendLocationChangeNotification.mockRejectedValue(
        new Error('bad url'),
      );

      await expect(moved()).resolves.toBeNull();
    });
  });

  describe('createDeviceNoteNotification', () => {
    const noted = (note = 'Please approve my tablet') =>
      service.createDeviceNoteNotification(
        'u1',
        'testuser',
        'Living Room TV',
        note,
      );

    it('quotes the note in the message', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_DEVICE_NOTE');

      const result = await noted();
      expect(result?.text).toBe(
        'testuser left a note on Living Room TV: "Please approve my tablet"',
      );
    });

    it('truncates a note longer than 100 characters', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_DEVICE_NOTE');

      const result = await noted('C'.repeat(150));
      expect(result?.text).toContain(`${'C'.repeat(100)}...`);
    });

    it('names a device without a name as unknown', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_DEVICE_NOTE');
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_DEVICE_NOTE');

      const result = await service.createDeviceNoteNotification(
        'u1',
        'testuser',
        null,
        'hello',
      );

      expect(result?.text).toBe(
        'testuser left a note on Unknown Device: "hello"',
      );
      expect(emailService.sendDeviceNoteEmail).toHaveBeenCalledWith(
        'testuser',
        'Unknown Device',
        'hello',
      );
    });

    it('carries no session link', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_DEVICE_NOTE');

      await noted();
      expect(createdNotification().sessionHistoryId).toBeUndefined();
    });

    it('stores nothing when note notifications are off', async () => {
      await expect(noted()).resolves.toBeNull();
    });

    it('emails the untruncated note', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_DEVICE_NOTE');

      await noted('a long note');

      expect(emailService.sendDeviceNoteEmail).toHaveBeenCalledWith(
        'testuser',
        'Living Room TV',
        'a long note',
      );
    });

    it('pushes the note through Apprise', async () => {
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_DEVICE_NOTE');

      await noted();
      expect(appriseService.sendDeviceNoteNotification).toHaveBeenCalled();
    });

    it('survives failures from both channels', async () => {
      enabled.add('SMTP_ENABLED');
      enabled.add('SMTP_NOTIFY_ON_DEVICE_NOTE');
      enabled.add('APPRISE_ENABLED');
      enabled.add('APPRISE_NOTIFY_ON_DEVICE_NOTE');
      emailService.sendDeviceNoteEmail.mockRejectedValue(new Error('no relay'));
      appriseService.sendDeviceNoteNotification.mockRejectedValue(
        new Error('bad url'),
      );

      await expect(noted()).resolves.toBeNull();
    });
  });
});
