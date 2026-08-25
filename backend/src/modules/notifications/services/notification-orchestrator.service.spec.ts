import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { NotificationOrchestratorService } from '@/modules/notifications/services/notification-orchestrator.service';

const history = (overrides: Partial<SessionHistory> = {}): SessionHistory =>
  Object.assign(new SessionHistory(), {
    id: 10,
    sessionKey: 'session-1',
    terminated: false,
    ...overrides,
  });

describe('NotificationOrchestratorService', () => {
  let service: NotificationOrchestratorService;
  let sessionHistoryRepository: jest.Mocked<Repository<SessionHistory>>;
  let notificationsService: {
    createNewDeviceNotification: jest.Mock;
    createStreamBlockedNotification: jest.Mock;
    createLocationChangeNotification: jest.Mock;
    linkNotificationToSessionHistory: jest.Mock;
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    sessionHistoryRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((value: SessionHistory) => Promise.resolve(value)),
    } as unknown as jest.Mocked<Repository<SessionHistory>>;

    notificationsService = {
      createNewDeviceNotification: jest.fn().mockResolvedValue({ id: 1 }),
      createStreamBlockedNotification: jest.fn().mockResolvedValue({ id: 2 }),
      createLocationChangeNotification: jest.fn().mockResolvedValue({ id: 3 }),
      linkNotificationToSessionHistory: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationOrchestratorService,
        {
          provide: getRepositoryToken(SessionHistory),
          useValue: sessionHistoryRepository,
        },
        { provide: getRepositoryToken(UserDevice), useValue: {} },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(NotificationOrchestratorService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('notifyNewDevice', () => {
    const data = {
      userId: 'u1',
      username: 'alice',
      deviceName: 'TV',
      ipAddress: '10.0.0.5',
    };

    it('delegates to the notifications service', async () => {
      await service.notifyNewDevice(data);
      expect(
        notificationsService.createNewDeviceNotification,
      ).toHaveBeenCalledWith('u1', 'alice', 'TV', '10.0.0.5', undefined);
    });

    it('returns the created notification', async () => {
      await expect(service.notifyNewDevice(data)).resolves.toEqual({ id: 1 });
    });

    it('substitutes placeholders for details Plex never reported', async () => {
      await service.notifyNewDevice({
        userId: 'u1',
        username: null,
        deviceName: null,
        ipAddress: null,
      });

      expect(
        notificationsService.createNewDeviceNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'Unknown User',
        'Unknown Device',
        'Unknown IP',
        undefined,
      );
    });

    it('rethrows a downstream failure', async () => {
      notificationsService.createNewDeviceNotification.mockRejectedValue(
        new Error('db down'),
      );
      await expect(service.notifyNewDevice(data)).rejects.toThrow('db down');
    });
  });

  describe('notifyStreamBlocked', () => {
    const data = {
      userId: 'u1',
      username: 'alice',
      deviceIdentifier: 'device-a',
      stopCode: 'DEVICE_PENDING',
    };

    it('creates the notification without a session key', async () => {
      await service.notifyStreamBlocked(data);
      expect(
        notificationsService.createStreamBlockedNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'alice',
        'device-a',
        'DEVICE_PENDING',
        undefined,
        undefined,
      );
    });

    it('links the session history when a key resolves', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(history());

      await service.notifyStreamBlocked({ ...data, sessionKey: 'session-1' });

      expect(
        notificationsService.createStreamBlockedNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'alice',
        'device-a',
        'DEVICE_PENDING',
        10,
        undefined,
      );
    });

    it('marks the located session as terminated', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(history());

      await service.notifyStreamBlocked({ ...data, sessionKey: 'session-1' });

      expect(sessionHistoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ terminated: true }),
      );
    });

    it('retries the lookup once before giving up', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(null);

      const pending = service.notifyStreamBlocked({
        ...data,
        sessionKey: 'session-1',
      });
      await jest.advanceTimersByTimeAsync(1000);
      await pending;

      expect(sessionHistoryRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('finds the session on the retry', async () => {
      sessionHistoryRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(history())
        .mockResolvedValue(history());

      const pending = service.notifyStreamBlocked({
        ...data,
        sessionKey: 'session-1',
      });
      await jest.advanceTimersByTimeAsync(1000);
      await pending;

      expect(
        notificationsService.createStreamBlockedNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'alice',
        'device-a',
        'DEVICE_PENDING',
        10,
        undefined,
      );
    });

    it('still notifies when the lookup fails', async () => {
      sessionHistoryRepository.findOne.mockRejectedValue(new Error('db down'));

      await service.notifyStreamBlocked({ ...data, sessionKey: 'session-1' });

      expect(
        notificationsService.createStreamBlockedNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'alice',
        'device-a',
        'DEVICE_PENDING',
        undefined,
        undefined,
      );
    });

    it('rethrows a notification failure', async () => {
      notificationsService.createStreamBlockedNotification.mockRejectedValue(
        new Error('boom'),
      );
      await expect(service.notifyStreamBlocked(data)).rejects.toThrow('boom');
    });
  });

  describe('placeholder substitution', () => {
    it('substitutes placeholders on a blocked stream', async () => {
      await service.notifyStreamBlocked({
        userId: 'u1',
        username: null,
        deviceIdentifier: 'dev-1',
      });

      expect(
        notificationsService.createStreamBlockedNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'Unknown User',
        'dev-1',
        undefined,
        undefined,
        undefined,
      );
    });

    it('substitutes placeholders on a location change', async () => {
      await service.notifyLocationChange({
        userId: 'u1',
        username: null,
        deviceName: null,
        oldIpAddress: null,
        newIpAddress: null,
      });

      expect(
        notificationsService.createLocationChangeNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'Unknown User',
        'Unknown Device',
        'Unknown IP',
        'Unknown IP',
        undefined,
      );
    });
  });

  describe('notifyLocationChange', () => {
    const data = {
      userId: 'u1',
      username: 'alice',
      deviceName: 'TV',
      oldIpAddress: '10.0.0.5',
      newIpAddress: '8.8.8.8',
    };

    it('creates the notification without a session key', async () => {
      await service.notifyLocationChange(data);
      expect(
        notificationsService.createLocationChangeNotification,
      ).toHaveBeenCalledWith(
        'u1',
        'alice',
        'TV',
        '10.0.0.5',
        '8.8.8.8',
        undefined,
      );
    });

    it('attaches the session history when available', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(history());

      await service.notifyLocationChange({ ...data, sessionKey: 'session-1' });

      expect(
        notificationsService.createLocationChangeNotification,
      ).toHaveBeenCalledWith('u1', 'alice', 'TV', '10.0.0.5', '8.8.8.8', 10);
    });

    it('does not mark the session terminated', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(history());
      await service.notifyLocationChange({ ...data, sessionKey: 'session-1' });
      expect(sessionHistoryRepository.save).not.toHaveBeenCalled();
    });

    it('rethrows a notification failure', async () => {
      notificationsService.createLocationChangeNotification.mockRejectedValue(
        new Error('boom'),
      );
      await expect(service.notifyLocationChange(data)).rejects.toThrow('boom');
    });
  });

  describe('linkOrphanedNotifications', () => {
    it('links when the session history exists', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(history());

      await service.linkOrphanedNotifications('session-1');

      expect(
        notificationsService.linkNotificationToSessionHistory,
      ).toHaveBeenCalledWith('session-1');
    });

    it('does nothing when no session history exists', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(null);

      await service.linkOrphanedNotifications('session-1');

      expect(
        notificationsService.linkNotificationToSessionHistory,
      ).not.toHaveBeenCalled();
    });

    it('swallows a repository failure', async () => {
      sessionHistoryRepository.findOne.mockRejectedValue(new Error('db down'));
      await expect(
        service.linkOrphanedNotifications('session-1'),
      ).resolves.toBeUndefined();
    });

    it('swallows a linking failure', async () => {
      sessionHistoryRepository.findOne.mockResolvedValue(history());
      notificationsService.linkNotificationToSessionHistory.mockRejectedValue(
        new Error('boom'),
      );
      await expect(
        service.linkOrphanedNotifications('session-1'),
      ).resolves.toBeUndefined();
    });
  });
});
