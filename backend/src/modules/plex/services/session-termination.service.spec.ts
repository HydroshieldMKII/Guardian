import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { PlexSessionsResponse } from '../../../types/plex.types';
import { IPValidationService } from '../../../common/services/ip-validation.service';
import { UsersService } from '../../users/services/users.service';
import { TimePolicyService } from '../../users/services/time-policy.service';
import { ConcurrentStreamService } from '../../users/services/concurrent-stream.service';
import { ConfigService } from '../../config/services/config.service';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import { PlexClient } from './plex-client';
import { SessionTerminationService } from './session-termination.service';

interface SessionOverrides {
  id?: string;
  sessionKey?: string;
  userId?: string;
  username?: string;
  machineIdentifier?: string;
  product?: string;
  address?: string;
  title?: string;
}

describe('SessionTerminationService', () => {
  let service: SessionTerminationService;
  let deviceRepo: { findOne: jest.Mock };
  let historyRepo: { findOne: jest.Mock };
  let preferenceRepo: { findOne: jest.Mock };
  let plexClient: { terminateSession: jest.Mock };
  let usersService: { getEffectiveDefaultBlock: jest.Mock };
  let timePolicyService: Record<string, jest.Mock>;
  let concurrentStreamService: Record<string, jest.Mock>;
  let configService: { getSetting: jest.Mock };
  let deviceTrackingService: { isTemporaryAccessValid: jest.Mock };
  let ipValidationService: { validateIPAccess: jest.Mock };

  const session = ({
    id = 'session-1',
    sessionKey = 'sk-1',
    userId = 'u1',
    username = 'vincent',
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

  const payload = (
    ...sessions: ReturnType<typeof session>[]
  ): PlexSessionsResponse => ({
    MediaContainer: { size: sessions.length, Metadata: sessions },
  });

  const approvedDevice = (overrides: Partial<UserDevice> = {}) =>
    Object.assign(new UserDevice(), {
      id: 1,
      userId: 'u1',
      deviceIdentifier: 'dev-1',
      status: 'approved',
      temporaryAccessUntil: null,
      temporaryAccessBypassPolicies: false,
      ...overrides,
    });

  beforeEach(async () => {
    deviceRepo = { findOne: jest.fn().mockResolvedValue(approvedDevice()) };
    historyRepo = { findOne: jest.fn().mockResolvedValue(null) };
    preferenceRepo = { findOne: jest.fn().mockResolvedValue(null) };
    plexClient = { terminateSession: jest.fn().mockResolvedValue(undefined) };
    usersService = {
      getEffectiveDefaultBlock: jest.fn().mockResolvedValue(true),
    };
    timePolicyService = {
      isTimeScheduleAllowed: jest.fn().mockResolvedValue(true),
      getPolicySummary: jest.fn().mockResolvedValue('always allowed'),
    };
    concurrentStreamService = {
      getEffectiveLimit: jest.fn().mockResolvedValue(0),
      filterCountableSessions: jest.fn((_userId: string, sessions: unknown[]) =>
        Promise.resolve(sessions),
      ),
    };
    configService = {
      getSetting: jest.fn((key: string) => Promise.resolve(`msg:${key}`)),
    };
    deviceTrackingService = {
      isTemporaryAccessValid: jest.fn().mockResolvedValue(false),
    };
    ipValidationService = {
      validateIPAccess: jest.fn().mockReturnValue({ allowed: true }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SessionTerminationService,
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
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
        { provide: IPValidationService, useValue: ipValidationService },
      ],
    }).compile();

    service = module.get(SessionTerminationService);
  });

  describe('stopUnapprovedSessions', () => {
    it('does nothing when there are no sessions', async () => {
      await expect(service.stopUnapprovedSessions(payload())).resolves.toEqual({
        stoppedSessions: [],
        errors: [],
      });
      expect(plexClient.terminateSession).not.toHaveBeenCalled();
    });

    it('tolerates a payload with no media container', async () => {
      await expect(service.stopUnapprovedSessions({})).resolves.toEqual({
        stoppedSessions: [],
        errors: [],
      });
    });

    it('leaves an approved session running', async () => {
      const result = await service.stopUnapprovedSessions(payload(session()));

      expect(result.stoppedSessions).toEqual([]);
      expect(plexClient.terminateSession).not.toHaveBeenCalled();
    });

    it('terminates a rejected device and reports it', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      const result = await service.stopUnapprovedSessions(payload(session()));

      expect(result.stoppedSessions).toEqual(['session-1']);
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        'msg:MSG_DEVICE_REJECTED',
      );
    });

    it('notifies listeners about a blocked stream', async () => {
      const listener = jest.fn();
      service.onStreamBlocked(listener);
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      await service.stopUnapprovedSessions(payload(session()));

      expect(listener).toHaveBeenCalledWith({
        userId: 'u1',
        username: 'vincent',
        deviceIdentifier: 'dev-1',
        stopCode: 'DEVICE_REJECTED',
        sessionKey: 'sk-1',
        ipAddress: '10.0.0.5',
      });
    });

    it('keeps notifying the other listeners when one throws', async () => {
      const survivor = jest.fn();
      service.onStreamBlocked(() => {
        throw new Error('listener blew up');
      });
      service.onStreamBlocked(survivor);
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      await service.stopUnapprovedSessions(payload(session()));
      expect(survivor).toHaveBeenCalled();
    });

    it('collects a per-session error without abandoning the sweep', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );
      plexClient.terminateSession
        .mockRejectedValueOnce(new Error('plex offline'))
        .mockResolvedValueOnce(undefined);

      const result = await service.stopUnapprovedSessions(
        payload(
          session({ id: 'session-1' }),
          session({ id: 'session-2', sessionKey: 'sk-2' }),
        ),
      );

      expect(result.errors).toEqual([
        'Error processing session sk-1: plex offline',
      ]);
      expect(result.stoppedSessions).toEqual(['session-2']);
    });

    it('skips a session Plex gave no identifier for', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );
      const orphan = session();
      delete (orphan as { Session?: unknown }).Session;

      const result = await service.stopUnapprovedSessions(payload(orphan));

      expect(result.stoppedSessions).toEqual([]);
      expect(plexClient.terminateSession).not.toHaveBeenCalled();
    });

    it('rethrows when the sweep itself fails', async () => {
      concurrentStreamService.getEffectiveLimit.mockImplementation(() => {
        throw new Error('boom');
      });
      const broken = payload(session());
      Object.defineProperty(broken.MediaContainer!, 'Metadata', {
        get() {
          throw new Error('unreadable payload');
        },
      });

      await expect(service.stopUnapprovedSessions(broken)).rejects.toThrow(
        'unreadable payload',
      );
    });
  });

  describe('device approval', () => {
    it('blocks a pending device when the user default is block', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );

      const result = await service.stopUnapprovedSessions(payload(session()));

      expect(result.stoppedSessions).toEqual(['session-1']);
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        'msg:MSG_DEVICE_PENDING',
      );
    });

    it('allows a pending device when the user default is allow', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );
      usersService.getEffectiveDefaultBlock.mockResolvedValue(false);

      const result = await service.stopUnapprovedSessions(payload(session()));
      expect(result.stoppedSessions).toEqual([]);
    });

    it('treats an untracked device as pending', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      const result = await service.stopUnapprovedSessions(payload(session()));
      expect(result.stoppedSessions).toEqual(['session-1']);
    });

    it('allows a pending device holding temporary access', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );
      deviceTrackingService.isTemporaryAccessValid.mockResolvedValue(true);

      const result = await service.stopUnapprovedSessions(payload(session()));
      expect(result.stoppedSessions).toEqual([]);
    });

    it('allows a rejected device holding temporary access', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );
      deviceTrackingService.isTemporaryAccessValid.mockResolvedValue(true);

      const result = await service.stopUnapprovedSessions(payload(session()));
      expect(result.stoppedSessions).toEqual([]);
    });

    it('skips every policy for a device granted a policy bypass', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({
          status: 'rejected',
          temporaryAccessBypassPolicies: true,
        }),
      );
      deviceTrackingService.isTemporaryAccessValid.mockResolvedValue(true);
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);

      const result = await service.stopUnapprovedSessions(payload(session()));

      expect(result.stoppedSessions).toEqual([]);
      expect(timePolicyService.isTimeScheduleAllowed).not.toHaveBeenCalled();
    });

    it('never touches a Plexamp session', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      const result = await service.stopUnapprovedSessions(
        payload(session({ product: 'Plexamp' })),
      );

      expect(result.stoppedSessions).toEqual([]);
    });

    it('leaves a session with no user or device identifier alone', async () => {
      const anonymous = session();
      delete (anonymous as { User?: unknown }).User;

      const result = await service.stopUnapprovedSessions(payload(anonymous));
      expect(result.stoppedSessions).toEqual([]);
    });

    it('allows the session when the policy check itself fails', async () => {
      deviceRepo.findOne.mockRejectedValue(new Error('db down'));

      const result = await service.stopUnapprovedSessions(payload(session()));
      expect(result.stoppedSessions).toEqual([]);
    });
  });

  describe('time policies', () => {
    it('blocks a session outside the allowed schedule', async () => {
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);

      const result = await service.stopUnapprovedSessions(payload(session()));

      expect(result.stoppedSessions).toEqual(['session-1']);
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        'msg:MSG_TIME_RESTRICTED',
      );
    });

    it('falls back to a message naming the policy when none is configured', async () => {
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);
      configService.getSetting.mockResolvedValue('');

      await service.stopUnapprovedSessions(payload(session()));

      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        expect.stringContaining('always allowed'),
      );
    });

    it('reports a time block with its own stop code', async () => {
      const listener = jest.fn();
      service.onStreamBlocked(listener);
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);

      await service.stopUnapprovedSessions(payload(session()));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ stopCode: 'TIME_RESTRICTED' }),
      );
    });
  });

  describe('IP policies', () => {
    it('does not consult the validator for a user with no preferences', async () => {
      await service.stopUnapprovedSessions(payload(session()));
      expect(ipValidationService.validateIPAccess).not.toHaveBeenCalled();
    });

    it('passes the stored policy and custom messages to the validator', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        userId: 'u1',
        networkPolicy: 'lan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['10.0.0.0/8'],
      });

      await service.stopUnapprovedSessions(payload(session()));

      expect(ipValidationService.validateIPAccess).toHaveBeenCalledWith(
        '10.0.0.5',
        {
          networkPolicy: 'lan',
          ipAccessPolicy: 'restricted',
          allowedIPs: ['10.0.0.0/8'],
        },
        {
          lanOnly: 'msg:MSG_IP_LAN_ONLY',
          wanOnly: 'msg:MSG_IP_WAN_ONLY',
          notAllowed: 'msg:MSG_IP_NOT_ALLOWED',
        },
      );
    });

    it('defaults a preference row with no policy fields to the permissive settings', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });

      await service.stopUnapprovedSessions(payload(session()));

      expect(ipValidationService.validateIPAccess).toHaveBeenCalledWith(
        '10.0.0.5',
        { networkPolicy: 'both', ipAccessPolicy: 'all', allowedIPs: [] },
        expect.anything(),
      );
    });

    it('uses built-in messages when none are configured', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      configService.getSetting.mockResolvedValue(null);

      await service.stopUnapprovedSessions(payload(session()));

      expect(ipValidationService.validateIPAccess).toHaveBeenCalledWith(
        '10.0.0.5',
        expect.anything(),
        {
          lanOnly: 'Only LAN access is allowed',
          wanOnly: 'Only WAN access is allowed',
          notAllowed: 'Your current IP address is not in the allowed list',
        },
      );
    });

    it('blocks a session the validator rejects, keeping its stop code', async () => {
      const listener = jest.fn();
      service.onStreamBlocked(listener);
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      ipValidationService.validateIPAccess.mockReturnValue({
        allowed: false,
        reason: 'Only LAN access is allowed',
        stopCode: 'IP_POLICY_LAN_ONLY',
      });

      const result = await service.stopUnapprovedSessions(payload(session()));

      expect(result.stoppedSessions).toEqual(['session-1']);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ stopCode: 'IP_POLICY_LAN_ONLY' }),
      );
    });

    it('blocks a session Plex reported no address for', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      const noAddress = session();
      delete (noAddress.Player as { address?: string }).address;

      const result = await service.stopUnapprovedSessions(payload(noAddress));

      expect(result.stoppedSessions).toEqual(['session-1']);
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        'Invalid or missing client IP address from Plex',
      );
    });

    it('allows the session when the IP check itself fails', async () => {
      preferenceRepo.findOne.mockRejectedValue(new Error('db down'));

      const result = await service.stopUnapprovedSessions(payload(session()));
      expect(result.stoppedSessions).toEqual([]);
    });
  });

  describe('concurrent stream limits', () => {
    const twoSessions = () =>
      payload(
        session({ id: 'session-1', sessionKey: 'sk-1' }),
        session({ id: 'session-2', sessionKey: 'sk-2' }),
      );

    it('treats a limit of zero as unlimited', async () => {
      const result = await service.stopUnapprovedSessions(twoSessions());
      expect(result.stoppedSessions).toEqual([]);
    });

    it('leaves a user at their limit alone', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(2);

      const result = await service.stopUnapprovedSessions(twoSessions());
      expect(result.stoppedSessions).toEqual([]);
    });

    it('terminates the newest stream when over the limit', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      historyRepo.findOne.mockImplementation(
        ({ where }: { where: { sessionKey: string } }) =>
          Promise.resolve({
            startedAt:
              where.sessionKey === 'sk-1'
                ? new Date('2026-08-21T10:00:00Z')
                : new Date('2026-08-21T11:00:00Z'),
          }),
      );

      const result = await service.stopUnapprovedSessions(twoSessions());

      expect(result.stoppedSessions).toEqual(['session-2']);
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-2',
        'msg:MSG_CONCURRENT_LIMIT',
      );
    });

    it('falls back to a built-in message when none is configured', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      configService.getSetting.mockResolvedValue('');

      await service.stopUnapprovedSessions(twoSessions());

      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('concurrent stream limit'),
      );
    });

    it('reports the block with a concurrent-limit stop code', async () => {
      const listener = jest.fn();
      service.onStreamBlocked(listener);
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

      await service.stopUnapprovedSessions(twoSessions());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ stopCode: 'CONCURRENT_LIMIT' }),
      );
    });

    it('does not re-check a session it already terminated', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      const result = await service.stopUnapprovedSessions(twoSessions());

      expect(result.stoppedSessions).toHaveLength(2);
      expect(new Set(result.stoppedSessions).size).toBe(2);
    });

    it('excludes Plexamp sessions from the count', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

      const result = await service.stopUnapprovedSessions(
        payload(
          session({ id: 'session-1' }),
          session({ id: 'session-2', product: 'Plexamp' }),
        ),
      );

      expect(result.stoppedSessions).toEqual([]);
    });

    it('honours devices the limit filter excludes', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      concurrentStreamService.filterCountableSessions.mockResolvedValue([
        session(),
      ]);

      const result = await service.stopUnapprovedSessions(twoSessions());
      expect(result.stoppedSessions).toEqual([]);
    });

    it('skips a session with no user id', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      const anonymous = session({ id: 'session-2' });
      delete (anonymous as { User?: unknown }).User;

      const result = await service.stopUnapprovedSessions(
        payload(session({ id: 'session-1' }), anonymous),
      );

      expect(result.stoppedSessions).toEqual([]);
    });

    it('records an error when a limit termination fails', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      plexClient.terminateSession.mockRejectedValue(new Error('plex offline'));

      const result = await service.stopUnapprovedSessions(twoSessions());

      expect(result.errors[0]).toContain('plex offline');
    });

    it('records an error when the limit lookup fails', async () => {
      concurrentStreamService.getEffectiveLimit.mockRejectedValue(
        new Error('db down'),
      );

      const result = await service.stopUnapprovedSessions(twoSessions());

      expect(result.errors).toEqual([
        'Error checking concurrent limits for user u1: db down',
      ]);
    });

    it('treats a session with no history as having just started', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      historyRepo.findOne.mockResolvedValue(null);

      const result = await service.stopUnapprovedSessions(twoSessions());
      expect(result.stoppedSessions).toHaveLength(1);
    });

    it('handles a session Plex sent no session key for', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      const keyless = session({ id: 'session-2' });
      delete (keyless as { sessionKey?: string }).sessionKey;

      const result = await service.stopUnapprovedSessions(
        payload(session({ id: 'session-1' }), keyless),
      );

      expect(result.stoppedSessions).toHaveLength(1);
    });
  });

  describe('terminateSession', () => {
    it('passes the given reason to Plex', async () => {
      await service.terminateSession('session-1', 'because');
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        'because',
      );
    });

    it('falls back to the configured pending message', async () => {
      await service.terminateSession('session-1');
      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        'msg:MSG_DEVICE_PENDING',
      );
    });

    it('falls back to a built-in message when none is configured', async () => {
      configService.getSetting.mockResolvedValue('');
      await service.terminateSession('session-1');

      expect(plexClient.terminateSession).toHaveBeenCalledWith(
        'session-1',
        expect.stringContaining('must be approved by the server owner'),
      );
    });

    it('propagates a failure from Plex', async () => {
      plexClient.terminateSession.mockRejectedValue(new Error('plex offline'));
      await expect(service.terminateSession('session-1', 'x')).rejects.toThrow(
        'plex offline',
      );
    });
  });
});
