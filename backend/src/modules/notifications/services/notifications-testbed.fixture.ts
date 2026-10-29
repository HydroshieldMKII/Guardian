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
import type { Mock } from 'vitest';

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
    Mock
  >;
  historyRepo: { findOne: Mock };
  deviceRepo: { findOne: Mock };
  configService: { getSetting: Mock };
  appriseService: Record<string, Mock>;
  emailService: Record<string, Mock>;
  liveEvents: { hasListeners: Mock; broadcastNotifications: Mock };
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
      create: vi.fn((entity: Partial<Notification>) =>
        Object.assign(new Notification(), entity),
      ),
      save: vi.fn((entity: Notification) => Promise.resolve(entity)),
      findOne: vi.fn().mockResolvedValue(notification()),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      count: vi.fn().mockResolvedValue(4),
      clear: vi.fn().mockResolvedValue(undefined),
      find: vi.fn().mockResolvedValue([]),
    };
    const historyRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const deviceRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const configService = {
      getSetting: vi.fn((key: string) => Promise.resolve(enabled.has(key))),
    };
    const appriseService = {
      sendNewDeviceNotification: vi.fn().mockResolvedValue(undefined),
      sendBlockedNotification: vi.fn().mockResolvedValue(undefined),
      sendLocationChangeNotification: vi.fn().mockResolvedValue(undefined),
      sendDeviceNoteNotification: vi.fn().mockResolvedValue(undefined),
    };
    const emailService = {
      sendNewDeviceEmail: vi.fn().mockResolvedValue(undefined),
      sendBlockedEmail: vi.fn().mockResolvedValue(undefined),
      sendLocationChangeEmail: vi.fn().mockResolvedValue(undefined),
      sendDeviceNoteEmail: vi.fn().mockResolvedValue(undefined),
    };
    const liveEvents = {
      hasListeners: vi.fn().mockReturnValue(false),
      broadcastNotifications: vi.fn(),
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
