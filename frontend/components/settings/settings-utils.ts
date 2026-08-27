import { AppSetting } from "@/types";

export interface SettingsFormData {
  [key: string]: string | boolean | number;
}

export interface SettingInfo {
  label: string;
  description: string;
  optional?: boolean;
}

export interface ConnectionStatus {
  success: boolean;
  message: string;
}

export interface VersionMismatchInfo {
  currentVersion: string;
  importVersion: string;
}

export interface SecretInputDisplay {
  value: string;
  placeholder: string;
}

export const getSecretInputDisplay = (
  setting: AppSetting,
  value: string,
  fallbackPlaceholder: string,
): SecretInputDisplay => {
  if (setting.private && value !== "" && value === setting.value) {
    return { value: "", placeholder: "•••••••• (saved)" };
  }
  return { value, placeholder: fallbackPlaceholder };
};

export const getSettingInfo = (setting: AppSetting): SettingInfo => {
  const settingInfoMap: Record<
    string,
    { label: string; description?: string; optional?: boolean }
  > = {
    PLEX_SERVER_IP: {
      label: "Plex server IP address",
      description: "IP address or hostname of your Plex Media Server",
    },
    PLEX_SERVER_PORT: {
      label: "Plex server port",
      description: "Port number for your Plex Media Server (default: 32400)",
    },
    PLEX_TOKEN: {
      label: "Plex server token",
      description: "Authentication token for accessing your Plex Media Server",
    },
    USE_SSL: {
      label: "Use SSL/HTTPS",
      description: "Reach your Plex server over HTTPS instead of HTTP",
    },
    IGNORE_CERT_ERRORS: {
      label: "Ignore SSL certificate errors",
      description:
        "Connect even when the server's certificate cannot be verified. Only safe on a network you control.",
    },
    PLEXGUARD_REFRESH_INTERVAL: {
      label: "Session refresh interval (seconds)",
      description:
        "How often Guardian asks Plex what is playing and enforces your policies",
    },
    PLEX_GUARD_DEFAULT_BLOCK: {
      label: "Block new devices by default",
      description:
        "New devices cannot stream until you approve them. A user's own policy overrides this.",
    },
    PLEX_GUARD_STRICT_MODE: {
      label: "Strict mode",
      description:
        "Guardian decides every new device immediately using the default policy, so nothing sits pending. Devices waiting now are decided as soon as you turn this on.",
    },
    MSG_DEVICE_PENDING: {
      label: "Device pending message",
      description: "Shown when a device is still waiting for your approval",
    },
    MSG_DEVICE_REJECTED: {
      label: "Device rejected message",
      description: "Shown when you have rejected the device",
    },
    MSG_TIME_RESTRICTED: {
      label: "Time schedule message",
      description:
        "Shown when a user's time schedule blocks streaming at this hour",
    },
    MSG_IP_LAN_ONLY: {
      label: "Local network only message",
      description:
        "Shown when a user is only allowed to stream on the local network, but is streaming from the internet",
    },
    MSG_IP_WAN_ONLY: {
      label: "Internet only message",
      description:
        "Shown when a user is only allowed to stream from the internet, but is streaming on the local network",
    },
    MSG_IP_NOT_ALLOWED: {
      label: "Address not allowed message",
      description:
        "Shown when a user streams from an IP address that is not on their allowed list",
    },
    DEVICE_CLEANUP_ENABLED: {
      label: "Enable automatic device cleanup",
      description:
        "Delete devices that have not streamed for a while, so the list stays short",
    },
    DEVICE_CLEANUP_INTERVAL_DAYS: {
      label: "Delete devices unused for (days)",
      description:
        "A device is deleted once this many days pass without it streaming",
    },
    DEFAULT_PAGE: {
      label: "Default dashboard page",
      description: "The page Guardian opens on",
    },
    AUTO_CHECK_UPDATES: {
      label: "Automatically check for updates",
      description: "Tell me when a newer version of Guardian is released",
    },
    PASSWORD_RESET_ENABLED: {
      label: "Allow password reset by email",
      description:
        "Show a Forgot password link on the sign-in page and email a single-use link that expires in 15 minutes",
    },
    CLOUDFLARE_TURNSTILE_SITE_KEY: {
      label: "Cloudflare Turnstile site key",
      description: "The public key from your Cloudflare Turnstile widget",
    },
    CLOUDFLARE_TURNSTILE_SECRET_KEY: {
      label: "Cloudflare Turnstile secret key",
      description:
        "The private key from your Cloudflare Turnstile widget. Guardian uses it to verify each attempt.",
    },
    IN_APP_ENABLED: {
      label: "Enable in-app notifications",
      description: "Show notifications in the Guardian bell menu",
    },
    AUTO_MARK_NOTIFICATION_READ: {
      label: "Mark notifications as read when opened",
      description: "Opening a notification clears it, without a second click",
    },
    IN_APP_NOTIFY_ON_NEW_DEVICE: {
      label: "New devices",
      description: "When Guardian sees a device it has not seen before",
    },
    IN_APP_NOTIFY_ON_BLOCK: {
      label: "Blocked streams",
      description: "When Guardian stops a stream because a policy forbids it",
    },
    IN_APP_NOTIFY_ON_LOCATION_CHANGE: {
      label: "Device location changes",
      description: "When a known device starts streaming from a new address",
    },
    IN_APP_NOTIFY_ON_DEVICE_NOTE: {
      label: "Notes from users",
      description: "When a user leaves a note asking you to review a device",
    },
    ENABLE_MEDIA_THUMBNAILS: {
      label: "Show media thumbnails",
      description: "Show a small still from whatever is playing",
    },
    ENABLE_MEDIA_ARTWORK: {
      label: "Show media artwork",
      description: "Show the poster or album cover behind each stream",
    },
    CUSTOM_PLEX_URL: {
      label: "Custom Plex URL",
      description:
        'Where the "open in Plex" links point, if your server is not at the default address',
      optional: true,
    },
    TIMEZONE: {
      label: "Timezone",
      description:
        "The clock Guardian uses when deciding whether a time schedule blocks a stream",
    },
    SMTP_ENABLED: {
      label: "Enable email notifications",
      description: "Send notifications by email through your own SMTP server",
    },
    SMTP_HOST: {
      label: "SMTP server hostname",
      description:
        "Hostname or IP address of your SMTP server (e.g. smtp.gmail.com)",
    },
    SMTP_PORT: {
      label: "SMTP server port",
      description:
        "Port number for SMTP connection (common ports: 587 for TLS, 465 for SSL, 25 for unencrypted)",
    },
    SMTP_USER: {
      label: "SMTP username",
      description: "Username for SMTP authentication",
    },
    SMTP_PASSWORD: {
      label: "SMTP password",
      description: "Password for SMTP authentication",
    },
    SMTP_FROM_EMAIL: {
      label: "From email address",
      description: "Email address that notifications will be sent from",
    },
    SMTP_TO_EMAILS: {
      label: "To email addresses",
      description:
        "Email addresses to send notifications to (separate multiple addresses with commas or semicolons)",
    },
    SMTP_FROM_NAME: {
      label: "From display name",
      description:
        "Display name that will appear as the sender (e.g. Guardian Notifications)",
    },
    SMTP_USE_TLS: {
      label: "Use TLS encryption",
      description:
        "Enable TLS/STARTTLS encryption for secure email transmission",
    },
    SMTP_NOTIFY_ON_NEW_DEVICE: {
      label: "New devices",
      description: "When Guardian sees a device it has not seen before",
    },
    SMTP_NOTIFY_ON_BLOCK: {
      label: "Blocked streams",
      description: "When Guardian stops a stream because a policy forbids it",
    },
    SMTP_NOTIFY_ON_LOCATION_CHANGE: {
      label: "Device location changes",
      description: "When a known device starts streaming from a new address",
    },
    SMTP_NOTIFY_ON_DEVICE_NOTE: {
      label: "Notes from users",
      description: "When a user leaves a note asking you to review a device",
    },
    APPRISE_ENABLED: {
      label: "Enable Apprise notifications",
      description:
        "Send notifications through Apprise to Discord, Telegram, Pushover and others",
    },
    APPRISE_URLS: {
      label: "Apprise service URLs",
      description:
        "Enter your notification service URLs, separated by comma, semicolon, or new lines",
    },
    APPRISE_NOTIFY_ON_NEW_DEVICE: {
      label: "New devices",
      description: "When Guardian sees a device it has not seen before",
    },
    APPRISE_NOTIFY_ON_BLOCK: {
      label: "Blocked streams",
      description: "When Guardian stops a stream because a policy forbids it",
    },
    APPRISE_NOTIFY_ON_LOCATION_CHANGE: {
      label: "Device location changes",
      description: "When a known device starts streaming from a new address",
    },
    APPRISE_NOTIFY_ON_DEVICE_NOTE: {
      label: "Notes from users",
      description: "When a user leaves a note asking you to review a device",
    },
    // Concurrent Stream Limit Settings
    CONCURRENT_STREAM_LIMIT: {
      label: "Global concurrent stream limit",
      description:
        "How many streams one user can run at the same time. Zero means no limit. A user's own limit overrides this.",
    },
    CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS: {
      label: "Count temporary access towards the limit",
      description:
        "Streams from devices on a temporary grant count towards the concurrent stream limit like any other",
    },
    MSG_CONCURRENT_LIMIT: {
      label: "Stream limit message",
      description:
        "Shown when a user starts more streams at once than their limit allows",
    },
    // User Portal Settings
    USER_PORTAL_ENABLED: {
      label: "Enable Plex user portal",
      description:
        "Plex users can sign in to see their own devices and policies. With this off, only a Plex account you have linked to your Guardian login can sign in.",
    },
    USER_PORTAL_SHOW_RULES: {
      label: "Show rules in user portal",
      description:
        "Users can see the policies that apply to them: network and IP access, stream limit and time schedule",
    },
    USER_PORTAL_ALLOW_REJECTED_REQUESTS: {
      label: "Allow notes on rejected devices",
      description:
        "Users can ask you to reconsider a device you have already rejected",
    },
  };

  const info = settingInfoMap[setting.key];
  const label =
    info?.label ||
    setting.key
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  const description = info?.description || "";

  return info?.optional
    ? { label, description, optional: true }
    : { label, description };
};
