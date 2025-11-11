import { Injectable, Logger } from '@nestjs/common';
import { PlexSessionsResponse } from '../types/plex.types';
import { ActiveSessionService } from '../modules/sessions/services/active-session.service';
import { DeviceTrackingService } from '../modules/devices/services/device-tracking.service';
import { SessionTerminationService } from '../modules/plex/services/session-termination.service';

/**
 * Session Orchestrator Service
 *
 * Coordinates the entire session update workflow.
 * Ensures operations happen in the correct order:
 * 1. Track devices from session data
 * 2. Update active sessions in database
 * 3. Enforce access restrictions and terminate unauthorized sessions
 */
@Injectable()
export class SessionOrchestratorService {
  private readonly logger = new Logger(SessionOrchestratorService.name);

  constructor(
    private readonly activeSessionService: ActiveSessionService,
    private readonly deviceTrackingService: DeviceTrackingService,
    private readonly sessionTerminationService: SessionTerminationService,
  ) {}

  /**
   * Orchestrates the complete session update workflow.
   * Each step handles its own error logging.
   *
   * 1. Track devices - ensures devices exist before session history references them
   * 2. Update session history
   * 3. Enforce restrictions - validates and terminates unauthorized sessions
   */
  async orchestrateSessionUpdate(
    sessionsData: PlexSessionsResponse,
  ): Promise<PlexSessionsResponse> {
    try {
      // 1: Create new devices, update existing ones, and trigger new device notifications
      // This must happen FIRST so session history can reference the device ID
      await this.trackDevicesFromSessions(sessionsData);

      // 2: Create/update session records for all active sessions
      await this.updateSessionHistory(sessionsData);

      // 3: Validate devices, IP policies, time restrictions and terminate unauthorized sessions
      // This triggers stream blocked notifications
      await this.enforceAccessRestrictions(sessionsData);

      return sessionsData;
    } catch (error) {
      this.logger.error('Error in session orchestration workflow', error);
      throw error;
    }
  }

  /**
   * Update active sessions in the database.
   * Creates new records, updates existing ones, and marks ended sessions.
   */
  private async updateSessionHistory(
    sessionsData: PlexSessionsResponse,
  ): Promise<void> {
    try {
      await this.activeSessionService.updateActiveSessions(sessionsData);
    } catch (error) {
      this.logger.error('Failed to update session history', error);
      // Don't throw - continue with other steps
    }
  }

  /**
   * Track devices from sessions.
   * Creates new device records and updates existing ones.
   */
  private async trackDevicesFromSessions(
    sessionsData: PlexSessionsResponse,
  ): Promise<void> {
    try {
      await this.deviceTrackingService.processSessionsForDeviceTracking(
        sessionsData,
      );
    } catch (error) {
      this.logger.error('Failed to track devices from sessions', error);
      // Don't throw - continue with other steps
    }
  }

  /**
   * Enforce access restrictions.
   * Validates devices, IP policies, time restrictions and terminates unauthorized sessions.
   */
  private async enforceAccessRestrictions(
    sessionsData: PlexSessionsResponse,
  ): Promise<void> {
    try {
      await this.sessionTerminationService.stopUnapprovedSessions(sessionsData);
    } catch (error) {
      this.logger.error('Failed to enforce access restrictions', error);
      // Don't throw - this is the last step
    }
  }
}
