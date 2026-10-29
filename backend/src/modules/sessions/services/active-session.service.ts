import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { NotificationOrchestratorService } from '@/modules/notifications/services/notification-orchestrator.service';
import {
  EnrichedPlexSessionsResponse,
  PlexSessionsResponse,
} from '@/types/plex.types';
import {
  PlexSessionData,
  sessionsFromPlexData,
  toSessionRecord,
} from '@/modules/sessions/services/plex-session-record';
import { toEnrichedSession } from '@/modules/sessions/services/enriched-session';

@Injectable()
export class ActiveSessionService {
  private readonly logger = new Logger(ActiveSessionService.name);

  constructor(
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    private deviceTrackingService: DeviceTrackingService,
    @Inject(forwardRef(() => PlexClient))
    private plexClient: PlexClient,
    @Inject(forwardRef(() => NotificationOrchestratorService))
    private notificationOrchestrator: NotificationOrchestratorService,
  ) {}

  async updateActiveSessions(
    sessionsData: PlexSessionsResponse | null | undefined,
  ): Promise<void> {
    try {
      const sessions = sessionsFromPlexData(sessionsData);
      const currentSessionKeys = sessions
        .map((s) => s.sessionKey)
        .filter(Boolean);

      const endingSessions = await this.sessionHistoryRepository.find({
        where: { sessionKey: Not(In(currentSessionKeys)), endedAt: IsNull() },
      });
      const endingSessionKeys = endingSessions.map((s) => s.sessionKey);

      if (endingSessionKeys.length > 0) {
        await this.sessionHistoryRepository.update(
          { sessionKey: In(endingSessionKeys), endedAt: IsNull() },
          { endedAt: new Date(), playerState: 'stopped' },
        );
      }

      for (const sessionKey of endingSessionKeys) {
        await this.deviceTrackingService.clearSessionKey(sessionKey);
      }

      for (const sessionData of sessions) {
        await this.upsertSession(sessionData);
      }
    } catch (error) {
      this.logger.error('Error updating active sessions', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<SessionHistory[]> {
    return this.sessionHistoryRepository.find({
      where: { endedAt: IsNull() },
      relations: { userDevice: true, userPreference: true },
      order: { startedAt: 'DESC' },
    });
  }

  async getActiveSessionsFormatted(): Promise<EnrichedPlexSessionsResponse> {
    try {
      const sessions = await this.getActiveSessions();
      const serverIdentifier = await this.plexClient.getServerIdentity();
      const metadata = sessions.map((session) =>
        toEnrichedSession(session, serverIdentifier),
      );

      return {
        MediaContainer: { size: metadata.length, Metadata: metadata },
      };
    } catch (error) {
      this.logger.error('Error getting active sessions formatted', error);
      throw error;
    }
  }

  private isPlexampDevice(product?: string): boolean {
    return product?.toLowerCase().includes('plexamp') ?? false;
  }

  private async upsertSession(sessionData: PlexSessionData): Promise<void> {
    try {
      if (!sessionData.sessionKey) {
        this.logger.warn('Session missing session key, skipping');
        return;
      }

      const existingSession = await this.currentSessionFor(sessionData);
      const userDevice = await this.findUserDevice(sessionData);
      await this.ensureUserPreference(sessionData);

      const record = toSessionRecord(sessionData, userDevice?.id);

      if (existingSession) {
        await this.sessionHistoryRepository.update(
          { sessionKey: sessionData.sessionKey, endedAt: IsNull() },
          record,
        );
        return;
      }

      await this.sessionHistoryRepository.save(
        this.sessionHistoryRepository.create(record),
      );
      await this.notificationOrchestrator.linkOrphanedNotifications(
        sessionData.sessionKey,
      );
    } catch (error) {
      this.logger.error(
        `Error upserting session ${sessionData.sessionKey}`,
        error,
      );
    }
  }

  private async currentSessionFor(
    sessionData: PlexSessionData,
  ): Promise<SessionHistory | null> {
    const existingSession = await this.sessionHistoryRepository.findOne({
      where: { sessionKey: sessionData.sessionKey, endedAt: IsNull() },
    });

    const trackChanged =
      existingSession &&
      this.isPlexampDevice(sessionData.Player?.product) &&
      sessionData.ratingKey &&
      existingSession.ratingKey &&
      sessionData.ratingKey !== existingSession.ratingKey;

    if (!trackChanged) {
      return existingSession;
    }

    await this.sessionHistoryRepository.update(existingSession.id, {
      endedAt: new Date(),
      playerState: 'stopped',
    });
    return null;
  }

  private async findUserDevice(
    sessionData: PlexSessionData,
  ): Promise<UserDevice | null> {
    const userId = sessionData.User?.id;
    const deviceIdentifier = sessionData.Player?.machineIdentifier;
    if (!userId || !deviceIdentifier) {
      return null;
    }

    return this.userDeviceRepository.findOne({
      where: { userId, deviceIdentifier },
    });
  }

  private async ensureUserPreference(
    sessionData: PlexSessionData,
  ): Promise<void> {
    const user = sessionData.User;
    if (!user?.id) {
      return;
    }

    const existing = await this.userPreferenceRepository.findOne({
      where: { userId: user.id },
    });
    if (existing || !user.title) {
      return;
    }

    await this.userPreferenceRepository.save(
      this.userPreferenceRepository.create({
        userId: user.id,
        username: user.title,
        defaultBlock: null,
        hidden: false,
      }),
    );
  }
}
