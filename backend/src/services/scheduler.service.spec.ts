import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { PlexService } from '@/modules/plex/services/plex.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { DeviceMaintenanceService } from '@/modules/devices/services/device-maintenance.service';
import { PlexUserSyncService } from '@/modules/users/services/plex-user-sync.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { SchedulerService } from '@/services/scheduler.service';
import { DashboardService } from '@/modules/dashboard/dashboard.service';
import { LiveEventsService } from '@/modules/events/live-events.service';
import { PlexConfigurationError } from '@/modules/plex/services/plex-configuration-error';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let plexService: { updateActiveSessions: jest.Mock };
  let configService: Record<string, jest.Mock>;
  let deviceTrackingService: { cleanupStaleSessionKeys: jest.Mock };
  let deviceMaintenanceService: Record<
    'cleanupInactiveDevices' | 'enforceStrictModeOnPendingDevices',
    jest.Mock
  >;
  let plexUserSync: { syncUsersFromPlexTV: jest.Mock };
  let authSessions: { cleanupExpiredSessions: jest.Mock };
  let schedulerRegistry: Record<string, jest.Mock>;
  let dashboardService: { getDashboardData: jest.Mock };
  let liveEvents: { hasListeners: jest.Mock; broadcastDashboard: jest.Mock };
  let listeners: Map<string, Array<() => Promise<void>>>;

  const settings = new Map<string, unknown>();

  const tick = (seconds = 10) => jest.advanceTimersByTimeAsync(seconds * 1000);

  const pollsWithin = async (seconds: number) => {
    plexService.updateActiveSessions.mockClear();
    await tick(seconds);
    return plexService.updateActiveSessions.mock.calls.length;
  };

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

    deviceTrackingService = { cleanupStaleSessionKeys: jest.fn() };
    deviceMaintenanceService = {
      cleanupInactiveDevices: jest
        .fn()
        .mockResolvedValue({ deletedCount: 0, deletedDevices: [] }),
      enforceStrictModeOnPendingDevices: jest.fn().mockResolvedValue(0),
    };

    plexUserSync = {
      syncUsersFromPlexTV: jest
        .fn()
        .mockResolvedValue({ created: 1, updated: 2, errors: 0 }),
    };

    authSessions = { cleanupExpiredSessions: jest.fn().mockResolvedValue(3) };

    dashboardService = {
      getDashboardData: jest.fn().mockResolvedValue({ stats: { total: 1 } }),
    };
    liveEvents = {
      hasListeners: jest.fn().mockReturnValue(true),
      broadcastDashboard: jest.fn(),
    };

    schedulerRegistry = {
      doesExist: jest.fn().mockReturnValue(false),
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PlexService, useValue: plexService },
        { provide: ConfigService, useValue: configService },
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
        {
          provide: DeviceMaintenanceService,
          useValue: deviceMaintenanceService,
        },
        { provide: PlexUserSyncService, useValue: plexUserSync },
        { provide: AuthSessionService, useValue: authSessions },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
        { provide: DashboardService, useValue: dashboardService },
        { provide: LiveEventsService, useValue: liveEvents },
      ],
    }).compile();

    service = module.get(SchedulerService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('registers the session update interval', async () => {
      await service.onModuleInit();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        'sessionUpdates',
        expect.anything(),
      );
    });

    it('runs the startup sweep once', async () => {
      await service.onModuleInit();

      expect(plexService.updateActiveSessions).toHaveBeenCalledTimes(1);
      expect(plexUserSync.syncUsersFromPlexTV).toHaveBeenCalledTimes(1);
      expect(
        deviceMaintenanceService.enforceStrictModeOnPendingDevices,
      ).toHaveBeenCalledTimes(1);
    });

    it('listens for refresh interval and strict mode changes', async () => {
      await service.onModuleInit();

      expect(listeners.has('PLEXGUARD_REFRESH_INTERVAL')).toBe(true);
      expect(listeners.has('PLEX_GUARD_STRICT_MODE')).toBe(true);
    });

    it('replaces the interval when the refresh interval changes', async () => {
      await service.onModuleInit();
      schedulerRegistry.addInterval.mockClear();
      schedulerRegistry.doesExist.mockReturnValue(true);
      settings.set('PLEXGUARD_REFRESH_INTERVAL', 30);

      await listeners.get('PLEXGUARD_REFRESH_INTERVAL')![0]();
      await tick(0);

      expect(schedulerRegistry.doesExist).toHaveBeenCalledWith(
        'interval',
        'sessionUpdates',
      );
      expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
        'sessionUpdates',
      );
      expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(1);
    });

    it('has nothing to replace on the first schedule', async () => {
      await service.onModuleInit();
      expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
    });

    it('re-runs strict mode enforcement when the setting changes', async () => {
      await service.onModuleInit();
      deviceMaintenanceService.enforceStrictModeOnPendingDevices.mockClear();

      await listeners.get('PLEX_GUARD_STRICT_MODE')![0]();

      expect(
        deviceMaintenanceService.enforceStrictModeOnPendingDevices,
      ).toHaveBeenCalled();
    });

    it('survives a failure scheduling the updates', async () => {
      schedulerRegistry.addInterval.mockImplementation(() => {
        throw new Error('registry full');
      });

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('refresh interval', () => {
    it.each([10, 7, 8, 45, 90, 5400])(
      'polls exactly every %ss',
      async (interval) => {
        settings.set('PLEXGUARD_REFRESH_INTERVAL', interval);
        await service.onModuleInit();

        expect(await pollsWithin(interval - 1)).toBe(0);
        expect(await pollsWithin(1)).toBe(1);
        expect(await pollsWithin(interval * 3)).toBe(3);
      },
    );

    it.each([1, -3])(
      'never polls faster than every five seconds, even for a stored %ss',
      async (interval) => {
        settings.set('PLEXGUARD_REFRESH_INTERVAL', interval);
        await service.onModuleInit();

        expect(await pollsWithin(4)).toBe(0);
        expect(await pollsWithin(1)).toBe(1);
      },
    );

    it.each([Number.NaN, 7.5, null])(
      'falls back to ten seconds when the stored interval is %s',
      async (interval) => {
        settings.set('PLEXGUARD_REFRESH_INTERVAL', interval);
        await service.onModuleInit();

        expect(await pollsWithin(9)).toBe(0);
        expect(await pollsWithin(1)).toBe(1);
      },
    );

    it('skips a tick while the previous update is still running', async () => {
      await service.onModuleInit();
      let finish: () => void = () => undefined;
      plexService.updateActiveSessions.mockImplementationOnce(
        () => new Promise<void>((resolve) => (finish = resolve)),
      );

      expect(await pollsWithin(30)).toBe(1);

      finish();
      expect(await pollsWithin(10)).toBe(1);
    });
  });

  describe('scheduled session updates', () => {
    it('polls Plex when the job ticks', async () => {
      await service.onModuleInit();
      plexService.updateActiveSessions.mockClear();

      await tick();

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

    it('logs an invalid Plex address as a warning without a stack', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      plexService.updateActiveSessions.mockRejectedValue(
        new PlexConfigurationError('Invalid Plex server address or port.'),
      );

      await service.onModuleInit();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid Plex server address or port.'),
      );
      expect(error).not.toHaveBeenCalledWith(
        'Error during scheduled session update:',
        expect.anything(),
      );
      warn.mockRestore();
      error.mockRestore();
    });

    it('stays quiet about a configuration error', async () => {
      plexService.updateActiveSessions.mockRejectedValue(
        new PlexConfigurationError('Missing required Plex configuration'),
      );
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('device cleanup', () => {
    it('does nothing while cleanup is disabled', async () => {
      await service.onModuleInit();
      expect(
        deviceMaintenanceService.cleanupInactiveDevices,
      ).not.toHaveBeenCalled();
    });

    it('cleans up using the configured interval', async () => {
      settings.set('DEVICE_CLEANUP_ENABLED', true);
      settings.set('DEVICE_CLEANUP_INTERVAL_DAYS', 45);

      await service.onModuleInit();

      expect(
        deviceMaintenanceService.cleanupInactiveDevices,
      ).toHaveBeenCalledWith(45);
    });

    it('skips the nightly run while cleanup is disabled', async () => {
      await service.handleDeviceCleanup();
      expect(
        deviceMaintenanceService.cleanupInactiveDevices,
      ).not.toHaveBeenCalled();
    });

    it('runs the nightly cleanup when enabled', async () => {
      settings.set('DEVICE_CLEANUP_ENABLED', true);
      settings.set('DEVICE_CLEANUP_INTERVAL_DAYS', 30);

      await service.handleDeviceCleanup();

      expect(
        deviceMaintenanceService.cleanupInactiveDevices,
      ).toHaveBeenCalledWith(30);
    });

    it('swallows a cleanup failure', async () => {
      settings.set('DEVICE_CLEANUP_ENABLED', true);
      settings.set('DEVICE_CLEANUP_INTERVAL_DAYS', 30);
      deviceMaintenanceService.cleanupInactiveDevices.mockRejectedValue(
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
      expect(plexUserSync.syncUsersFromPlexTV).toHaveBeenCalled();
    });

    it('skips the sync with no token', async () => {
      settings.delete('PLEX_TOKEN');
      await service.handlePlexUserSync();
      expect(plexUserSync.syncUsersFromPlexTV).not.toHaveBeenCalled();
    });

    it('swallows a sync failure', async () => {
      plexUserSync.syncUsersFromPlexTV.mockRejectedValue(
        new Error('plex.tv down'),
      );
      await expect(service.handlePlexUserSync()).resolves.toBeUndefined();
    });

    it('purges expired sessions', async () => {
      await service.handleSessionCleanup();
      expect(authSessions.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('swallows a session purge failure', async () => {
      authSessions.cleanupExpiredSessions.mockRejectedValue(
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
      deviceMaintenanceService.enforceStrictModeOnPendingDevices.mockRejectedValue(
        new Error('db down'),
      );
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('reports the devices it processed', async () => {
      deviceMaintenanceService.enforceStrictModeOnPendingDevices.mockResolvedValue(
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
      await tick();
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
      await tick();

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
