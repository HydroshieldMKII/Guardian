// Frontend error codes that match backend PlexErrorCode
export enum PlexErrorCode {
  // Configuration errors
  NOT_CONFIGURED = "PLEX_NOT_CONFIGURED",
  INVALID_CONFIG = "PLEX_INVALID_CONFIG",

  // Network connection errors
  CONNECTION_REFUSED = "PLEX_CONNECTION_REFUSED",
  CONNECTION_TIMEOUT = "PLEX_CONNECTION_TIMEOUT",
  NETWORK_ERROR = "PLEX_NETWORK_ERROR",

  // Authentication errors
  AUTH_FAILED = "PLEX_AUTH_FAILED",
  INVALID_TOKEN = "PLEX_INVALID_TOKEN",
  UNAUTHORIZED = "PLEX_UNAUTHORIZED",

  // SSL/TLS errors
  SSL_ERROR = "PLEX_SSL_ERROR",
  CERT_ERROR = "PLEX_CERT_ERROR",

  // Server errors
  SERVER_ERROR = "PLEX_SERVER_ERROR",
  NOT_FOUND = "PLEX_NOT_FOUND",

  // Generic errors
  UNKNOWN_ERROR = "PLEX_UNKNOWN_ERROR",
  REQUEST_FAILED = "PLEX_REQUEST_FAILED",
}

// Structured error response interface (matches backend)
export interface PlexErrorResponse {
  success: false;
  errorCode: PlexErrorCode;
  message: string;
  details?: string;
}

// Success response interface (matches backend)
export interface PlexSuccessResponse {
  success: true;
  message?: string;
  data?: any;
}

// Union type for all responses
export type PlexResponse = PlexSuccessResponse | PlexErrorResponse;

// Error display configuration for each error type
export interface ErrorDisplayConfig {
  title: string;
  description: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  showChecklist: boolean;
}

// Map error codes to display configurations
export const ERROR_DISPLAY_CONFIG: Record<PlexErrorCode, ErrorDisplayConfig> = {
  [PlexErrorCode.NOT_CONFIGURED]: {
    title: "Plex Configuration Required",
    description:
      "Guardian needs to connect to your Plex Media Server to monitor streams and manage devices.",
    iconName: "Server",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/20",
    showChecklist: true,
  },
  [PlexErrorCode.INVALID_CONFIG]: {
    title: "Invalid Configuration",
    description:
      "Your Plex configuration is incomplete or invalid. Please check your settings.",
    iconName: "Settings",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/20",
    showChecklist: true,
  },
  [PlexErrorCode.CONNECTION_REFUSED]: {
    title: "Plex Server Unreachable",
    description:
      "Cannot connect to your Plex server. Please check if Plex is running and the network settings are correct.",
    iconName: "WifiOff",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.CONNECTION_TIMEOUT]: {
    title: "Connection Timeout",
    description:
      "The connection to your Plex server is timing out. Please verify your IP address, port, and network settings.",
    iconName: "WifiOff",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.NETWORK_ERROR]: {
    title: "Network Error",
    description:
      "A network error occurred while connecting to Plex. Please check your connection and try again.",
    iconName: "WifiOff",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.AUTH_FAILED]: {
    title: "Authentication Failed",
    description:
      "Your Plex authentication token is invalid or expired. Please update your Plex token in the settings.",
    iconName: "Shield",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.INVALID_TOKEN]: {
    title: "Invalid Token",
    description:
      "Your Plex token is invalid. Please get a new token from your Plex account settings.",
    iconName: "Shield",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.UNAUTHORIZED]: {
    title: "Unauthorized Access",
    description:
      "Access to the Plex server was denied. Check your authentication credentials.",
    iconName: "Shield",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.SSL_ERROR]: {
    title: "SSL Connection Issue",
    description:
      "There's an SSL/TLS connection problem. Try disabling SSL or enabling 'Ignore SSL certificate errors' in settings.",
    iconName: "Shield",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.CERT_ERROR]: {
    title: "Certificate Error",
    description:
      "SSL certificate validation failed. Enable 'Ignore SSL certificate errors' or use HTTP instead of HTTPS.",
    iconName: "Shield",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.SERVER_ERROR]: {
    title: "Server Error",
    description:
      "The Plex server returned an error. Please check your server status and try again.",
    iconName: "AlertTriangle",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.NOT_FOUND]: {
    title: "Resource Not Found",
    description: "The requested resource was not found on the Plex server.",
    iconName: "AlertTriangle",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.UNKNOWN_ERROR]: {
    title: "Unknown Error",
    description:
      "An unexpected error occurred. Please try again or check the application logs.",
    iconName: "AlertTriangle",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
  [PlexErrorCode.REQUEST_FAILED]: {
    title: "Request Failed",
    description:
      "The request to the Plex server failed. Please check your connection and try again.",
    iconName: "AlertTriangle",
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/20",
    showChecklist: false,
  },
};
