import { isTruthy } from "../settings-ui";

export interface SettingGroup {
  title: string;
  description: string;
  keys: string[];
  extra?: (key: string) => boolean;
}

export interface ChildGroup {
  parent: string;
  children: string[];
  isDisabled: (parentValue: string | boolean | number) => boolean;
}

export const CHILD_GROUPS: ChildGroup[] = [
  {
    parent: "CONCURRENT_STREAM_LIMIT",
    children: ["CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS"],
    isDisabled: (value) => Number(value) === 0,
  },
  {
    parent: "DEVICE_CLEANUP_ENABLED",
    children: ["DEVICE_CLEANUP_INTERVAL_DAYS"],
    isDisabled: (value) => !isTruthy(value),
  },
  {
    parent: "USER_PORTAL_ENABLED",
    children: ["USER_PORTAL_SHOW_RULES", "USER_PORTAL_ALLOW_REJECTED_REQUESTS"],
    isDisabled: (value) => !isTruthy(value),
  },
  {
    parent: "IN_APP_ENABLED",
    children: [
      "IN_APP_NOTIFY_ON_NEW_DEVICE",
      "IN_APP_NOTIFY_ON_BLOCK",
      "IN_APP_NOTIFY_ON_LOCATION_CHANGE",
      "IN_APP_NOTIFY_ON_DEVICE_NOTE",
      "AUTO_MARK_NOTIFICATION_READ",
    ],
    isDisabled: (value) => !isTruthy(value),
  },
];

export const SECTIONS: Record<string, SettingGroup[]> = {
  guardian: [
    {
      title: "Access control",
      description: "How devices are treated and how many streams they get.",
      keys: [
        "PLEX_GUARD_DEFAULT_BLOCK",
        "PLEX_GUARD_STRICT_MODE",
        "CONCURRENT_STREAM_LIMIT",
      ],
    },
    {
      title: "Monitoring & maintenance",
      description:
        "How often Plex is polled, which clock is used, and when stale devices are dropped.",
      keys: [
        "PLEXGUARD_REFRESH_INTERVAL",
        "TIMEZONE",
        "DEVICE_CLEANUP_ENABLED",
      ],
    },
    {
      title: "User portal",
      description: "What Plex users can see and do when they sign in.",
      keys: ["USER_PORTAL_ENABLED"],
    },
    {
      title: "Login security",
      description:
        "Password recovery and optional captcha protection for the login page.",
      keys: [
        "PASSWORD_RESET_ENABLED",
        "CLOUDFLARE_TURNSTILE_SITE_KEY",
        "CLOUDFLARE_TURNSTILE_SECRET_KEY",
      ],
    },
  ],
  customization: [
    {
      title: "Interface",
      description: "What you see when you open the app.",
      keys: ["DEFAULT_PAGE", "ENABLE_MEDIA_THUMBNAILS", "ENABLE_MEDIA_ARTWORK"],
    },
    {
      title: "User-Facing Messages",
      description: "What Plex users are told when a stream is stopped.",
      keys: [
        "MSG_DEVICE_PENDING",
        "MSG_DEVICE_REJECTED",
        "MSG_TIME_RESTRICTED",
        "MSG_CONCURRENT_LIMIT",
        "MSG_IP_LAN_ONLY",
        "MSG_IP_WAN_ONLY",
        "MSG_IP_NOT_ALLOWED",
      ],
      extra: (key) => key.startsWith("MSG_"),
    },
  ],
  notifications: [
    {
      title: "In-App Notifications",
      description: "Which events raise a notification in the app.",
      keys: ["IN_APP_ENABLED"],
    },
  ],
};

export const NUMBER_MIN: Record<string, number> = {
  CONCURRENT_STREAM_LIMIT: 0,
  PLEXGUARD_REFRESH_INTERVAL: 5,
  DEVICE_CLEANUP_INTERVAL_DAYS: 1,
};
