import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveSession } from '../entities/active-session.entity';

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
  ) {}

  async updateActiveSessions(sessionsData: any): Promise<void> {
    try {
      const sessions = this.extractSessionsFromData(sessionsData);

      if (!sessions || sessions.length === 0) {
        // No active sessions, clear the database
        await this.clearAllSessions();
        this.logger.debug('No active sessions, cleared database');
        return;
      }

      // Get current session keys from the API
      const currentSessionKeys = sessions
        .map((s) => s.sessionKey)
        .filter(Boolean);

      // Remove sessions that are no longer active
      if (currentSessionKeys.length > 0) {
        await this.activeSessionRepository
          .createQueryBuilder()
          .delete()
          .where('session_key NOT IN (:...sessionKeys)', {
            sessionKeys: currentSessionKeys,
          })
          .execute();
      } else {
        await this.clearAllSessions();
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

  async getActiveSessionsCount(): Promise<number> {
    return this.activeSessionRepository.count();
  }

  async clearAllSessions(): Promise<void> {
    await this.activeSessionRepository.clear();
    this.logger.debug('Cleared all active sessions from database');
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
        rawData: JSON.stringify(sessionData),
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
    this.logger.log(`Removed session ${sessionKey} from database`);
  }
}
