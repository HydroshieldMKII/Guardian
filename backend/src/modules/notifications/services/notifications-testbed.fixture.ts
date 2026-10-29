import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '@/entities/notification.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import { EmailService } from '@/modules/config/services/email.service';
import { LiveEventsService } from '@/modules/events/live-events.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { NotificationDispatchService } from '@/modules/notifications/services/notification-dispatch.service';

export interface NotificationsTestbed {
  module: TestingModule;
  enabled: Set<string>;
  notificationRepo: Record<
    | 'create'
    | 'save'
    | 'findOne'
    | 'delete'
    | 'update'
    | 'count'
    | 'clear'
    | 'find',
    jest.Mock
  >;
  historyRepo: { findOne: jest.Mock };
  deviceRepo: { findOne: jest.Mock };
  configService: { getSetting: jest.Mock };
  appriseService: Record<string, jest.Mock>;
  emailService: Record<string, jest.Mock>;
  liveEvents: { hasListeners: jest.Mock; broadcastNotifications: jest.Mock };
}

export const notification = (
  overrides: Partial<Notification> = {},
): Notification =>
  Object.assign(new Notification(), {
    id: 1,
    userId: 'u1',
    text: 'New device detected for testuser',
    type: 'info',
    read: false,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    sessionHistoryId: null,
    ...overrides,
  });

export const createNotificationsTestbed =
  async (): Promise<NotificationsTestbed> => {
    const enabled = new Set<string>();

    const notificationRepo = {
      create: jest.fn((entity: Partial<Notification>) =>
        Object.assign(new Notification(), entity),
      ),
      save: jest.fn((entity: Notification) => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(notification()),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(4),
      clear: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    const historyRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const deviceRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const configService = {
      getSetting: jest.fn((key: string) => Promise.resolve(enabled.has(key))),
    };
    const appriseService = {
      sendNewDeviceNotification: jest.fn().mockResolvedValue(undefined),
      sendBlockedNotification: jest.fn().mockResolvedValue(undefined),
      sendLocationChangeNotification: jest.fn().mockResolvedValue(undefined),
      sendDeviceNoteNotification: jest.fn().mockResolvedValue(undefined),
    };
    const emailService = {
      sendNewDeviceEmail: jest.fn().mockResolvedValue(undefined),
      sendBlockedEmail: jest.fn().mockResolvedValue(undefined),
      sendLocationChangeEmail: jest.fn().mockResolvedValue(undefined),
      sendDeviceNoteEmail: jest.fn().mockResolvedValue(undefined),
    };
    const liveEvents = {
      hasListeners: jest.fn().mockReturnValue(false),
      broadcastNotifications: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        NotificationDispatchService,
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
        { provide: LiveEventsService, useValue: liveEvents },
      ],
    }).compile();

    return {
      module,
      enabled,
      notificationRepo,
      historyRepo,
      deviceRepo,
      configService,
      appriseService,
      emailService,
      liveEvents,
    };
  };
