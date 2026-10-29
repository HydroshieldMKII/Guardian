import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { PlexService } from '@/modules/plex/services/plex.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { MIN_REFRESH_INTERVAL_SECONDS } from '@/modules/config/services/setting-validation';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { DeviceMaintenanceService } from '@/modules/devices/services/device-maintenance.service';
import { PlexUserSyncService } from '@/modules/users/services/plex-user-sync.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { Logger } from '@nestjs/common';
import { errorMessage } from '@/common/utils/error-types';
import { DashboardService } from '@/modules/dashboard/dashboard.service';
import { LiveEventsService } from '@/modules/events/live-events.service';

const SESSION_UPDATES_JOB = 'sessionUpdates';
const DEFAULT_REFRESH_SECONDS = 10;

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private sessionUpdateRunning = false;

  constructor(
    private readonly plexService: PlexService,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly deviceMaintenanceService: DeviceMaintenanceService,
    private readonly plexUserSync: PlexUserSyncService,
    private readonly authSessions: AuthSessionService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly dashboardService: DashboardService,
    private readonly liveEvents: LiveEventsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Scheduler service initialized with cron jobs');
    await this.scheduleSessionUpdates();

    this.configService.addConfigChangeListener(
      'PLEXGUARD_REFRESH_INTERVAL',
      () => {
        this.logger.log('Refresh interval changed, rescheduling updates...');
        void this.scheduleSessionUpdates();
      },
    );

    this.configService.addConfigChangeListener('PLEX_GUARD_STRICT_MODE', () => {
      this.logger.log(
        'Strict mode setting changed, checking pending devices...',
      );
      void this.enforceStrictMode();
    });

    await this.handleSessionUpdates();
    await this.performDeviceCleanup();
    await this.syncPlexUsers();
    await this.enforceStrictMode();
  }

  private async scheduleSessionUpdates(): Promise<void> {
    try {
      const seconds = await this.refreshIntervalSeconds();

      if (this.schedulerRegistry.doesExist('interval', SESSION_UPDATES_JOB)) {
        this.schedulerRegistry.deleteInterval(SESSION_UPDATES_JOB);
      }
      this.schedulerRegistry.addInterval(
        SESSION_UPDATES_JOB,
        setInterval(
          () => void this.runScheduledSessionUpdate(),
          seconds * 1000,
        ),
      );

      this.logger.log(`Session updates scheduled every ${seconds}s`);
    } catch (error) {
      this.logger.error('Error scheduling session updates:', error);
    }
  }

  private async refreshIntervalSeconds(): Promise<number> {
    const stored = await this.configService.getSetting(
      'PLEXGUARD_REFRESH_INTERVAL',
    );
    const seconds =
      Number.isInteger(stored) && stored ? stored : DEFAULT_REFRESH_SECONDS;
    return Math.max(seconds, MIN_REFRESH_INTERVAL_SECONDS);
  }

  private async runScheduledSessionUpdate(): Promise<void> {
    if (this.sessionUpdateRunning) {
      this.logger.debug('Skipping session update - previous one still running');
      return;
    }
    this.sessionUpdateRunning = true;
    try {
      await this.handleSessionUpdates();
    } finally {
      this.sessionUpdateRunning = false;
    }
  }

  private async broadcastDashboard(): Promise<void> {
    if (!this.liveEvents.hasListeners()) {
      return;
    }

    try {
      const dashboard = await this.dashboardService.getDashboardData();
      this.liveEvents.broadcastDashboard(dashboard);
    } catch (error) {
      this.logger.error('Failed to broadcast dashboard update:', error);
    }
  }

  private async handleSessionUpdates() {
    try {
      const [ip, port, token] = await Promise.all([
        this.configService.getSetting('PLEX_SERVER_IP'),
        this.configService.getSetting('PLEX_SERVER_PORT'),
        this.configService.getSetting('PLEX_TOKEN'),
      ]);

      if (!ip || !port || !token) {
        this.logger.debug('Skipping session update - Plex not configured');
        return;
      }

      await this.plexService.updateActiveSessions();
    } catch (error) {
      if (
        !errorMessage(error).includes('Missing required Plex configuration')
      ) {
        this.logger.error('Error during scheduled session update:', error);
      }
    } finally {
      await this.broadcastDashboard();
    }
  }

  private async performDeviceCleanup() {
    try {
      const [cleanupEnabled, cleanupIntervalDays] = await Promise.all([
        this.configService.getSetting('DEVICE_CLEANUP_ENABLED'),
        this.configService.getSetting('DEVICE_CLEANUP_INTERVAL_DAYS'),
      ]);

      const isEnabled = cleanupEnabled === true;
      const intervalDays = cleanupIntervalDays ?? 0;

      if (!isEnabled) {
        this.logger.debug(`Skipping device cleanup - feature is disabled`);
        return;
      }

      this.logger.log(
        `Running device cleanup for devices inactive for ${intervalDays} days...`,
      );
      await this.deviceMaintenanceService.cleanupInactiveDevices(intervalDays);
    } catch (error) {
      this.logger.error('Error during device cleanup:', error);
    }
  }

  private async enforceStrictMode(): Promise<void> {
    try {
      const processedCount =
        await this.deviceMaintenanceService.enforceStrictModeOnPendingDevices();
      if (processedCount > 0) {
        this.logger.log(
          `Strict mode enforcement: ${processedCount} pending device(s) processed`,
        );
      }
    } catch (error) {
      this.logger.error('Error enforcing strict mode:', error);
    }
  }

  @Cron('0 0 2 * * *', {
    name: 'deviceCleanup',
  })
  async handleDeviceCleanup() {
    try {
      const cleanupEnabled = await this.configService.getSetting(
        'DEVICE_CLEANUP_ENABLED',
      );
      const isEnabled = cleanupEnabled === true;

      if (!isEnabled) {
        this.logger.debug(
          'Device cleanup is disabled - skipping scheduled cleanup',
        );
        return;
      }

      this.logger.log('Running scheduled device cleanup...');
      await this.performDeviceCleanup();
    } catch (error) {
      this.logger.error('Error during scheduled device cleanup:', error);
    }
  }

  @Cron('0 0 * * * *', {
    name: 'syncPlexUsers',
  })
  async handlePlexUserSync() {
    await this.syncPlexUsers();
  }

  @Cron('0 0 * * * *', {
    name: 'sessionCleanup',
  })
  async handleSessionCleanup() {
    try {
      this.logger.log('Running scheduled session cleanup...');
      const deletedCount = await this.authSessions.cleanupExpiredSessions();
      this.logger.log(
        `Session cleanup completed: ${deletedCount} expired sessions removed`,
      );
    } catch (error) {
      this.logger.error('Error during scheduled session cleanup:', error);
    }
  }

  @Cron('0 0 * * * *', {
    name: 'sessionKeyMemoryCleanup',
  })
  handleSessionKeyMemoryCleanup() {
    this.deviceTrackingService.cleanupStaleSessionKeys();
  }

  private async syncPlexUsers() {
    try {
      const token = await this.configService.getSetting('PLEX_TOKEN');

      if (!token) {
        this.logger.debug(
          'Skipping Plex users sync - Plex token not configured',
        );
        return;
      }

      this.logger.log('Syncing Plex Home users from Plex.tv...');
      const result = await this.plexUserSync.syncUsersFromPlexTV();
      this.logger.log(
        `Plex users sync completed: ${result.created} created, ${result.updated} updated, ${result.errors} errors`,
      );
    } catch (error) {
      this.logger.error('Error during Plex users sync:', error);
    }
  }
}
