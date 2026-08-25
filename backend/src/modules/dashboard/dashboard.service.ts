import { Injectable, Logger } from '@nestjs/common';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { UsersService } from '@/modules/users/services/users.service';
import { PlexService } from '@/modules/plex/services/plex.service';
import { asHttpError } from '@/common/utils/error-types';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { EnrichedPlexSessionsResponse } from '@/types/plex.types';

export interface DashboardData {
  plexStatus: {
    configured: boolean;
    hasValidCredentials: boolean;
    connectionStatus: string;
  };
  settings: AppSettings[];
  sessions: EnrichedPlexSessionsResponse;
  devices: {
    all: UserDevice[];
    pending: UserDevice[];
    approved: UserDevice[];
    processed: UserDevice[];
  };
  users: UserPreference[];

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

      // Helper function to identify PlexAmp devices
      const isPlexAmpDevice = (device: UserDevice) => {
        return (
          device.deviceProduct?.toLowerCase().includes('plexamp') ||
          device.deviceName?.toLowerCase().includes('plexamp')
        );
      };

      // Filter out PlexAmp devices from pending count
      const manageablePendingDevices = pendingDevices.filter(
        (device) => !isPlexAmpDevice(device),
      );

      // Calculate stats
      const stats = {
        activeStreams: sessions?.MediaContainer?.size || 0,
        totalDevices: allDevices.length,
        pendingDevices: manageablePendingDevices.length,
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
        asHttpError(error).stack || error,
      );
      throw error;
    }
  }
}
