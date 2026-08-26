export interface PlexSession {
  sessionKey?: string | null;
  User?: {
    id?: string | null;
    uuid?: string | null;
    title?: string | null;
    thumb?: string | null;
  };
  Player?: {
    machineIdentifier?: string | null;
    platform?: string | null;
    platformVersion?: string | null;
    product?: string | null;
    title?: string | null;
    version?: string | null;
    device?: string | null;
    userAgent?: string | null;
    address?: string | null;
    state?: 'playing' | 'paused' | 'buffering';
  };
  Session?: {
    id?: string | null;
    bandwidth?: number | null;
    location?: 'lan' | 'wan';
  };
  Media?: Array<{
    videoResolution?: string | null;
    bitrate?: number | null;
    container?: string | null;
    videoCodec?: string | null;
    audioCodec?: string | null;
  }>;
  title?: string | null;
  grandparentTitle?: string | null;
  parentTitle?: string | null;
  year?: number | null;
  duration?: number | null;
  viewOffset?: number | null;
  type?: string | null;
  thumb?: string | null;
  art?: string | null;
  ratingKey?: string | null;
  parentRatingKey?: string | null;
}

/**
 * Check if a session or player product is Plexamp.
 * Plexamp is a dedicated music player that is excluded from most policy checks.
 */
export function isPlexampSession(
  sessionOrProduct: PlexSession | string | undefined,
): boolean {
  if (!sessionOrProduct) return false;
  if (typeof sessionOrProduct === 'string') {
    return sessionOrProduct === 'Plexamp';
  }
  return sessionOrProduct.Player?.product === 'Plexamp';
}

export interface EnrichedPlexSession extends Omit<PlexSession, 'Session'> {
  Session?: NonNullable<PlexSession['Session']> & { sessionCount?: number };
  thumbnailUrl?: string;
  artUrl?: string;
  serverMachineIdentifier?: string | null;
}

export interface EnrichedPlexSessionsResponse {
  MediaContainer?: {
    size?: number;
    Metadata?: EnrichedPlexSession[];
  };
}

export interface PlexSessionsResponse {
  MediaContainer?: {
    size?: number;
    Metadata?: PlexSession[];
  };
}

export interface DeviceInfo {
  userId: string;
  deviceIdentifier: string;
  sessionKey?: string | null;
  deviceName?: string | null;
  devicePlatform?: string | null;
  deviceProduct?: string | null;
  deviceVersion?: string | null;
  ipAddress?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface SessionTerminationResult {
  stoppedSessions: string[];
  errors: string[];
}

export interface ApiResponse<T = unknown> {
  message?: string;
  data?: T;
  success: boolean;
}
