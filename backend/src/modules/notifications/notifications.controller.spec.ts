import { Test } from '@nestjs/testing';
import { NotificationsController } from '@/modules/notifications/notifications.controller';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import type { Mock } from 'vitest';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: Record<string, Mock>;

  beforeEach(async () => {
    notificationsService = {
      getAllNotifications: vi.fn().mockResolvedValue([{ id: 1 }]),
      getNotificationsForUser: vi.fn().mockResolvedValue([{ id: 2 }]),
      getUnreadCountForUser: vi.fn().mockResolvedValue(4),
      markAsRead: vi.fn().mockResolvedValue({ id: 1, read: true }),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
      clearAll: vi.fn().mockResolvedValue(undefined),
      deleteNotification: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get(NotificationsController);
  });

  it('lists every notification', async () => {
    await expect(controller.getAllNotifications()).resolves.toEqual([
      { id: 1 },
    ]);
  });

  it('lists a single user’s notifications', async () => {
    await expect(controller.getNotificationsForUser('u1')).resolves.toEqual([
      { id: 2 },
    ]);
    expect(notificationsService.getNotificationsForUser).toHaveBeenCalledWith(
      'u1',
    );
  });

  it('wraps the unread count in an object', async () => {
    await expect(controller.getUnreadCount('u1')).resolves.toEqual({
      unreadCount: 4,
    });
  });

  it('marks one notification as read without forcing', async () => {
    await controller.markAsRead(1);
    expect(notificationsService.markAsRead).toHaveBeenCalledWith(1);
  });

  it('forces a notification to read when asked', async () => {
    await controller.markAsReadForced(1);
    expect(notificationsService.markAsRead).toHaveBeenCalledWith(1, true);
  });

  it('marks everything as read', async () => {
    await expect(controller.markAllAsRead()).resolves.toEqual({
      message: 'All notifications marked as read',
    });
  });

  it('clears everything', async () => {
    await expect(controller.clearAll()).resolves.toEqual({
      message: 'All notifications cleared',
    });
  });

  it('deletes one notification', async () => {
    await expect(controller.deleteNotification(9)).resolves.toEqual({
      message: 'Notification deleted successfully',
    });
    expect(notificationsService.deleteNotification).toHaveBeenCalledWith(9);
  });
});
