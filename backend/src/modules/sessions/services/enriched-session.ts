import { SessionHistory } from '@/entities/session-history.entity';
import { EnrichedPlexSession } from '@/types/plex.types';

export function toEnrichedSession(
  session: SessionHistory,
  serverIdentifier: string | null,
): EnrichedPlexSession {
  const device = session.userDevice;

  return {
    sessionKey: session.sessionKey,
    User: {
      id: session.userId,
      title: session.userPreference?.username || 'Unknown User',
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
    ratingKey: session.ratingKey,
    parentRatingKey: session.parentRatingKey,
    serverMachineIdentifier: serverIdentifier,
  };
}
