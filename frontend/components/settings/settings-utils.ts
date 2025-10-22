import { AppSetting } from "@/types";

export interface SettingsFormData {
  [key: string]: string | boolean | number;
}

export interface SettingInfo {
  label: string;
  description: string;
}

export interface ConnectionStatus {
  success: boolean;
  message: string;
}

export interface VersionMismatchInfo {
  currentVersion: string;
  importVersion: string;
}

// Function to get setting label and description
export const getSettingInfo = (setting: AppSetting): SettingInfo => {
  const settingInfoMap: Record<
    string,
    { label: string; description?: string }
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
      description: "Connect to Plex server using HTTPS instead of HTTP",
    },
    IGNORE_CERT_ERRORS: {
      label: "Ignore SSL certificate errors",
      description:
        "Skip SSL certificate validation (not recommended for production)",
    },
    PLEXGUARD_REFRESH_INTERVAL: {
      label: "Session refresh interval (seconds)",
      description: "How often to check for active Plex sessions",
    },
    PLEX_GUARD_DEFAULT_BLOCK: {
      label: "Block new devices by default",
      description: "Require manual approval for all new devices",
    },
    MSG_DEVICE_PENDING: {
      label: "Device pending message",
      description: "Message shown when a device is waiting for approval",
    },
    MSG_DEVICE_REJECTED: {
      label: "Device rejected message",
      description: "Message shown when a device has been rejected",
    },
    MSG_TIME_RESTRICTED: {
      label: "Time restriction message",
      description:
        "Message shown when streaming is blocked due to time restrictions",
    },
    MSG_IP_LAN_ONLY: {
      label: "LAN only message",
      description: "Message shown when only local network access is allowed",
    },
    MSG_IP_WAN_ONLY: {
      label: "WAN only message",
      description: "Message shown when only external access is allowed",
    },
    MSG_IP_NOT_ALLOWED: {
      label: "IP not allowed message",
      description:
        "Message shown when the IP address is not in the allowed list",
    },
    DEVICE_CLEANUP_ENABLED: {
      label: "Enable automatic device cleanup",
      description:
        "Automatically remove inactive devices after a certain period",
    },
    DEVICE_CLEANUP_INTERVAL_DAYS: {
      label: "Device cleanup interval (days)",
      description:
        "Number of days before inactive devices are automatically removed",
    },
    DEFAULT_PAGE: {
      label: "Default dashboard page",
      description: "Page to show when opening Guardian (devices or streams)",
    },
    AUTO_CHECK_UPDATES: {
      label: "Automatically check for updates",
      description: "Check for new Guardian versions automatically",
    },
    AUTO_MARK_NOTIFICATION_READ: {
      label: "Auto-mark notifications as read",
      description: "Automatically mark notifications as read after viewing",
    },
    ENABLE_MEDIA_THUMBNAILS: {
      label: "Show media thumbnails",
      description: "Display thumbnail images for media in streams",
    },
    ENABLE_MEDIA_ARTWORK: {
      label: "Show media artwork",
      description: "Display artwork for media in streams",
    },
    CUSTOM_PLEX_URL: {
      label: "Custom Plex URL",
      description: "Override the default Plex URL for media links",
    },
    TIMEZONE: {
      label: "Timezone",
      description: "Timezone offset for time based restrictions and scheduling",
    },
    SMTP_ENABLED: {
      label: "Enable email notifications",
      description: "Send email notifications for Guardian events",
    },
    SMTP_HOST: {
      label: "SMTP server hostname",
      description:
        "Hostname or IP address of your SMTP server (e.g., smtp.gmail.com)",
    },
    SMTP_PORT: {
      label: "SMTP server port",
      description:
        "Port number for SMTP connection (common ports: 587 for TLS, 465 for SSL, 25 for unencrypted)",
    },
    SMTP_USER: {
      label: "SMTP username",
      description:
        "Username for SMTP authentication (usually your email address)",
    },
    SMTP_PASSWORD: {
      label: "SMTP password",
      description: "Password or app-specific password for SMTP authentication",
    },
    SMTP_FROM_EMAIL: {
      label: "From email address",
      description: "Email address that notifications will be sent from",
    },
    SMTP_TO_EMAILS: {
      label: "To email addresses",
      description:
        "Email addresses to send notifications to (separate multiple addresses with commas, semicolons, or new lines)",
    },
    SMTP_FROM_NAME: {
      label: "From display name",
      description:
        "Display name that will appear as the sender (e.g., Guardian Notifications)",
    },
    SMTP_USE_TLS: {
      label: "Use TLS encryption",
      description:
        "Enable TLS/STARTTLS encryption for secure email transmission",
    },
    SMTP_NOTIFY_ON_NOTIFICATIONS: {
      label: "Email notifications for events",
      description:
        "Send email notifications when new events occur (device approvals, rejections, etc.)",
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

  return { label, description };
};

export const settingsSections = [
  {
    id: "guardian",
    title: "Guardian Configuration",
    description: "Configure Guardian behavior and settings",
    icon: "Shield",
  },
  {
    id: "customization",
    title: "Customization",
    description: "Customize user interface, messages, and experience",
    icon: "User",
  },
  {
    id: "notifications",
    title: "Notification Settings",
    description: "Configure notification behavior and preferences",
    icon: "BellRing",
  },
  {
    id: "plex",
    title: "Plex Integration",
    description: "Configure Plex server connection and settings",
    icon: "Server",
  },
  {
    id: "database",
    title: "Database Management",
    description: "Export and import database settings and data",
    icon: "Database",
  },
  {
    id: "admin",
    title: "Administrative Tools",
    description: "Dangerous operations for database management",
    icon: "AlertTriangle",
  },
];
