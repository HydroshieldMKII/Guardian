import { Injectable } from '@nestjs/common';
import { ActiveSessionService } from '../sessions/services/active-session.service';
import { DeviceTrackingService } from '../devices/services/device-tracking.service';
import { ConfigService } from '../config/services/config.service';

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
  };
  stats: {
    activeStreams: number;
    totalDevices: number;
    pendingDevices: number;
    approvedDevices: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly activeSessionService: ActiveSessionService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly configService: ConfigService,
  ) {}

  async getDashboardData(): Promise<DashboardData> {
    try {
      // Check Plex status and fetch settings in parallel
      const [plexStatus, settings] = await Promise.all([
        this.configService.getPlexConfigurationStatus(),
        this.configService.getAllSettings(),
      ]);

      // If Plex is not properly configured, return minimal data but still include settings
      if (!plexStatus.configured || !plexStatus.hasValidCredentials) {
        return {
          plexStatus,
          settings,
          sessions: { MediaContainer: { size: 0, Metadata: [] } },
          devices: { all: [], pending: [], approved: [] },
          stats: {
            activeStreams: 0,
            totalDevices: 0,
            pendingDevices: 0,
            approvedDevices: 0,
          },
        };
      }

      // Fetch all data in parallel
      const [sessions, allDevices, pendingDevices, approvedDevices] = 
        await Promise.all([
          this.activeSessionService.getActiveSessionsFormatted(),
          this.deviceTrackingService.getAllDevices(),
          this.deviceTrackingService.getPendingDevices(),
          this.deviceTrackingService.getApprovedDevices(),
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
        },
        stats,
      };
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      throw error;
    }
  }
}