import { Test } from '@nestjs/testing';
import { EventEmitter } from 'events';
import { AppriseService } from './apprise.service';
import { ConfigService } from './config.service';
import { SettingValues } from '@/modules/config/settings.catalog';

const mockSpawn = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill = jest.fn(() => {
    this.killed = true;
    return true;
  });

  finish(code: number, output: { stdout?: string; stderr?: string } = {}) {
    if (output.stdout) this.stdout.emit('data', Buffer.from(output.stdout));
    if (output.stderr) this.stderr.emit('data', Buffer.from(output.stderr));
    this.emit('close', code);
  }
}

describe('AppriseService', () => {
  let service: AppriseService;
  let child: FakeProcess;
  let settings: Partial<SettingValues>;

  const notification = {
    title: 'Guardian',
    body: 'something happened',
  };

  const spawnArgs = () => mockSpawn.mock.calls[0][1] as string[];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

    child = new FakeProcess();
    mockSpawn.mockImplementation(() => child);

    settings = {
      APPRISE_ENABLED: true,
      APPRISE_URLS: 'discord://token@channel',
      APPRISE_NOTIFY_ON_NEW_DEVICE: true,
      APPRISE_NOTIFY_ON_BLOCK: true,
      APPRISE_NOTIFY_ON_LOCATION_CHANGE: true,
      APPRISE_NOTIFY_ON_DEVICE_NOTE: true,
    };

    const module = await Test.createTestingModule({
      providers: [
        AppriseService,
        {
          provide: ConfigService,
          useValue: {
            getSetting: jest.fn((key: keyof SettingValues) =>
              Promise.resolve(settings[key] ?? null),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(AppriseService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const send = async (run: () => Promise<unknown>, code = 0, output = {}) => {
    const pending = run();
    await flush();
    child.finish(code, output);
    return pending;
  };

  describe('getAppriseConfig', () => {
    it('refuses while Apprise is switched off', async () => {
      settings.APPRISE_ENABLED = false;

      await expect(service.getAppriseConfig()).resolves.toEqual({
        success: false,
        message: 'Apprise is disabled',
      });
    });

    it('treats a boolean setting as a boolean, not a string', async () => {
      await expect(service.getAppriseConfig()).resolves.toMatchObject({
        enabled: true,
      });
    });

    it.each(['', '   '])('refuses with %p configured URLs', async (urls) => {
      settings.APPRISE_URLS = urls;

      await expect(service.getAppriseConfig()).resolves.toEqual({
        success: false,
        message: 'No Apprise URLs configured',
      });
    });

    it('splits URLs on commas, semicolons and newlines', async () => {
      settings.APPRISE_URLS = 'discord://a, slack://b;mailto://c\ntgram://d';

      await expect(service.getAppriseConfig()).resolves.toMatchObject({
        urls: ['discord://a', 'slack://b', 'mailto://c', 'tgram://d'],
      });
    });

    it('names the URLs it could not parse', async () => {
      settings.APPRISE_URLS = 'discord://ok, not-a-url';

      await expect(service.getAppriseConfig()).resolves.toEqual({
        success: false,
        message: expect.stringContaining(
          'Invalid service URLs found: not-a-url',
        ),
      });
    });

    it.each(['ab', 'no-scheme', '://missing', '1bad://x'])(
      'rejects %p as a service URL',
      async (url) => {
        settings.APPRISE_URLS = url;

        await expect(service.getAppriseConfig()).resolves.toMatchObject({
          success: false,
        });
      },
    );
  });

  describe('sendNotification', () => {
    it('passes the title and body to apprise', async () => {
      await send(() => service.sendNotification(notification));

      expect(mockSpawn).toHaveBeenCalledWith(
        'apprise',
        expect.any(Array),
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
      );
      expect(spawnArgs()).toEqual([
        '-vv',
        '--title',
        'Guardian',
        '--body',
        'something happened',
        'discord://token@channel',
      ]);
    });

    it('appends every configured URL', async () => {
      settings.APPRISE_URLS = 'discord://a,slack://b';
      await send(() => service.sendNotification(notification));

      expect(spawnArgs().slice(-2)).toEqual(['discord://a', 'slack://b']);
    });

    it('reports success on a zero exit code', async () => {
      await expect(
        send(() => service.sendNotification(notification)),
      ).resolves.toEqual({
        success: true,
        message: 'Notification sent successfully',
      });
    });

    it('never spawns apprise while it is disabled', async () => {
      settings.APPRISE_ENABLED = false;

      await expect(service.sendNotification(notification)).resolves.toEqual({
        success: false,
        message: 'Apprise is disabled',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('apprise failures', () => {
    const failWith = (stderr: string) =>
      send(() => service.sendNotification(notification), 1, { stderr });

    it('names the URL apprise rejected', async () => {
      await expect(
        failWith('Unsupported URL: bogus://thing'),
      ).resolves.toMatchObject({
        success: false,
        message: expect.stringContaining(
          'Invalid service URL: "bogus://thing"',
        ),
      });
    });

    it('explains an empty server list', async () => {
      await expect(
        failWith('You must specify at least one server URL'),
      ).resolves.toMatchObject({
        message: expect.stringContaining('No valid service URLs found'),
      });
    });

    it('explains an HTTP failure', async () => {
      await expect(failWith('ERROR - HTTP Error 502')).resolves.toMatchObject({
        message: expect.stringContaining(
          'Failed to connect to notification service',
        ),
      });
    });

    it.each(['Permission denied', 'Forbidden'])(
      'explains a %s response',
      async (stderr) => {
        await expect(failWith(stderr)).resolves.toMatchObject({
          message: expect.stringContaining('Permission denied when sending'),
        });
      },
    );

    it('strips the log prefix off an unrecognised failure', async () => {
      await expect(
        failWith('2026-08-21 12:00:00,123 - ERROR - something odd'),
      ).resolves.toEqual({
        success: false,
        message: 'Notification failed: something odd',
      });
    });

    it('falls back to stdout when stderr is empty', async () => {
      await expect(
        send(() => service.sendNotification(notification), 1, {
          stdout: 'Unsupported URL: xyz://a',
        }),
      ).resolves.toMatchObject({
        message: expect.stringContaining('xyz://a'),
      });
    });

    it('reports a missing apprise binary', async () => {
      const pending = service.sendNotification(notification);
      await flush();
      child.emit('error', new Error('spawn apprise ENOENT'));

      await expect(pending).resolves.toEqual({
        success: false,
        message: 'Failed to spawn apprise process: spawn apprise ENOENT',
      });
    });

    it('kills a process that never exits', async () => {
      const pending = service.sendNotification(notification);
      await flush();
      jest.advanceTimersByTime(20000);

      await expect(pending).resolves.toMatchObject({
        success: false,
        message: expect.stringContaining('timed out'),
      });
      expect(child.kill).toHaveBeenCalled();
    });
  });

  describe('per-event switches', () => {
    it.each([
      [
        'APPRISE_NOTIFY_ON_NEW_DEVICE',
        () =>
          service.sendNewDeviceNotification('testuser', 'Shield', '10.0.0.1'),
        'new devices',
      ],
      [
        'APPRISE_NOTIFY_ON_BLOCK',
        () => service.sendBlockedNotification('testuser', 'Shield'),
        'blocked streams',
      ],
      [
        'APPRISE_NOTIFY_ON_LOCATION_CHANGE',
        () =>
          service.sendLocationChangeNotification(
            'testuser',
            'Shield',
            '10.0.0.1',
            '1.2.3.4',
          ),
        'location changes',
      ],
      [
        'APPRISE_NOTIFY_ON_DEVICE_NOTE',
        () => service.sendDeviceNoteNotification('testuser', 'Shield', 'note'),
        'device notes',
      ],
    ] as const)('stays quiet while %s is off', async (key, run, label) => {
      settings[key] = false;

      await expect(run()).resolves.toEqual({
        success: false,
        message: `Apprise notification for ${label} is disabled`,
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('notification bodies', () => {
    const bodyOf = async (run: () => Promise<unknown>) => {
      await send(run);
      return spawnArgs()[4];
    };

    it('describes a newly detected device', async () => {
      const body = await bodyOf(() =>
        service.sendNewDeviceNotification('testuser', 'Shield', '10.0.0.1'),
      );

      expect(body).toContain('testuser');
      expect(body).toContain('Shield');
      expect(body).toContain('10.0.0.1');
      expect(body).toContain('Pending Approval');
    });

    it('substitutes placeholders for a block with no IP or stop code', async () => {
      const body = await bodyOf(() =>
        service.sendBlockedNotification('testuser', 'Shield'),
      );

      expect(body).toContain('Unknown IP Address');
      expect(body).toContain('Unknown Stop Code');
    });

    it('carries both addresses on a location change', async () => {
      const body = await bodyOf(() =>
        service.sendLocationChangeNotification(
          'testuser',
          'Shield',
          '10.0.0.1',
          '1.2.3.4',
        ),
      );

      expect(body).toContain('Old IP Address: 10.0.0.1');
      expect(body).toContain('New IP Address: 1.2.3.4');
    });

    it('carries the note text', async () => {
      const body = await bodyOf(() =>
        service.sendDeviceNoteNotification(
          'testuser',
          'Shield',
          'please approve',
        ),
      );

      expect(body).toContain('please approve');
    });
  });

  describe('testAppriseConnection', () => {
    it('reports how many services were reached', async () => {
      settings.APPRISE_URLS = 'discord://a,slack://b';

      await expect(
        send(() => service.testAppriseConnection()),
      ).resolves.toEqual({
        success: true,
        message: 'Test notification sent successfully to 2 service(s)',
      });
    });

    it('passes a configuration problem straight through', async () => {
      settings.APPRISE_ENABLED = false;

      await expect(service.testAppriseConnection()).resolves.toEqual({
        success: false,
        message: 'Apprise is disabled',
      });
    });

    it('surfaces the delivery failure', async () => {
      await expect(
        send(() => service.testAppriseConnection(), 1, {
          stderr: 'Unsupported URL: bad://x',
        }),
      ).resolves.toMatchObject({ success: false });
    });
  });
});
