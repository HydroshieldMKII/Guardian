import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PlexService } from '../modules/plex/services/plex.service';
import { ConfigService } from '../modules/config/services/config.service';
import { DeviceTrackingService } from '../modules/devices/services/device-tracking.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private currentInterval: number;
  private configChangeCallback: () => void;

  constructor(
    private readonly plexService: PlexService,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
    private readonly deviceTrackingService: DeviceTrackingService,
  ) {}

  async onModuleInit() {
    // Register listener for refresh interval changes
    this.configChangeCallback = () => {
      this.logger.log('Refresh interval changed, restarting scheduler...');
      this.restartScheduler().catch(error => {
        this.logger.error('Failed to restart scheduler after config change:', error);
      });
    };
    
    this.configService.addConfigChangeListener('PLEXGUARD_REFRESH_INTERVAL', this.configChangeCallback);

    await this.startSessionUpdates();
    await this.startDeviceCleanupScheduler();
  }

  async restartScheduler() {
    this.logger.log('Restarting scheduler with updated interval...');
    this.stopScheduler();
    await this.startSessionUpdates();
  }

  private stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private stopDeviceCleanupScheduler() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  private async startSessionUpdates() {
    try {
      const refreshInterval = await this.configService.getSetting(
        'PLEXGUARD_REFRESH_INTERVAL',
      );
      const intervalSeconds = parseInt(refreshInterval as string, 10) || 10;
      const intervalMs = intervalSeconds * 1000;

      // Check if interval has changed
      if (this.currentInterval !== intervalSeconds) {
        this.currentInterval = intervalSeconds;
        this.logger.log(
          `Starting session update scheduler (interval: ${intervalSeconds}s)`,
        );
      }

      this.intervalId = setInterval(async () => {
        // this.logger.log('Scheduler tick - checking for active sessions to update');
        try {
          // Check if Plex is properly configured before attempting to update sessions
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
          // Only log errors that are not configuration-related
          if (!error.message.includes('Missing required Plex configuration')) {
            this.logger.error('Error during scheduled session update:', error);
          }
        }
      }, intervalMs);
    } catch (error) {
      this.logger.error('Error starting scheduler:', error);
      // Fallback to default interval
      const fallbackInterval = 10 * 1000;
      this.currentInterval = 10;
      this.logger.log(`Using fallback interval: 10s`);

      this.intervalId = setInterval(async () => {
        try {
          // Check if Plex is properly configured before attempting to update sessions
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
          // Only log errors that are not configuration-related
          if (!error.message.includes('Missing required Plex configuration')) {
            this.logger.error('Error during scheduled session update:', error);
          }
        }
      }, fallbackInterval);
    }
  }

  private async startDeviceCleanupScheduler() {
    try {
      this.logger.log('Starting device cleanup scheduler (checking every 1 hour)');

      // Run cleanup immediately on startup
      await this.performDeviceCleanup();

      // Schedule cleanup to run every hour (3600000 ms)
      const cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
      this.cleanupIntervalId = setInterval(async () => {
        await this.performDeviceCleanup();
      }, cleanupIntervalMs);

    } catch (error) {
      this.logger.error('Error starting device cleanup scheduler:', error);
    }
  }

  private async performDeviceCleanup() {
    try {
      // Get current settings each time cleanup runs
      const [cleanupEnabled, cleanupIntervalDays] = await Promise.all([
        this.configService.getSetting('DEVICE_CLEANUP_ENABLED'),
        this.configService.getSetting('DEVICE_CLEANUP_INTERVAL_DAYS'),
      ]);

      const isEnabled = cleanupEnabled === 'true';
      const intervalDays = parseInt(cleanupIntervalDays as string, 10) || 30;

      if (!isEnabled) {
        this.logger.debug('Skipping device cleanup - feature is disabled');
        return;
      }

      this.logger.log(`Running device cleanup for devices inactive for ${intervalDays} days...`);
      const result = await this.deviceTrackingService.cleanupInactiveDevices(intervalDays);
      
      if (result.deletedCount > 0) {
        this.logger.log(`Device cleanup completed: ${result.deletedCount} inactive devices removed`);
      } else {
        this.logger.debug('Device cleanup completed: no inactive devices found');
      }
    } catch (error) {
      this.logger.error('Error during device cleanup:', error);
    }
  }

  onModuleDestroy() {
    // Remove config change listener
    if (this.configChangeCallback) {
      this.configService.removeConfigChangeListener('PLEXGUARD_REFRESH_INTERVAL', this.configChangeCallback);
    }
    
    this.stopScheduler();
    this.stopDeviceCleanupScheduler();
    this.logger.log('Schedulers stopped');
  }
}
