import { NotFoundException } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import { Notification } from '@/entities/notification.entity';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import {
  createNotificationsTestbed,
  notification,
  NotificationsTestbed,
} from '@/modules/notifications/services/notifications-testbed.fixture';
import { callResult } from '@/test-matchers';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: NotificationsTestbed['notificationRepo'];
  let historyRepo: NotificationsTestbed['historyRepo'];
  let configService: NotificationsTestbed['configService'];
  let liveEvents: NotificationsTestbed['liveEvents'];
  let enabled: Set<string>;

  const createdNotification = (): Notification =>
    callResult<Notification>(notificationRepo.create);

  beforeEach(async () => {
    const testbed = await createNotificationsTestbed();
    ({ notificationRepo, historyRepo, configService, liveEvents, enabled } =
      testbed);
    service = testbed.module.get(NotificationsService);
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

  describe('listing notifications', () => {
    const joined = notification({
      sessionHistory: {
        userPreference: { username: 'testuser' },
        userDevice: { deviceName: 'Living Room TV' },
      },
    } as Partial<Notification>);

    it('resolves the username and device name through the session history', async () => {
      notificationRepo.find.mockResolvedValue([joined]);

      await expect(service.getAllNotifications()).resolves.toEqual([
        expect.objectContaining({
          username: 'testuser',
          deviceName: 'Living Room TV',
        }),
      ]);
    });

    it('falls back to placeholders when there is no session history', async () => {
      notificationRepo.find.mockResolvedValue([notification()]);

      await expect(service.getAllNotifications()).resolves.toEqual([
        expect.objectContaining({
          username: 'Unknown User',
          deviceName: 'Unknown Device',
        }),
      ]);
    });

    it('falls back to placeholders in a user listing too', async () => {
      notificationRepo.find.mockResolvedValue([notification()]);

      await expect(service.getNotificationsForUser('u1')).resolves.toEqual([
        expect.objectContaining({
          username: 'Unknown User',
          deviceName: 'Unknown Device',
        }),
      ]);
    });

    it('resolves names through session history in a user listing', async () => {
      notificationRepo.find.mockResolvedValue([joined]);

      await expect(service.getNotificationsForUser('u1')).resolves.toEqual([
        expect.objectContaining({
          username: 'testuser',
          deviceName: 'Living Room TV',
        }),
      ]);
    });

    it('scopes a user listing to that user, newest first', async () => {
      await service.getNotificationsForUser('u1');

      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        relations: {
          sessionHistory: { userPreference: true, userDevice: true },
        },
        order: { createdAt: 'DESC' },
      });
    });

    it('does not scope the global listing to a user', async () => {
      await service.getAllNotifications();
      expect(notificationRepo.find).toHaveBeenCalledWith({
        relations: {
          sessionHistory: { userPreference: true, userDevice: true },
        },
        order: { createdAt: 'DESC' },
      });
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
      notificationRepo.find.mockResolvedValue([
        notification({ id: 3, text: 'Stream blocked for testuser' }),
        notification({ id: 4, text: 'New device detected for testuser' }),
      ]);

      await service.linkNotificationToSessionHistory('sk-1');

      expect(notificationRepo.update).toHaveBeenCalledWith(4, {
        sessionHistoryId: 5,
      });
    });

    it('links at most one notification', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      notificationRepo.find.mockResolvedValue([
        notification({ id: 4, text: 'New device detected for testuser' }),
        notification({ id: 5, text: 'New device detected for testuser' }),
      ]);

      await service.linkNotificationToSessionHistory('sk-1');
      expect(notificationRepo.update).toHaveBeenCalledTimes(1);
    });

    it('only considers notifications with no session link from the last five minutes', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      const now = new Date('2026-08-01T12:00:00Z');
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
      await service.linkNotificationToSessionHistory('sk-1');
      clock.mockRestore();

      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          sessionHistoryId: IsNull(),
          createdAt: MoreThan(new Date('2026-08-01T11:55:00Z')),
        },
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });

    it('leaves unrelated notifications alone', async () => {
      historyRepo.findOne.mockResolvedValue(history);
      notificationRepo.find.mockResolvedValue([
        notification({ id: 3, text: 'Stream blocked for testuser' }),
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

  describe('live broadcasting', () => {
    it('does not broadcast while nobody is listening', async () => {
      await service.createNotification({ userId: 'u1', text: 'hello' });
      expect(liveEvents.broadcastNotifications).not.toHaveBeenCalled();
    });

    it('broadcasts the refreshed list after a notification is created', async () => {
      liveEvents.hasListeners.mockReturnValue(true);
      notificationRepo.find.mockResolvedValue([notification()]);

      await service.createNotification({ userId: 'u1', text: 'hello' });

      expect(liveEvents.broadcastNotifications).toHaveBeenCalledWith([
        expect.objectContaining({ id: 1, userId: 'u1' }),
      ]);
    });

    it.each([
      ['markAllAsRead', () => service.markAllAsRead()],
      ['clearAll', () => service.clearAll()],
      ['deleteNotification', () => service.deleteNotification(1)],
      ['markAsRead', () => service.markAsRead(1, true)],
    ])('broadcasts after %s', async (_name, run) => {
      liveEvents.hasListeners.mockReturnValue(true);
      await run();
      expect(liveEvents.broadcastNotifications).toHaveBeenCalledTimes(1);
    });

    it('survives a broadcast failure', async () => {
      liveEvents.hasListeners.mockReturnValue(true);
      notificationRepo.find.mockRejectedValue(new Error('db down'));

      await expect(
        service.createNotification({ userId: 'u1', text: 'hello' }),
      ).resolves.toBeDefined();
      expect(liveEvents.broadcastNotifications).not.toHaveBeenCalled();
    });
  });
});
