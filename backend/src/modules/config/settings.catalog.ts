export type SettingType = 'string' | 'number' | 'boolean' | 'json';

interface SettingDefinition {
  value: string;
  type: SettingType;
  private?: boolean;
}

export const SETTINGS_CATALOG = {
  PLEX_TOKEN: {
    value: '',
    type: 'string',
    private: true,
  },
  PLEX_SERVER_IP: {
    value: '',
    type: 'string',
  },
  PLEX_SERVER_PORT: {
    value: '32400',
    type: 'string',
  },
  USE_SSL: {
    value: 'false',
    type: 'boolean',
  },
  IGNORE_CERT_ERRORS: {
    value: 'false',
    type: 'boolean',
  },
  PLEXGUARD_REFRESH_INTERVAL: {
    value: '10',
    type: 'number',
  },
  PLEX_GUARD_DEFAULT_BLOCK: {
    value: 'true',
    type: 'boolean',
  },
  PLEX_GUARD_STRICT_MODE: {
    value: 'false',
    type: 'boolean',
  },
  MSG_DEVICE_PENDING: {
    value:
      'Device pending approval. The server owner must approve this device before it can be used.',
    type: 'string',
  },
  MSG_DEVICE_REJECTED: {
    value:
      'You are not authorized to use this device. Please contact the server administrator for more information.',
    type: 'string',
  },
  MSG_TIME_RESTRICTED: {
    value:
      'Streaming is not allowed at this time due to scheduling restrictions',
    type: 'string',
  },
  MSG_IP_LAN_ONLY: {
    value: 'Only LAN access is allowed',
    type: 'string',
  },
  MSG_IP_WAN_ONLY: {
    value: 'Only WAN access is allowed',
    type: 'string',
  },
  MSG_IP_NOT_ALLOWED: {
    value: 'Your current IP address is not in the allowed list',
    type: 'string',
  },
  DEVICE_CLEANUP_ENABLED: {
    value: 'false',
    type: 'boolean',
  },
  DEVICE_CLEANUP_INTERVAL_DAYS: {
    value: '30',
    type: 'number',
  },
  DEFAULT_PAGE: {
    value: 'devices',
    type: 'string',
  },
  AUTO_CHECK_UPDATES: {
    value: 'false',
    type: 'boolean',
  },
  CLOUDFLARE_TURNSTILE_SITE_KEY: {
    value: '',
    type: 'string',
  },
  CLOUDFLARE_TURNSTILE_SECRET_KEY: {
    value: '',
    type: 'string',
    private: true,
  },
  APP_VERSION: {
    value: '',
    type: 'string',
    private: false,
  },
  IN_APP_ENABLED: {
    value: 'true',
    type: 'boolean',
  },
  AUTO_MARK_NOTIFICATION_READ: {
    value: 'true',
    type: 'boolean',
  },
  IN_APP_NOTIFY_ON_NEW_DEVICE: {
    value: 'true',
    type: 'boolean',
  },
  IN_APP_NOTIFY_ON_BLOCK: {
    value: 'true',
    type: 'boolean',
  },
  IN_APP_NOTIFY_ON_LOCATION_CHANGE: {
    value: 'false',
    type: 'boolean',
  },
  IN_APP_NOTIFY_ON_DEVICE_NOTE: {
    value: 'true',
    type: 'boolean',
  },
  ENABLE_MEDIA_THUMBNAILS: {
    value: 'true',
    type: 'boolean',
  },
  ENABLE_MEDIA_ARTWORK: {
    value: 'true',
    type: 'boolean',
  },
  CUSTOM_PLEX_URL: {
    value: '',
    type: 'string',
  },
  TIMEZONE: {
    value: '+00:00',
    type: 'string',
  },
  SMTP_ENABLED: {
    value: 'false',
    type: 'boolean',
  },
  SMTP_HOST: {
    value: '',
    type: 'string',
  },
  SMTP_PORT: {
    value: '587',
    type: 'number',
  },
  SMTP_USER: {
    value: '',
    type: 'string',
  },
  SMTP_PASSWORD: {
    value: '',
    type: 'string',
    private: true,
  },
  SMTP_FROM_EMAIL: {
    value: '',
    type: 'string',
  },
  SMTP_FROM_NAME: {
    value: 'Guardian Notifications',
    type: 'string',
  },
  SMTP_USE_TLS: {
    value: 'true',
    type: 'boolean',
  },
  SMTP_TO_EMAILS: {
    value: '',
    type: 'string',
  },
  SMTP_NOTIFY_ON_NEW_DEVICE: {
    value: 'false',
    type: 'boolean',
  },
  SMTP_NOTIFY_ON_BLOCK: {
    value: 'false',
    type: 'boolean',
  },
  SMTP_NOTIFY_ON_LOCATION_CHANGE: {
    value: 'false',
    type: 'boolean',
  },
  SMTP_NOTIFY_ON_DEVICE_NOTE: {
    value: 'false',
    type: 'boolean',
  },
  APPRISE_ENABLED: {
    value: 'false',
    type: 'boolean',
  },
  APPRISE_URLS: {
    value: '',
    type: 'string',
  },
  APPRISE_NOTIFY_ON_NEW_DEVICE: {
    value: 'false',
    type: 'boolean',
  },
  APPRISE_NOTIFY_ON_BLOCK: {
    value: 'false',
    type: 'boolean',
  },
  APPRISE_NOTIFY_ON_LOCATION_CHANGE: {
    value: 'false',
    type: 'boolean',
  },
  APPRISE_NOTIFY_ON_DEVICE_NOTE: {
    value: 'false',
    type: 'boolean',
  },
  CONCURRENT_STREAM_LIMIT: {
    value: '0',
    type: 'number',
  },
  CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS: {
    value: 'true',
    type: 'boolean',
  },
  MSG_CONCURRENT_LIMIT: {
    value:
      'You have reached your concurrent stream limit. Please stop another stream before starting a new one.',
    type: 'string',
  },
  USER_PORTAL_ENABLED: {
    value: 'false',
    type: 'boolean',
  },
  USER_PORTAL_SHOW_RULES: {
    value: 'false',
    type: 'boolean',
  },
  USER_PORTAL_ALLOW_REJECTED_REQUESTS: {
    value: 'true',
    type: 'boolean',
  },
} as const satisfies Record<string, SettingDefinition>;

type Catalog = typeof SETTINGS_CATALOG;

export type SettingKey = keyof Catalog;

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type ValueForType<T extends SettingType> = T extends 'boolean'
  ? boolean
  : T extends 'number'
    ? number
    : T extends 'json'
      ? JsonValue
      : string;

export type SettingValues = {
  [K in SettingKey]: ValueForType<Catalog[K]['type']>;
};

export type SettingValue = SettingValues[SettingKey];

export const SETTING_KEYS = Object.keys(SETTINGS_CATALOG) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS_CATALOG, key);
}
