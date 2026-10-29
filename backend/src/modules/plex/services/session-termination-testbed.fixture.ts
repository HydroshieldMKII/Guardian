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

export interface SessionOverrides {
  id?: string;
  sessionKey?: string;
  userId?: string;
  username?: string;
  machineIdentifier?: string;
  product?: string;
  address?: string;
  title?: string;
}

export interface SessionTerminationTestbed {
  module: TestingModule;
  deviceRepo: { findOne: jest.Mock };
  historyRepo: { findOne: jest.Mock };
  preferenceRepo: { findOne: jest.Mock };
  plexClient: { terminateSession: jest.Mock; getSessions: jest.Mock };
  usersService: { getEffectiveDefaultBlock: jest.Mock };
  timePolicyService: Record<string, jest.Mock>;
  concurrentStreamService: Record<string, jest.Mock>;
  configService: { getSetting: jest.Mock };
  temporaryAccessService: { isTemporaryAccessValid: jest.Mock };
  ipValidationService: { validateIPAccess: jest.Mock };
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
}: SessionOverrides = {}) => ({
  sessionKey,
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
      findOne: jest.fn().mockResolvedValue(approvedDevice()),
    };
    const historyRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const preferenceRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const plexClient = {
      terminateSession: jest.fn().mockResolvedValue(undefined),
      getSessions: jest.fn().mockResolvedValue({}),
    };
    const usersService = {
      getEffectiveDefaultBlock: jest.fn().mockResolvedValue(true),
    };
    const timePolicyService = {
      isTimeScheduleAllowed: jest.fn().mockResolvedValue(true),
      getPolicySummary: jest.fn().mockResolvedValue('always allowed'),
    };
    const concurrentStreamService = {
      getEffectiveLimit: jest.fn().mockResolvedValue(0),
      filterCountableSessions: jest.fn((_userId: string, sessions: unknown[]) =>
        Promise.resolve(sessions),
      ),
    };
    const configService = {
      getSetting: jest.fn((key: string) => Promise.resolve(`msg:${key}`)),
    };
    const temporaryAccessService = {
      isTemporaryAccessValid: jest.fn().mockResolvedValue(false),
    };
    const ipValidationService = {
      validateIPAccess: jest.fn().mockReturnValue({ allowed: true }),
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
    };
  };
