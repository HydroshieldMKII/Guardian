import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { PlexService } from '@/modules/plex/services/plex.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { UsersService } from '@/modules/users/services/users.service';
import { AuthService } from '@/modules/auth/auth.service';
import { SchedulerService } from '@/services/scheduler.service';
import { DashboardService } from '@/modules/dashboard/dashboard.service';
import { LiveEventsService } from '@/modules/events/live-events.service';
import { callArgs } from '@/test-matchers';

const mockCronJob = {
  start: jest.fn(),
  stop: jest.fn(),
};

jest.mock('cron', () => ({
  CronJob: jest.fn(function CronJobStub(
    this: Record<string, unknown>,
    cronTime: string,
    onTick: () => Promise<void>,
  ) {
    this.cronTime = cronTime;
    this.onTick = onTick;
    this.start = mockCronJob.start;
    this.stop = mockCronJob.stop;
  }),
}));

describe('SchedulerService', () => {
  let service: SchedulerService;
  let plexService: { updateActiveSessions: jest.Mock };
  let configService: Record<string, jest.Mock>;
  let deviceTrackingService: Record<string, jest.Mock>;
  let usersService: { syncUsersFromPlexTV: jest.Mock };
  let authService: { cleanupExpiredSessions: jest.Mock };
  let schedulerRegistry: Record<string, jest.Mock>;
  let dashboardService: { getDashboardData: jest.Mock };
  let liveEvents: { hasListeners: jest.Mock; broadcastDashboard: jest.Mock };
  let listeners: Map<string, Array<() => Promise<void>>>;

  const settings = new Map<string, unknown>();

  const registeredJob = () =>
    callArgs<[string, { cronTime: string; onTick: () => Promise<void> }]>(
      schedulerRegistry.addCronJob,
    )[1];

  beforeEach(async () => {
    jest.clearAllMocks();
    settings.clear();
    settings.set('PLEX_SERVER_IP', '10.0.0.5');
    settings.set('PLEX_SERVER_PORT', '32400');
    settings.set('PLEX_TOKEN', 'plex-token');
    settings.set('PLEXGUARD_REFRESH_INTERVAL', 10);
    listeners = new Map();

    plexService = {
      updateActiveSessions: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      getSetting: jest.fn((key: string) =>
        Promise.resolve(settings.get(key) ?? null),
      ),
      addConfigChangeListener: jest.fn(
        (key: string, callback: () => Promise<void>) => {
          listeners.set(key, [...(listeners.get(key) ?? []), callback]);
        },
      ),
    };

    deviceTrackingService = {
      cleanupInactiveDevices: jest
        .fn()
        .mockResolvedValue({ deletedCount: 0, deletedDevices: [] }),
      enforceStrictModeOnPendingDevices: jest.fn().mockResolvedValue(0),
      cleanupStaleSessionKeys: jest.fn(),
    };

    usersService = {
      syncUsersFromPlexTV: jest
        .fn()
        .mockResolvedValue({ created: 1, updated: 2, errors: 0 }),
    };

    authService = { cleanupExpiredSessions: jest.fn().mockResolvedValue(3) };

    dashboardService = {
      getDashboardData: jest.fn().mockResolvedValue({ stats: { total: 1 } }),
    };
    liveEvents = {
      hasListeners: jest.fn().mockReturnValue(true),
      broadcastDashboard: jest.fn(),
    };

    schedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PlexService, useValue: plexService },
        { provide: ConfigService, useValue: configService },
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: authService },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
        { provide: DashboardService, useValue: dashboardService },
        { provide: LiveEventsService, useValue: liveEvents },
      ],
    }).compile();

    service = module.get(SchedulerService);
  });

  describe('onModuleInit', () => {
    it('registers the session update job and starts it', async () => {
      await service.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'sessionUpdates',
        expect.anything(),
      );
      expect(mockCronJob.start).toHaveBeenCalled();
    });

    it('runs the startup sweep once', async () => {
      await service.onModuleInit();

      expect(plexService.updateActiveSessions).toHaveBeenCalledTimes(1);
      expect(usersService.syncUsersFromPlexTV).toHaveBeenCalledTimes(1);
      expect(
        deviceTrackingService.enforceStrictModeOnPendingDevices,
      ).toHaveBeenCalledTimes(1);
    });

    it('listens for refresh interval and strict mode changes', async () => {
      await service.onModuleInit();

      expect(listeners.has('PLEXGUARD_REFRESH_INTERVAL')).toBe(true);
      expect(listeners.has('PLEX_GUARD_STRICT_MODE')).toBe(true);
    });

    it('rebuilds the cron job when the refresh interval changes', async () => {
      await service.onModuleInit();
      schedulerRegistry.addCronJob.mockClear();
      settings.set('PLEXGUARD_REFRESH_INTERVAL', 30);

      await listeners.get('PLEXGUARD_REFRESH_INTERVAL')![0]();

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        'sessionUpdates',
      );
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });

    it('re-runs strict mode enforcement when the setting changes', async () => {
      await service.onModuleInit();
      deviceTrackingService.enforceStrictModeOnPendingDevices.mockClear();

      await listeners.get('PLEX_GUARD_STRICT_MODE')![0]();

      expect(
        deviceTrackingService.enforceStrictModeOnPendingDevices,
      ).toHaveBeenCalled();
    });

    it('survives a failure setting up the cron job', async () => {
      schedulerRegistry.addCronJob.mockImplementation(() => {
        throw new Error('registry full');
      });

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('cron expressions', () => {
    it.each([
      [10, '*/10 * * * * *'],
      [45, '*/45 * * * * *'],
      [60, '0 */1 * * * *'],
      [300, '0 */5 * * * *'],
      [3600, '0 0 */1 * * *'],
      [7200, '0 0 */2 * * *'],
    ])('turns a %ss interval into %s', async (interval, expression) => {
      settings.set('PLEXGUARD_REFRESH_INTERVAL', interval);
      await service.onModuleInit();

      expect(registeredJob().cronTime).toBe(expression);
    });

    it('falls back to ten seconds for an interval it cannot express', async () => {
      settings.set('PLEXGUARD_REFRESH_INTERVAL', 5400);
      await service.onModuleInit();

      expect(registeredJob().cronTime).toBe('*/10 * * * * *');
    });

    it('falls back to ten seconds when the interval is unreadable', async () => {
      settings.set('PLEXGUARD_REFRESH_INTERVAL', Number.NaN);
      await service.onModuleInit();

      expect(registeredJob().cronTime).toBe('*/10 * * * * *');
    });

    it('tolerates there being no existing job to replace', async () => {
      schedulerRegistry.deleteCronJob.mockImplementation(() => {
        throw new Error('no such job');
      });

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });
  });

  describe('scheduled session updates', () => {
    it('polls Plex when the job ticks', async () => {
      await service.onModuleInit();
      plexService.updateActiveSessions.mockClear();

      await registeredJob().onTick();

      expect(plexService.updateActiveSessions).toHaveBeenCalled();
    });

    it.each(['PLEX_SERVER_IP', 'PLEX_SERVER_PORT', 'PLEX_TOKEN'])(
      'skips the poll when %s is missing',
      async (missing) => {
        settings.delete(missing);
        await service.onModuleInit();

        expect(plexService.updateActiveSessions).not.toHaveBeenCalled();
      },
    );

    it('swallows a polling failure', async () => {
      plexService.updateActiveSessions.mockRejectedValue(
        new Error('plex offline'),
      );
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('stays quiet about a configuration error', async () => {
      plexService.updateActiveSessions.mockRejectedValue(
        new Error('Missing required Plex configuration'),
      );
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('device cleanup', () => {
    it('does nothing while cleanup is disabled', async () => {
      await service.onModuleInit();
      expect(
        deviceTrackingService.cleanupInactiveDevices,
      ).not.toHaveBeenCalled();
    });

    it('cleans up using the configured interval', async () => {
      settings.set('DEVICE_CLEANUP_ENABLED', true);
      settings.set('DEVICE_CLEANUP_INTERVAL_DAYS', 45);

      await service.onModuleInit();

      expect(deviceTrackingService.cleanupInactiveDevices).toHaveBeenCalledWith(
        45,
      );
    });

    it('skips the nightly run while cleanup is disabled', async () => {
      await service.handleDeviceCleanup();
      expect(
        deviceTrackingService.cleanupInactiveDevices,
      ).not.toHaveBeenCalled();
    });

    it('runs the nightly cleanup when enabled', async () => {
      settings.set('DEVICE_CLEANUP_ENABLED', true);
      settings.set('DEVICE_CLEANUP_INTERVAL_DAYS', 30);

      await service.handleDeviceCleanup();

      expect(deviceTrackingService.cleanupInactiveDevices).toHaveBeenCalledWith(
        30,
      );
    });

    it('swallows a cleanup failure', async () => {
      settings.set('DEVICE_CLEANUP_ENABLED', true);
      settings.set('DEVICE_CLEANUP_INTERVAL_DAYS', 30);
      deviceTrackingService.cleanupInactiveDevices.mockRejectedValue(
        new Error('locked'),
      );

      await expect(service.handleDeviceCleanup()).resolves.toBeUndefined();
    });

    it('swallows a failure reading the cleanup settings', async () => {
      configService.getSetting.mockRejectedValue(new Error('db down'));
      await expect(service.handleDeviceCleanup()).resolves.toBeUndefined();
    });
  });

  describe('hourly jobs', () => {
    it('syncs Plex users when a token is configured', async () => {
      await service.handlePlexUserSync();
      expect(usersService.syncUsersFromPlexTV).toHaveBeenCalled();
    });

    it('skips the sync with no token', async () => {
      settings.delete('PLEX_TOKEN');
      await service.handlePlexUserSync();
      expect(usersService.syncUsersFromPlexTV).not.toHaveBeenCalled();
    });

    it('swallows a sync failure', async () => {
      usersService.syncUsersFromPlexTV.mockRejectedValue(
        new Error('plex.tv down'),
      );
      await expect(service.handlePlexUserSync()).resolves.toBeUndefined();
    });

    it('purges expired sessions', async () => {
      await service.handleSessionCleanup();
      expect(authService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('swallows a session purge failure', async () => {
      authService.cleanupExpiredSessions.mockRejectedValue(
        new Error('db down'),
      );
      await expect(service.handleSessionCleanup()).resolves.toBeUndefined();
    });

    it('trims the in-memory session key tracking', () => {
      service.handleSessionKeyMemoryCleanup();
      expect(deviceTrackingService.cleanupStaleSessionKeys).toHaveBeenCalled();
    });
  });

  describe('strict mode enforcement', () => {
    it('swallows an enforcement failure', async () => {
      deviceTrackingService.enforceStrictModeOnPendingDevices.mockRejectedValue(
        new Error('db down'),
      );
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('reports the devices it processed', async () => {
      deviceTrackingService.enforceStrictModeOnPendingDevices.mockResolvedValue(
        3,
      );
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('live dashboard broadcast', () => {
    const runSessionUpdate = async () => {
      settings.set('PLEX_SERVER_IP', '10.0.0.5');
      settings.set('PLEX_SERVER_PORT', '32400');
      settings.set('PLEX_TOKEN', 'plex-token');
      await service.onModuleInit();
      await registeredJob().onTick();
    };

    it('pushes the fresh dashboard after updating sessions', async () => {
      await runSessionUpdate();

      expect(plexService.updateActiveSessions).toHaveBeenCalled();
      expect(liveEvents.broadcastDashboard).toHaveBeenCalledWith({
        stats: { total: 1 },
      });
    });

    it('broadcasts only after the sessions have been updated', async () => {
      await runSessionUpdate();

      expect(
        plexService.updateActiveSessions.mock.invocationCallOrder[0],
      ).toBeLessThan(liveEvents.broadcastDashboard.mock.invocationCallOrder[0]);
    });

    it('does no work when nobody is connected', async () => {
      liveEvents.hasListeners.mockReturnValue(false);

      await runSessionUpdate();

      expect(dashboardService.getDashboardData).not.toHaveBeenCalled();
      expect(liveEvents.broadcastDashboard).not.toHaveBeenCalled();
    });

    it('still publishes while Plex is unconfigured, so clients see why', async () => {
      settings.delete('PLEX_TOKEN');

      await service.onModuleInit();
      await registeredJob().onTick();

      expect(plexService.updateActiveSessions).not.toHaveBeenCalled();
      expect(liveEvents.broadcastDashboard).toHaveBeenCalled();
    });

    it('still publishes when Plex is unreachable', async () => {
      plexService.updateActiveSessions.mockRejectedValue(
        new Error('unreachable'),
      );

      await runSessionUpdate();

      expect(liveEvents.broadcastDashboard).toHaveBeenCalled();
    });

    it('survives a failure assembling the dashboard', async () => {
      dashboardService.getDashboardData.mockRejectedValue(new Error('db down'));

      await expect(runSessionUpdate()).resolves.toBeUndefined();
      expect(liveEvents.broadcastDashboard).not.toHaveBeenCalled();
    });
  });
});
