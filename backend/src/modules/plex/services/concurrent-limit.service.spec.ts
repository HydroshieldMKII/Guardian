import { ConcurrentLimitService } from '@/modules/plex/services/concurrent-limit.service';
import {
  createSessionTerminationTestbed,
  session,
  SessionTerminationTestbed,
} from '@/modules/plex/services/session-termination-testbed.fixture';

describe('ConcurrentLimitService', () => {
  let limits: ConcurrentLimitService;
  let historyRepo: SessionTerminationTestbed['historyRepo'];
  let concurrentStreamService: SessionTerminationTestbed['concurrentStreamService'];
  let configService: SessionTerminationTestbed['configService'];

  const twoSessions = () => [
    session({ id: 'session-1', sessionKey: 'sk-1' }),
    session({ id: 'session-2', sessionKey: 'sk-2' }),
  ];

  const excessIds = async (sessions = twoSessions()) => {
    const { excess } = await limits.findExcessStreams(sessions);
    return excess.map(
      ({ session: excessSession }) => excessSession.Session?.id,
    );
  };

  beforeEach(async () => {
    const testbed = await createSessionTerminationTestbed();
    ({ historyRepo, concurrentStreamService, configService } = testbed);
    limits = testbed.module.get(ConcurrentLimitService);
  });

  it('treats a limit of zero as unlimited', async () => {
    await expect(excessIds()).resolves.toEqual([]);
    expect(
      concurrentStreamService.filterCountableSessions,
    ).not.toHaveBeenCalled();
  });

  it('leaves a user at their limit alone', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(2);

    await expect(excessIds()).resolves.toEqual([]);
  });

  it('picks the newest stream when over the limit', async () => {
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

    await expect(excessIds()).resolves.toEqual(['session-2']);
  });

  it('picks as many streams as the user is over by', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

    const ids = await excessIds([
      ...twoSessions(),
      session({ id: 'session-3', sessionKey: 'sk-3' }),
    ]);

    expect(ids).toHaveLength(2);
  });

  it('attaches the user and the configured message to each excess stream', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

    const { excess } = await limits.findExcessStreams(twoSessions());

    expect(excess[0]).toMatchObject({
      userId: 'u1',
      reason: 'msg:MSG_CONCURRENT_LIMIT',
    });
  });

  it('falls back to a built-in message when none is configured', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
    configService.getSetting.mockResolvedValue('');

    const { excess } = await limits.findExcessStreams(twoSessions());

    expect(excess[0].reason).toContain('concurrent stream limit');
  });

  it('checks each user against their own limit', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

    await limits.findExcessStreams([
      session({ id: 'session-1', userId: 'u1' }),
      session({ id: 'session-2', userId: 'u2' }),
    ]);

    expect(concurrentStreamService.getEffectiveLimit).toHaveBeenCalledWith(
      'u1',
    );
    expect(concurrentStreamService.getEffectiveLimit).toHaveBeenCalledWith(
      'u2',
    );
  });

  it('excludes Plexamp sessions from the count', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

    await expect(
      excessIds([
        session({ id: 'session-1' }),
        session({ id: 'session-2', product: 'Plexamp' }),
      ]),
    ).resolves.toEqual([]);
  });

  it('honours devices the limit filter excludes', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
    concurrentStreamService.filterCountableSessions.mockResolvedValue([
      session(),
    ]);

    await expect(excessIds()).resolves.toEqual([]);
  });

  it('skips a session with no user id', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
    const anonymous = session({ id: 'session-2' });
    delete (anonymous as { User?: unknown }).User;

    await expect(
      excessIds([session({ id: 'session-1' }), anonymous]),
    ).resolves.toEqual([]);
  });

  it('groups a session by account uuid when there is no user id', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);

    await limits.findExcessStreams([
      { ...session(), User: { uuid: 'uuid-1', title: 'testuser' } },
    ]);

    expect(concurrentStreamService.getEffectiveLimit).toHaveBeenCalledWith(
      'uuid-1',
    );
  });

  it('records an error when the limit lookup fails', async () => {
    concurrentStreamService.getEffectiveLimit.mockRejectedValue(
      new Error('db down'),
    );

    await expect(limits.findExcessStreams(twoSessions())).resolves.toEqual({
      excess: [],
      errors: ['Error checking concurrent limits for user u1: db down'],
    });
  });

  it('keeps checking other users after one lookup fails', async () => {
    concurrentStreamService.getEffectiveLimit
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(1);

    const ids = await excessIds([
      session({ id: 'session-1', userId: 'u1' }),
      session({ id: 'session-2', userId: 'u2' }),
      session({ id: 'session-3', userId: 'u2', sessionKey: 'sk-3' }),
    ]);

    expect(ids).toHaveLength(1);
  });

  it('treats a session with no history as having just started', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
    historyRepo.findOne.mockResolvedValue(null);

    await expect(excessIds()).resolves.toHaveLength(1);
  });

  it('treats a session Plex sent no session key for as having just started', async () => {
    concurrentStreamService.getEffectiveLimit.mockResolvedValue(1);
    historyRepo.findOne.mockResolvedValue({
      startedAt: new Date('2026-08-21T10:00:00Z'),
    });
    const keyless = session({ id: 'session-2' });
    delete (keyless as { sessionKey?: string }).sessionKey;

    await expect(
      excessIds([session({ id: 'session-1' }), keyless]),
    ).resolves.toEqual(['session-2']);
    expect(historyRepo.findOne).toHaveBeenCalledTimes(1);
  });
});
