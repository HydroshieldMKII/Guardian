import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../../../entities/notification.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ConfigService } from '../../config/services/config.service';
import { AppriseService } from '../../config/services/apprise.service';
import { EmailService } from '../../config/services/email.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: Record<string, jest.Mock>;
  let historyRepo: { findOne: jest.Mock };
  let deviceRepo: { findOne: jest.Mock };
  let configService: { getSetting: jest.Mock };
  let appriseService: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let queryBuilder: Record<string, jest.Mock>;

  const enabled = new Set<string>();

  const notification = (overrides: Partial<Notification> = {}): Notification =>
    Object.assign(new Notification(), {
      id: 1,
      userId: 'u1',
      text: 'New device detected for vincent',
      type: 'info',
      read: false,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      sessionHistoryId: null,
      ...overrides,
    });

  const createdNotification = (): Notification =>
    notificationRepo.create.mock.results[0].value;

  beforeEach(async () => {
    enabled.clear();

    queryBuilder = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    for (const key of [
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'limit',
    ]) {
      queryBuilder[key].mockReturnValue(queryBuilder);
    }

    notificationRepo = {
      create: jest.fn((entity: Partial<Notification>) =>
        Object.assign(new Notification(), entity),
      ),
      save: jest.fn((entity: Notification) => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(notification()),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(4),
      clear: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    historyRepo = { findOne: jest.fn().mockResolvedValue(null) };
    deviceRepo = { findOne: jest.fn().mockResolvedValue(null) };

    configService = {
      getSetting: jest.fn((key: string) => Promise.resolve(enabled.has(key))),
    };

    appriseService = {
      sendNewDeviceNotification: jest.fn().mockResolvedValue(undefined),
      sendBlockedNotification: jest.fn().mockResolvedValue(undefined),
      sendLocationChangeNotification: jest.fn().mockResolvedValue(undefined),
      sendDeviceNoteNotification: jest.fn().mockResolvedValue(undefined),
    };

    emailService = {
      sendNewDeviceEmail: jest.fn().mockResolvedValue(undefined),
      sendBlockedEmail: jest.fn().mockResolvedValue(undefined),
      sendLocationChangeEmail: jest.fn().mockResolvedValue(undefined),
      sendDeviceNoteEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepo,
        },
        {
          provide: getRepositoryToken(SessionHistory),
          useValue: historyRepo,
        },
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: ConfigService, useValue: configService },
        { provide: AppriseService, useValue: appriseService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('createNotification', () => {
    it('defaults an unspecified type to info and marks it unread', async () => {
      await service.createNotification({ userId: 'u1', text: 'hello' });

      expect(createdNotification()).toMatchObject({
        userId: 'u1',
        text: 'hello',
        type: 'info',
        read: false,
      });
    });

    it('keeps an explicit type and session link', async () => {
      await service.createNotification({
        userId: 'u1',
        text: 'blocked',
        type: 'block',
        sessionHistoryId: 9,
      });

      expect(createdNotification()).toMatchObject({
        type: 'block',
        sessionHistoryId: 9,
      });
    });
  });

  describe('createNewDeviceNotification', () => {
    const notify = () =>
      service.createNewDeviceNotification(
        'u1',
        'vincent',
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
        text: 'New device detected for vincent on Living Room TV - 10.0.0.5',
      });
    });

    it('truncates a very long device name in the message', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_NEW_DEVICE');

      const result = await service.createNewDeviceNotification(
        'u1',
        'vincent',
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
        'vincent',
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
        'vincent',
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
        'vincent',
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
      expect(result?.text).toBe('Stream blocked for vincent on Unknown Device');
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
        'vincent',
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
        'vincent',
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
        'vincent',
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
        'vincent',
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
        'Device location changed for vincent on Living Room TV - 10.0.0.5 → 203.0.113.9',
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
        'vincent',
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
        'vincent',
        'Living Room TV',
        note,
      );

    it('quotes the note in the message', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_DEVICE_NOTE');

      const result = await noted();
      expect(result?.text).toBe(
        'vincent left a note on Living Room TV: "Please approve my tablet"',
      );
    });

    it('truncates a note longer than 100 characters', async () => {
      enabled.add('IN_APP_ENABLED');
      enabled.add('IN_APP_NOTIFY_ON_DEVICE_NOTE');

      const result = await noted('C'.repeat(150));
      expect(result?.text).toContain(`${'C'.repeat(100)}...`);
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
        'vincent',
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

  describe('listing notifications', () => {
    const joined = notification({
      sessionHistory: {
        userPreference: { username: 'vincent' },
        userDevice: { deviceName: 'Living Room TV' },
      },
    } as Partial<Notification>);

    it('resolves the username and device name through the session history', async () => {
      queryBuilder.getMany.mockResolvedValue([joined]);

      await expect(service.getAllNotifications()).resolves.toEqual([
        expect.objectContaining({
          username: 'vincent',
          deviceName: 'Living Room TV',
        }),
      ]);
    });

    it('falls back to placeholders when there is no session history', async () => {
      queryBuilder.getMany.mockResolvedValue([notification()]);

      await expect(service.getAllNotifications()).resolves.toEqual([
        expect.objectContaining({
          username: 'Unknown User',
          deviceName: 'Unknown Device',
        }),
      ]);
    });

    it('scopes a user listing to that user, newest first', async () => {
      await service.getNotificationsForUser('u1');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'notification.userId = :userId',
        { userId: 'u1' },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'notification.createdAt',
        'DESC',
      );
    });

    it('does not scope the global listing to a user', async () => {
      await service.getAllNotifications();
      expect(queryBuilder.where).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('refuses an unknown notification', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      await expect(service.markAsRead(1)).rejects.toThrow(NotFoundException);
    });

    it('marks it read when auto-marking is enabled', async () => {
      enabled.add('AUTO_MARK_NOTIFICATION_READ');
      await expect(service.markAsRead(1)).resolves.toMatchObject({
        read: true,
      });
    });

    it('leaves it unread when auto-marking is disabled', async () => {
      const result = await service.markAsRead(1);

      expect(result.read).toBe(false);
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('marks it read anyway when forced', async () => {
      await expect(service.markAsRead(1, true)).resolves.toMatchObject({
        read: true,
      });
      expect(configService.getSetting).not.toHaveBeenCalled();
    });
  });

  describe('deleting and counting', () => {
    it('deletes a notification', async () => {
      await expect(service.deleteNotification(1)).resolves.toBeUndefined();
    });

    it('refuses to delete one that does not exist', async () => {
      notificationRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteNotification(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('counts a user’s unread notifications', async () => {
      await expect(service.getUnreadCountForUser('u1')).resolves.toBe(4);
      expect(notificationRepo.count).toHaveBeenCalledWith({
        where: { userId: 'u1', read: false },
      });
    });

    it('marks every unread notification as read', async () => {
      await service.markAllAsRead();
      expect(notificationRepo.update).toHaveBeenCalledWith(
        { read: false },
        { read: true },
      );
    });

    it('clears the whole table', async () => {
      await service.clearAll();
      expect(notificationRepo.clear).toHaveBeenCalled();
    });
  });

  describe('linkNotificationToSessionHistory', () => {
    const history = { id: 5, userId: 'u1' };

    it('does nothing when no session history matches the key', async () => {
      await service.linkNotificationToSessionHistory('sk-1');
      expect(notificationRepo.update).not.toHaveBeenCalled();
    });

    it('links the recent new-device notification', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      queryBuilder.getMany.mockResolvedValue([
        notification({ id: 3, text: 'Stream blocked for vincent' }),
        notification({ id: 4, text: 'New device detected for vincent' }),
      ]);

      await service.linkNotificationToSessionHistory('sk-1');

      expect(notificationRepo.update).toHaveBeenCalledWith(4, {
        sessionHistoryId: 5,
      });
    });

    it('links at most one notification', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      queryBuilder.getMany.mockResolvedValue([
        notification({ id: 4, text: 'New device detected for vincent' }),
        notification({ id: 5, text: 'New device detected for vincent' }),
      ]);

      await service.linkNotificationToSessionHistory('sk-1');
      expect(notificationRepo.update).toHaveBeenCalledTimes(1);
    });

    it('only considers notifications with no session link from the last five minutes', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      await service.linkNotificationToSessionHistory('sk-1');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.sessionHistoryId IS NULL',
      );
      expect(queryBuilder.limit).toHaveBeenCalledWith(5);
    });

    it('leaves unrelated notifications alone', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      queryBuilder.getMany.mockResolvedValue([
        notification({ id: 3, text: 'Stream blocked for vincent' }),
      ]);

      await service.linkNotificationToSessionHistory('sk-1');
      expect(notificationRepo.update).not.toHaveBeenCalled();
    });

    it('swallows a database failure', async () => {
      historyRepo.findOne.mockRejectedValue(new Error('db down'));
      await expect(
        service.linkNotificationToSessionHistory('sk-1'),
      ).resolves.toBeUndefined();
    });
  });
});
