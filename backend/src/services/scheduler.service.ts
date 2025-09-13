import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PlexService } from '../modules/plex/services/plex.service';
import { ConfigService } from '../modules/config/services/config.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private currentInterval: number;

  constructor(
    private readonly plexService: PlexService,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.startSessionUpdates();
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

  onModuleDestroy() {
    this.stopScheduler();
    this.logger.log('Session update scheduler stopped');
  }
}
