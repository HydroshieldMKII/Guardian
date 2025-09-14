export interface PlexSession {
  sessionKey: string;
  User?: {
    id?: string;
    title?: string;
    thumb?: string;
  };
  Player?: {
    machineIdentifier?: string;
    platform?: string;
    product?: string;
    title?: string;
    device?: string;
    address?: string;
    state?: "playing" | "paused" | "buffering";
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
    location?: "lan" | "wan";
    sessionCount?: number;
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

export interface StreamsResponse {
  MediaContainer?: {
    size?: number;
    Metadata?: PlexSession[];
  };
}

export interface DashboardStats {
  activeStreams: number;
  totalDevices: number;
  pendingDevices: number;
  approvedDevices: number;
  qualityStats?: {
    averageBitrate: number;
    commonResolution: string;
    commonCodec: string;
    highQualityStreams: number;
  };
}

export interface UserDevice {
  id: number;
  userId: string;
  username?: string;
  deviceIdentifier: string;
  deviceName?: string;
  devicePlatform?: string;
  deviceProduct?: string;
  deviceVersion?: string;
  ipAddress?: string;
  approved: boolean;
  status: "pending" | "approved" | "rejected";
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
}

export interface AppSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  type: "string" | "number" | "boolean" | "json";
  private: boolean;
  updatedAt: string;
}

export interface PlexStatus {
  configured: boolean;
  hasValidCredentials: boolean;
  connectionStatus: string;
}

export interface UnifiedDashboardData {
  plexStatus: PlexStatus;
  settings: AppSetting[];
  sessions: StreamsResponse;
  devices: {
    all: UserDevice[];
    pending: UserDevice[];
    approved: UserDevice[];
  };
  stats: DashboardStats;
}
