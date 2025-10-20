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
    originalTitle?: string;
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
  parentYear?: number;
  year?: number;
  duration?: number;
  viewOffset?: number;
  type?: string;
  thumb?: string;
  art?: string;
  ratingKey?: string;
  parentRatingKey?: string;
  serverMachineIdentifier?: string;
  // Backend-generated media URLs
  thumbnailUrl?: string;
  artUrl?: string;
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
  avatarUrl?: string;
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
  temporaryAccessUntil?: string;
  temporaryAccessGrantedAt?: string;
  temporaryAccessDurationMinutes?: number;
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

export interface UserPreference {
  id: number;
  userId: string;
  username?: string;
  avatarUrl?: string;
  defaultBlock: boolean | null;
  hidden: boolean;
  // IP/Network access policies
  networkPolicy: 'both' | 'lan' | 'wan';
  ipAccessPolicy: 'all' | 'restricted';
  allowedIPs?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserTimeRule {
  id: number;
  userId: string;
  deviceIdentifier?: string;
  ruleName: string;
  enabled: boolean;
  action: 'allow' | 'block';
  dayOfWeek: number; // Single day (0-6, Sunday=0)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format (must be > startTime)
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeRuleDto {
  deviceIdentifier?: string;
  ruleName: string;
  action: 'allow' | 'block';
  dayOfWeek: number; // Single day (0-6)
  startTime: string; // HH:MM
  endTime: string; // HH:MM (validated to be > startTime)
}

export interface UpdateTimeRuleDto {
  ruleName?: string;
  enabled?: boolean;
  action?: 'allow' | 'block';
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

export interface UnifiedDashboardData {
  plexStatus: PlexStatus;
  settings: AppSetting[];
  sessions: StreamsResponse;
  devices: {
    all: UserDevice[];
    pending: UserDevice[];
    approved: UserDevice[];
    processed: UserDevice[];
  };
  users: UserPreference[];
  stats: DashboardStats;
}

export interface Notification {
  id: number;
  userId: string;
  username: string;
  deviceName: string;
  text: string;
  type: 'block' | 'info' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  sessionHistoryId?: number;
}

export interface NotificationData {
  notifications: Notification[];
  unreadCount: number;
}
