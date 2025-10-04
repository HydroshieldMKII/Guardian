// Error codes for Plex connection and configuration issues
export enum PlexErrorCode {
  // Configuration errors
  NOT_CONFIGURED = 'PLEX_NOT_CONFIGURED',
  INVALID_CONFIG = 'PLEX_INVALID_CONFIG',
  
  // Network connection errors
  CONNECTION_REFUSED = 'PLEX_CONNECTION_REFUSED',
  CONNECTION_TIMEOUT = 'PLEX_CONNECTION_TIMEOUT',
  NETWORK_ERROR = 'PLEX_NETWORK_ERROR',
  
  // Authentication errors
  AUTH_FAILED = 'PLEX_AUTH_FAILED',
  INVALID_TOKEN = 'PLEX_INVALID_TOKEN',
  UNAUTHORIZED = 'PLEX_UNAUTHORIZED',
  
  // SSL/TLS errors
  SSL_ERROR = 'PLEX_SSL_ERROR',
  CERT_ERROR = 'PLEX_CERT_ERROR',
  
  // Server errors
  SERVER_ERROR = 'PLEX_SERVER_ERROR',
  NOT_FOUND = 'PLEX_NOT_FOUND',
  
  // Generic errors
  UNKNOWN_ERROR = 'PLEX_UNKNOWN_ERROR',
  REQUEST_FAILED = 'PLEX_REQUEST_FAILED'
}

// Structured error response interface
export interface PlexErrorResponse {
  success: false;
  errorCode: PlexErrorCode;
  message: string;
  details?: string;
}

// Success response interface
export interface PlexSuccessResponse {
  success: true;
  message?: string;
  data?: any;
}

// Union type for all responses
export type PlexResponse = PlexSuccessResponse | PlexErrorResponse;

// Helper function to create error responses
export function createPlexError(
  errorCode: PlexErrorCode,
  message: string,
  details?: string
): PlexErrorResponse {
  return {
    success: false,
    errorCode,
    message,
    details
  };
}

// Helper function to create success responses
export function createPlexSuccess(
  message?: string,
  data?: any
): PlexSuccessResponse {
  return {
    success: true,
    message,
    data
  };
}

// Error code to user-friendly message mapping
export const ERROR_MESSAGES: Record<PlexErrorCode, string> = {
  [PlexErrorCode.NOT_CONFIGURED]: 'Plex server is not configured',
  [PlexErrorCode.INVALID_CONFIG]: 'Plex configuration is invalid',
  [PlexErrorCode.CONNECTION_REFUSED]: 'Plex server is unreachable - check if Plex is running and accessible',
  [PlexErrorCode.CONNECTION_TIMEOUT]: 'Connection timeout - check IP address, port and network settings',
  [PlexErrorCode.NETWORK_ERROR]: 'Network error connecting to Plex server',
  [PlexErrorCode.AUTH_FAILED]: 'Authentication failed - check your Plex token',
  [PlexErrorCode.INVALID_TOKEN]: 'Invalid or expired Plex token',
  [PlexErrorCode.UNAUTHORIZED]: 'Unauthorized access to Plex server',
  [PlexErrorCode.SSL_ERROR]: 'SSL/TLS connection error - try disabling SSL or ignoring certificate errors',
  [PlexErrorCode.CERT_ERROR]: 'SSL certificate error - hostname/IP does not match certificate',
  [PlexErrorCode.SERVER_ERROR]: 'Plex server returned an error',
  [PlexErrorCode.NOT_FOUND]: 'Requested resource not found on Plex server',
  [PlexErrorCode.UNKNOWN_ERROR]: 'Unknown error occurred',
  [PlexErrorCode.REQUEST_FAILED]: 'Request to Plex server failed'
};