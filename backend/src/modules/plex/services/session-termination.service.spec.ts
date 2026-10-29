import {
  SessionTerminationService,
  StreamBlockedEvent,
} from '@/modules/plex/services/session-termination.service';
import {
  approvedDevice,
  createSessionTerminationTestbed,
  payload,
  session,
  SessionTerminationTestbed,
} from '@/modules/plex/services/session-termination-testbed.fixture';

describe('SessionTerminationService', () => {
  let service: SessionTerminationService;
  let deviceRepo: SessionTerminationTestbed['deviceRepo'];
  let historyRepo: SessionTerminationTestbed['historyRepo'];
  let plexClient: SessionTerminationTestbed['plexClient'];
  let concurrentStreamService: SessionTerminationTestbed['concurrentStreamService'];
  let configService: SessionTerminationTestbed['configService'];

  beforeEach(async () => {
    const testbed = await createSessionTerminationTestbed();
    ({
      deviceRepo,
      historyRepo,
      plexClient,
      concurrentStreamService,
      configService,
    } = testbed);
    service = testbed.module.get(SessionTerminationService);
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
        username: 'testuser',
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

  describe('concurrent stream limits', () => {
    const twoSessions = () =>
      payload(
        session({ id: 'session-1', sessionKey: 'sk-1' }),
        session({ id: 'session-2', sessionKey: 'sk-2' }),
      );

    it('substitutes placeholders for an unnamed session it terminates', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      const events: StreamBlockedEvent[] = [];
      service.onStreamBlocked((event) => events.push(event));

      const bare = (id: string) => ({
        sessionKey: `sk-${id}`,
        Session: { id: `session-${id}` },
        User: { id: 'u1' },
        Player: { machineIdentifier: undefined },
      });

      await service.stopUnapprovedSessions({
        MediaContainer: { size: 2, Metadata: [bare('1'), bare('2')] },
      });

      expect(events[0]).toMatchObject({
        username: 'Unknown',
        deviceIdentifier: 'unknown',
      });
    });

    it('skips a session Plex gave no id for when trimming', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

      const result = await service.stopUnapprovedSessions({
        MediaContainer: {
          size: 2,
          Metadata: [
            { sessionKey: 'sk-1', Session: {}, User: { id: 'u1' }, Player: {} },
            { sessionKey: 'sk-2', Session: {}, User: { id: 'u1' }, Player: {} },
          ],
        },
      });

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

    it('records an error when a limit termination fails', async () => {
      concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
      plexClient.terminateSession.mockRejectedValue(new Error('plex offline'));

      const result = await service.stopUnapprovedSessions(twoSessions());

      expect(result.errors[0]).toContain('plex offline');
    });
  });

  describe('sparse session data', () => {
    const sparse = (overrides: Record<string, unknown>) => ({
      sessionKey: 'sk-1',
      Session: { id: 'session-1' },
      User: { id: 'u1', title: 'testuser' },
      Player: { machineIdentifier: 'dev-1', address: '10.0.0.5' },
      ...overrides,
    });

    const blocked = () =>
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );

    const stop = (metadata: Record<string, unknown>[]) =>
      service.stopUnapprovedSessions({
        MediaContainer: { size: metadata.length, Metadata: metadata },
      });

    it('allows a session that carries no user at all', async () => {
      deviceRepo.findOne.mockResolvedValue(approvedDevice());

      const result = await stop([sparse({ User: undefined })]);
      expect(result.stoppedSessions).toEqual([]);
    });

    it('substitutes placeholders when blocking an unnamed session', async () => {
      blocked();
      const events: StreamBlockedEvent[] = [];
      service.onStreamBlocked((event) => events.push(event));

      await stop([
        sparse({
          User: { id: 'u1' },
          Player: { machineIdentifier: 'dev-1', address: '10.0.0.5' },
        }),
      ]);

      expect(plexClient.terminateSession).toHaveBeenCalled();
      expect(events[0]).toMatchObject({ userId: 'u1' });
    });

    it('reports an unknown user when only the account uuid is known', async () => {
      blocked();
      const events: StreamBlockedEvent[] = [];
      service.onStreamBlocked((event) => events.push(event));

      await stop([sparse({ User: { uuid: 'uuid-1', title: 'testuser' } })]);

      expect(events[0]).toMatchObject({ userId: 'unknown' });
    });

    it('leaves a session with no device identifier alone', async () => {
      blocked();

      const result = await stop([sparse({ Player: { address: '10.0.0.5' } })]);
      expect(result.stoppedSessions).toEqual([]);
    });

    it('names the session key in an error it could not attribute', async () => {
      blocked();
      plexClient.terminateSession.mockRejectedValue(new Error('plex down'));

      const result = await stop([sparse({})]);
      expect(result.errors[0]).toContain('sk-1');
    });

    it('falls back to the session id when there is no session key', async () => {
      blocked();
      plexClient.terminateSession.mockRejectedValue(new Error('plex down'));

      const result = await stop([sparse({ sessionKey: undefined })]);
      expect(result.errors[0]).toContain('session-1');
    });

    it('cannot terminate a session Plex gave no id for', async () => {
      blocked();

      const result = await stop([sparse({ Session: { id: undefined } })]);

      expect(result.stoppedSessions).toEqual([]);
      expect(plexClient.terminateSession).not.toHaveBeenCalled();
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
