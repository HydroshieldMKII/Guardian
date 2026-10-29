import { SessionHistory } from '@/entities/session-history.entity';

export interface PlexSessionData {
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
  ratingKey?: string;
  parentRatingKey?: string;
  parentYear?: number;
}

export function sessionsFromPlexData(data: unknown): PlexSessionData[] {
  if (!data || typeof data !== 'object' || !('MediaContainer' in data)) {
    return [];
  }

  const container = (
    data as { MediaContainer?: { Metadata?: PlexSessionData[] } }
  ).MediaContainer;
  return container?.Metadata || [];
}

export function toSessionRecord(
  sessionData: PlexSessionData,
  userDeviceId: number | undefined,
): Partial<SessionHistory> {
  const media = sessionData.Media?.[0];
  const user = sessionData.User;
  const player = sessionData.Player;
  const session = sessionData.Session;

  return {
    sessionKey: sessionData.sessionKey,
    ...(user?.id && { userId: user.id }),
    ...(userDeviceId && { userDeviceId }),
    ...(player?.address && { deviceAddress: player.address }),
    ...(player?.state && { playerState: player.state }),
    ...(player?.product && { product: player.product }),
    ...(sessionData.title && { contentTitle: sessionData.title }),
    ...(sessionData.type && { contentType: sessionData.type }),
    ...(sessionData.grandparentTitle && {
      grandparentTitle: sessionData.grandparentTitle,
    }),
    ...(sessionData.parentTitle && {
      parentTitle: sessionData.parentTitle,
    }),
    ...((sessionData.year || sessionData.parentYear) && {
      year: sessionData.year || sessionData.parentYear,
    }),
    ...(sessionData.duration && { duration: sessionData.duration }),
    ...(sessionData.viewOffset !== undefined && {
      viewOffset: sessionData.viewOffset,
    }),
    ...(sessionData.thumb && { thumb: sessionData.thumb }),
    ...(sessionData.art && { art: sessionData.art }),
    ...(sessionData.ratingKey && { ratingKey: sessionData.ratingKey }),
    ...(sessionData.parentRatingKey && {
      parentRatingKey: sessionData.parentRatingKey,
    }),
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
}
