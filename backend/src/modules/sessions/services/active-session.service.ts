import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

      // Get sessions that are about to end (not in current sessions but exist in DB without endedAt)
      const endingSessions = await this.sessionHistoryRepository
        .createQueryBuilder('session')
        .where('session.sessionKey NOT IN (:...sessionKeys)', {
          sessionKeys: currentSessionKeys,
        })
        .andWhere('session.endedAt IS NULL')
        .getMany();

      const endingSessionKeys = endingSessions.map(s => s.sessionKey);

      // Mark ended sessions with endedAt timestamp and update player state
      if (endingSessionKeys.length > 0) {
        await this.sessionHistoryRepository
          .createQueryBuilder()
          .update(SessionHistory)
          .set({ 
            endedAt: new Date(),
            playerState: 'stopped'
          })
          .where('sessionKey IN (:...sessionKeys)', {
            sessionKeys: endingSessionKeys,
          })
          .execute();
      }
      
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

  async getActiveSessions(): Promise<SessionHistory[]> {
    return this.sessionHistoryRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.userDevice', 'device')
      .where('session.endedAt IS NULL') // Only get active sessions (no end date)
      .orderBy('session.startedAt', 'DESC')
      .getMany();
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

      // Check if session exists (active session = no endedAt)
      const existingSession = await this.sessionHistoryRepository
        .createQueryBuilder('session')
        .where('session.sessionKey = :sessionKey', { sessionKey: sessionData.sessionKey })
        .andWhere('session.endedAt IS NULL')
        .getOne();

      // Find the UserDevice to get the foreign key
      let userDevice: UserDevice | null = null;
      if (user?.id && player?.machineIdentifier) {
        userDevice = await this.userDeviceRepository.findOne({
          where: {
            userId: user.id,
            deviceIdentifier: player.machineIdentifier,
          },
        });
      }

      const sessionData_partial = {
        sessionKey: sessionData.sessionKey,
        ...(user?.id && { userId: user.id }),
        ...(user?.title && { username: user.title }),
        ...(userDevice?.id && { userDeviceId: userDevice.id }),
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
      };

      if (existingSession) {
        // Update existing active session 
        await this.sessionHistoryRepository
          .createQueryBuilder()
          .update(SessionHistory)
          .set(sessionData_partial)
          .where('sessionKey = :sessionKey', { sessionKey: sessionData.sessionKey })
          .andWhere('endedAt IS NULL')
          .execute();
      } else {
        // Create new session (startedAt will be auto-generated, no endedAt)
        await this.sessionHistoryRepository.save(
          this.sessionHistoryRepository.create(sessionData_partial),
        );
      }
    } catch (error) {
      this.logger.error(
        `Error upserting session ${sessionData.sessionKey}`,
        error,
      );
    }
  }

  async getActiveSessionsFormatted(): Promise<any> {
    try {
      const sessions = await this.getActiveSessions();

      const transformedSessions = sessions.map((session) => {
        const device = session.userDevice;
        
        return {
          sessionKey: session.sessionKey,
          User: {
            id: session.userId,
            title: session.username,
          },
          Player: {
            machineIdentifier: device?.deviceIdentifier || 'Unknown',
            platform: device?.devicePlatform || 'Unknown',
            product: device?.deviceProduct || 'Unknown',
            title: device?.deviceName || device?.deviceProduct || 'Unknown Device',
            device: device?.deviceName || 'Unknown',
            address: session.deviceAddress,
            state: session.playerState as 'playing' | 'paused' | 'buffering',
            originalTitle: device?.deviceName || device?.deviceProduct || 'Unknown',
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
            sessionCount: device?.sessionCount || 0,
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



  async getUserSessionHistory(userId: string, limit: number = 50, includeActive: boolean = false): Promise<SessionHistory[]> {
    try {
      const queryBuilder = this.sessionHistoryRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.userDevice', 'device')
        .where('session.userId = :userId', { userId })
        .orderBy('session.startedAt', 'DESC')
        .take(limit);
      
      // By default, only return completed sessions (with endedAt)
      if (!includeActive) {
        queryBuilder.andWhere('session.endedAt IS NOT NULL');
      }
      
      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error(`Failed to get session history for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteSessionHistory(sessionId: number): Promise<void> {
    try {
      const result = await this.sessionHistoryRepository.delete(sessionId);
      
      if (result.affected === 0) {
        throw new Error(`Session history with ID ${sessionId} not found`);
      }
      
      this.logger.log(`Deleted session history with ID: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete session history ${sessionId}:`, error);
      throw error;
    }
  }
}
