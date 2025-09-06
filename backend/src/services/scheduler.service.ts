import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlexService } from '../modules/plex/services/plex.service';
import { config } from '../config/app.config';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private readonly plexService: PlexService) {}

  onModuleInit() {
    this.startSessionUpdates();
  }

  private startSessionUpdates() {
    const intervalMs = config.plex.refreshInterval * 1000;

    this.logger.log(
      `Starting session update scheduler (interval: ${config.plex.refreshInterval}s)`,
    );

    this.intervalId = setInterval(async () => {
      try {
        await this.plexService.updateActiveSessions();
      } catch (error) {
        this.logger.error('Error during scheduled session update:', error);
      }
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Session update scheduler stopped');
    }
  }
}
