import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { PlexSessionsResponse } from '@/types/plex.types';
import { IPValidationService } from '@/common/services/ip-validation.service';
import { UsersService } from '@/modules/users/services/users.service';
import { TimePolicyService } from '@/modules/users/services/time-policy.service';
import { ConcurrentStreamService } from '@/modules/users/services/concurrent-stream.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { SessionTerminationService } from '@/modules/plex/services/session-termination.service';
import { SessionPolicyService } from '@/modules/plex/services/session-policy.service';
import { ConcurrentLimitService } from '@/modules/plex/services/concurrent-limit.service';
import { SessionHistoryService } from '@/modules/sessions/services/session-history.service';
import type { Mock } from 'vitest';

export interface SessionOverrides {
  id?: string;
  sessionKey?: string;
  userId?: string;
  username?: string;
  machineIdentifier?: string;
  product?: string;
  address?: string;
  title?: string;
  type?: string;
}

export interface SessionTerminationTestbed {
  module: TestingModule;
  deviceRepo: { findOne: Mock };
  historyRepo: { findOne: Mock };
  preferenceRepo: { findOne: Mock };
  plexClient: { terminateSession: Mock; getSessions: Mock };
  usersService: { getEffectiveDefaultBlock: Mock };
  timePolicyService: Record<string, Mock>;
  concurrentStreamService: Record<string, Mock>;
  configService: { getSetting: Mock };
  temporaryAccessService: { isTemporaryAccessValid: Mock };
  ipValidationService: { validateIPAccess: Mock };
  sessionHistory: { markTerminated: Mock };
}

export const session = ({
  id = 'session-1',
  sessionKey = 'sk-1',
  userId = 'u1',
  username = 'testuser',
  machineIdentifier = 'dev-1',
  product = 'Plex for Android',
  address = '10.0.0.5',
  title = 'Living Room TV',
  type,
}: SessionOverrides = {}) => ({
  sessionKey,
  type,
  Session: { id },
  User: { id: userId, title: username },
  Player: { machineIdentifier, product, address, title },
});

export const payload = (
  ...sessions: ReturnType<typeof session>[]
): PlexSessionsResponse => ({
  MediaContainer: { size: sessions.length, Metadata: sessions },
});

export const approvedDevice = (overrides: Partial<UserDevice> = {}) =>
  Object.assign(new UserDevice(), {
    id: 1,
    userId: 'u1',
    deviceIdentifier: 'dev-1',
    status: 'approved',
    temporaryAccessUntil: null,
    temporaryAccessBypassPolicies: false,
    ...overrides,
  });

export const createSessionTerminationTestbed =
  async (): Promise<SessionTerminationTestbed> => {
    const deviceRepo = {
      findOne: vi.fn().mockResolvedValue(approvedDevice()),
    };
    const historyRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const preferenceRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const plexClient = {
      terminateSession: vi.fn().mockResolvedValue(undefined),
      getSessions: vi.fn().mockResolvedValue({}),
    };
    const usersService = {
      getEffectiveDefaultBlock: vi.fn().mockResolvedValue(true),
    };
    const timePolicyService = {
      isTimeScheduleAllowed: vi.fn().mockResolvedValue(true),
      getPolicySummary: vi.fn().mockResolvedValue('always allowed'),
    };
    const concurrentStreamService = {
      getEffectiveLimit: vi.fn().mockResolvedValue(0),
      filterCountableSessions: vi.fn((_userId: string, sessions: unknown[]) =>
        Promise.resolve(sessions),
      ),
    };
    const configService = {
      getSetting: vi.fn((key: string) => Promise.resolve(`msg:${key}`)),
    };
    const temporaryAccessService = {
      isTemporaryAccessValid: vi.fn().mockResolvedValue(false),
    };
    const ipValidationService = {
      validateIPAccess: vi.fn().mockReturnValue({ allowed: true }),
    };
    const sessionHistory = {
      markTerminated: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        SessionTerminationService,
        SessionPolicyService,
        ConcurrentLimitService,
        { provide: getRepositoryToken(UserDevice), useValue: deviceRepo },
        { provide: getRepositoryToken(SessionHistory), useValue: historyRepo },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepo,
        },
        { provide: PlexClient, useValue: plexClient },
        { provide: UsersService, useValue: usersService },
        { provide: TimePolicyService, useValue: timePolicyService },
        {
          provide: ConcurrentStreamService,
          useValue: concurrentStreamService,
        },
        { provide: ConfigService, useValue: configService },
        { provide: TemporaryAccessService, useValue: temporaryAccessService },
        { provide: IPValidationService, useValue: ipValidationService },
        { provide: SessionHistoryService, useValue: sessionHistory },
      ],
    }).compile();

    return {
      module,
      deviceRepo,
      historyRepo,
      preferenceRepo,
      plexClient,
      usersService,
      timePolicyService,
      concurrentStreamService,
      configService,
      temporaryAccessService,
      ipValidationService,
      sessionHistory,
    };
  };
