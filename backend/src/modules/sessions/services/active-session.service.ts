import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveSession } from '../../../entities/active-session.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';

interface PlexSessionData {
  sessionKey: string;
  User?: {
    id?: string;
    title?: string;
  };
  Player?: {
    machineIdentifier?: string;
    platform?: string;
    product?: string;
    title?: string;
    device?: string;
    address?: string;
    state?: string;
  };
  Media?: Array<{
    videoResolution?: string;
    bitrate?: number;
    container?: string;
    videoCodec?: string;
    audioCodec?: string;
  }>;
  Session?: {
    id?: string;
    bandwidth?: number;
    location?: string;
  };
  title?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  year?: number;
  duration?: number;
  viewOffset?: number;
  type?: string;
  thumb?: string;
  art?: string;
}

@Injectable()
export class ActiveSessionService {
  private readonly logger = new Logger(ActiveSessionService.name);

  constructor(
    @InjectRepository(ActiveSession)
    private activeSessionRepository: Repository<ActiveSession>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private deviceTrackingService: DeviceTrackingService,
  ) {}

  // Update active sessions in the database based on the latest sessions data from Plex
  async updateActiveSessions(sessionsData: any): Promise<void> {
    try {
      const sessions = this.extractSessionsFromData(sessionsData);

      // Current session keys
      const currentSessionKeys = sessions
        .map((s) => s.sessionKey)
        .filter(Boolean);

      // Get full session data that are about to be removed (devices that stopped streaming)
      const endingSessions = await this.activeSessionRepository
        .createQueryBuilder('session')
        .where('session.sessionKey NOT IN (:...sessionKeys)', {
          sessionKeys: currentSessionKeys,
        })
        .getMany();

      const endingSessionKeys = endingSessions.map(s => s.sessionKey);

      // Save ended sessions to history before removing them
      for (const endedSession of endingSessions) {
        await this.saveSessionToHistory(endedSession);
      }

      // Remove sessions that are no longer active
      await this.activeSessionRepository
        .createQueryBuilder()
        .delete()
        .where('session_key NOT IN (:...sessionKeys)', {
          sessionKeys: currentSessionKeys,
        })
        .execute();
      
      // Clear session keys from devices for ended sessions only
      for (const sessionKey of endingSessionKeys) {
        await this.deviceTrackingService.clearSessionKey(sessionKey);
      }

      // Update or create sessions
      for (const sessionData of sessions) {
        await this.upsertSession(sessionData);
      }

      // this.logger.log(`Updated ${sessions.length} active sessions in database`);
    } catch (error) {
      this.logger.error('Error updating active sessions', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<ActiveSession[]> {
    return this.activeSessionRepository.find({
      order: { lastActivity: 'DESC' },
    });
  }

  private extractSessionsFromData(data: any): PlexSessionData[] {
    if (!data || !data.MediaContainer) {
      return [];
    }

    return data.MediaContainer.Metadata || [];
  }

  private async upsertSession(sessionData: PlexSessionData): Promise<void> {
    try {
      if (!sessionData.sessionKey) {
        this.logger.warn('Session missing session key, skipping');
        return;
      }

      const media = sessionData.Media?.[0];
      const user = sessionData.User;
      const player = sessionData.Player;
      const session = sessionData.Session;

      // Check if session exists
      const existingSession = await this.activeSessionRepository.findOne({
        where: { sessionKey: sessionData.sessionKey },
      });

      const sessionData_partial = {
        sessionKey: sessionData.sessionKey,
        ...(user?.id && { userId: user.id }),
        ...(user?.title && { username: user.title }),
        ...(player?.machineIdentifier && {
          deviceIdentifier: player.machineIdentifier,
        }),
        ...(player?.device && { deviceName: player.device }),
        ...(player?.platform && { devicePlatform: player.platform }),
        ...(player?.product && { deviceProduct: player.product }),
        ...(player?.title && { deviceTitle: player.title }),
        ...(player?.address && { deviceAddress: player.address }),
        ...(player?.state && { playerState: player.state }),
        ...(sessionData.title && { contentTitle: sessionData.title }),
        ...(sessionData.type && { contentType: sessionData.type }),
        ...(sessionData.grandparentTitle && {
          grandparentTitle: sessionData.grandparentTitle,
        }),
        ...(sessionData.parentTitle && {
          parentTitle: sessionData.parentTitle,
        }),
        ...(sessionData.year && { year: sessionData.year }),
        ...(sessionData.duration && { duration: sessionData.duration }),
        ...(sessionData.viewOffset !== undefined && {
          viewOffset: sessionData.viewOffset,
        }),
        ...(sessionData.thumb && { thumb: sessionData.thumb }),
        ...(sessionData.art && { art: sessionData.art }),
        ...(media?.videoResolution && {
          videoResolution: media.videoResolution,
        }),
        ...(media?.bitrate && { bitrate: media.bitrate }),
        ...(media?.container && { container: media.container }),
        ...(media?.videoCodec && { videoCodec: media.videoCodec }),
        ...(media?.audioCodec && { audioCodec: media.audioCodec }),
        ...(session?.location && { sessionLocation: session.location }),
        ...(session?.bandwidth && { bandwidth: session.bandwidth }),
        lastActivity: new Date(),
      };

      if (existingSession) {
        await this.activeSessionRepository.update(
          { sessionKey: sessionData.sessionKey },
          sessionData_partial,
        );
      } else {
        await this.activeSessionRepository.save(
          this.activeSessionRepository.create(sessionData_partial),
        );
      }
    } catch (error) {
      this.logger.error(
        `Error upserting session ${sessionData.sessionKey}`,
        error,
      );
    }
  }

  async removeSession(sessionKey: string): Promise<void> {
    await this.activeSessionRepository.delete({ sessionKey });
    await this.deviceTrackingService.clearSessionKey(sessionKey);
    this.logger.log(`Removed session ${sessionKey} from database and cleared device session key`);
  }

  async getActiveSessionsFormatted(): Promise<any> {
    try {
      const sessions = await this.getActiveSessions();

      const deviceSessionCounts = new Map<string, number>();
      const deviceCustomNames = new Map<string, string>();
      
      for (const session of sessions) {
        if (session.userId && session.deviceIdentifier) {
          const key = `${session.userId}-${session.deviceIdentifier}`;
          if (!deviceSessionCounts.has(key)) {
            const device = await this.userDeviceRepository.findOne({
              where: {
                userId: session.userId,
                deviceIdentifier: session.deviceIdentifier,
              },
            });
            deviceSessionCounts.set(key, device?.sessionCount || 0);
            // Store custom device name if it exists
            if (device?.deviceName) {
              deviceCustomNames.set(key, device.deviceName);
            }
          }
        }
      }

      const transformedSessions = sessions.map((session) => {
        const deviceKey = `${session.userId}-${session.deviceIdentifier}`;
        const sessionCount = deviceSessionCounts.get(deviceKey) || 0;
        const customDeviceName = deviceCustomNames.get(deviceKey);
        
        return {
          sessionKey: session.sessionKey,
          User: {
            id: session.userId,
            title: session.username,
          },
          Player: {
            machineIdentifier: session.deviceIdentifier,
            platform: session.devicePlatform,
            product: session.deviceProduct,
            title: customDeviceName,
            device: session.deviceName,
            address: session.deviceAddress,
            state: session.playerState as 'playing' | 'paused' | 'buffering',
            originalTitle: session.deviceTitle,
          },
          Media:
            session.videoResolution || session.bitrate || session.container
              ? [
                  {
                    videoResolution: session.videoResolution,
                    bitrate: session.bitrate,
                    container: session.container,
                    videoCodec: session.videoCodec,
                    audioCodec: session.audioCodec,
                  },
                ]
              : [],
          Session: {
            id: session.sessionKey,
            bandwidth: session.bandwidth,
            location: session.sessionLocation as 'lan' | 'wan',
            sessionCount: sessionCount,
          },
          title: session.contentTitle,
          grandparentTitle: session.grandparentTitle,
          parentTitle: session.parentTitle,
          year: session.year,
          duration: session.duration,
          viewOffset: session.viewOffset,
          type: session.contentType,
          thumb: session.thumb,
          art: session.art,
        };
      });

      return {
        MediaContainer: {
          size: transformedSessions.length,
          Metadata: transformedSessions,
        },
      };
    } catch (error: any) {
      this.logger.error('Error getting active sessions formatted', error);
      throw error;
    }
  }

  private async saveSessionToHistory(session: ActiveSession): Promise<void> {
    try {
      // Check if this session already exists in history
      const existingHistory = await this.sessionHistoryRepository.findOne({
        where: { sessionKey: session.sessionKey }
      });

      if (existingHistory) {
        // Update end time if it doesn't exist
        if (!existingHistory.endedAt) {
          existingHistory.endedAt = new Date();
          await this.sessionHistoryRepository.save(existingHistory);
        }
        return;
      }

      // Create new history entry using destructuring and spread (clean and type-safe)
      const { id, createdAt, updatedAt, lastActivity, ...sessionData } = session;
      
      const sessionHistory = this.sessionHistoryRepository.create({
        ...sessionData,
        startedAt: createdAt,
        endedAt: new Date(),
      });

      await this.sessionHistoryRepository.save(sessionHistory);
      this.logger.debug(`Saved session ${session.sessionKey} to history for user ${session.userId}`);
    } catch (error) {
      this.logger.error(`Failed to save session ${session.sessionKey} to history:`, error);
    }
  }

  async getUserSessionHistory(userId: string, limit: number = 50): Promise<SessionHistory[]> {
    try {
      return await this.sessionHistoryRepository.find({
        where: { userId },
        order: { startedAt: 'DESC' },
        take: limit
      });
    } catch (error) {
      this.logger.error(`Failed to get session history for user ${userId}:`, error);
      throw error;
    }
  }
}
