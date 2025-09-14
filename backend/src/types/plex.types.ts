export interface PlexSession {
  sessionKey?: string;
  User?: {
    id?: string;
    uuid?: string;
    title?: string;
    thumb?: string;
  };
  Player?: {
    machineIdentifier?: string;
    platform?: string;
    platformVersion?: string;
    product?: string;
    title?: string;
    version?: string;
    device?: string;
    userAgent?: string;
    address?: string;
    state?: 'playing' | 'paused' | 'buffering';
  };
  Session?: {
    id?: string;
    bandwidth?: number;
    location?: 'lan' | 'wan';
  };
  Media?: Array<{
    videoResolution?: string;
    bitrate?: number;
    container?: string;
    videoCodec?: string;
    audioCodec?: string;
  }>;
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

export interface PlexSessionsResponse {
  MediaContainer?: {
    size?: number;
    Metadata?: PlexSession[];
  };
}

export interface DeviceInfo {
  userId: string;
  deviceIdentifier: string;
  sessionKey?: string;
  deviceName?: string;
  devicePlatform?: string;
  deviceProduct?: string;
  deviceVersion?: string;
  ipAddress?: string;
  username?: string;
}

export interface SessionTerminationResult {
  stoppedSessions: string[];
  errors: string[];
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  success: boolean;
}
