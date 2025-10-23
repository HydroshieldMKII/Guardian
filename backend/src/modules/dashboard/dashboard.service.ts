import { Injectable, Logger } from '@nestjs/common';
import { ActiveSessionService } from '../sessions/services/active-session.service';
import { DeviceTrackingService } from '../devices/services/device-tracking.service';
import { ConfigService } from '../config/services/config.service';
import { UsersService } from '../users/services/users.service';
import { PlexService } from '../plex/services/plex.service';

export interface DashboardData {
  plexStatus: {
    configured: boolean;
    hasValidCredentials: boolean;
    connectionStatus: string;
  };
  settings: any[];
  sessions: any;
  devices: {
    all: any[];
    pending: any[];
    approved: any[];
    processed: any[];
  };
  users: any[];

  stats: {
    activeStreams: number;
    totalDevices: number;
    pendingDevices: number;
    approvedDevices: number;
  };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly activeSessionService: ActiveSessionService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly plexService: PlexService,
  ) {}

  async getDashboardData(): Promise<DashboardData> {
    try {
      // Check Plex status and fetch settings in parallel
      const [plexStatus, settings] = await Promise.all([
        this.configService.getPlexConfigurationStatus(),
        this.configService.getPublicSettings(),
      ]);

      // If Plex is not properly configured, return minimal data but still include settings
      if (!plexStatus.configured || !plexStatus.hasValidCredentials) {
        return {
          plexStatus,
          settings,
          sessions: { MediaContainer: { size: 0, Metadata: [] } },
          devices: { all: [], pending: [], approved: [], processed: [] },
          users: [],
          stats: {
            activeStreams: 0,
            totalDevices: 0,
            pendingDevices: 0,
            approvedDevices: 0,
          },
        };
      }

      // Fetch all data in parallel
      const [
        sessions,
        allDevices,
        pendingDevices,
        approvedDevices,
        processedDevices,
        users,
      ] = await Promise.all([
        this.plexService.getActiveSessionsWithMediaUrls(),
        this.deviceTrackingService.getAllDevices(),
        this.deviceTrackingService.getPendingDevices(),
        this.deviceTrackingService.getApprovedDevices(),
        this.deviceTrackingService.getProcessedDevices(),
        this.usersService.getAllUsers(true),
      ]);

      // Calculate stats
      const stats = {
        activeStreams: sessions?.MediaContainer?.size || 0,
        totalDevices: allDevices.length,
        pendingDevices: pendingDevices.length,
        approvedDevices: approvedDevices.length,
      };

      return {
        plexStatus,
        settings,
        sessions,
        devices: {
          all: allDevices,
          pending: pendingDevices,
          approved: approvedDevices,
          processed: processedDevices,
        },
        users,
        stats,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch dashboard data',
        error?.stack || error,
      );
      throw error;
    }
  }
}
