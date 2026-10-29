import {
  PlexErrorCode,
  PlexErrorResponse,
  createPlexError,
} from '@/types/plex-errors';

const UNREACHABLE_CODES = new Set(['ECONNREFUSED', 'EHOSTUNREACH']);
const TIMEOUT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT']);

export function plexConnectionFailure(
  error: NodeJS.ErrnoException,
): PlexErrorResponse {
  const code = error.code ?? '';
  const { message } = error;

  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return createPlexError(
      PlexErrorCode.CERT_ERROR,
      'SSL certificate error: Hostname/IP does not match certificate',
      'Enable "Ignore SSL certificate errors" or use HTTP instead',
    );
  }

  if (code.startsWith('ERR_TLS_')) {
    return createPlexError(
      PlexErrorCode.SSL_ERROR,
      'SSL/TLS connection error',
      'Consider enabling "Ignore SSL certificate errors" or using HTTP',
    );
  }

  if (UNREACHABLE_CODES.has(code)) {
    return createPlexError(
      PlexErrorCode.CONNECTION_REFUSED,
      'Plex server is unreachable',
      'Check if Plex server is running and accessible',
    );
  }

  if (TIMEOUT_CODES.has(code) || message.includes('timeout')) {
    return createPlexError(
      PlexErrorCode.CONNECTION_TIMEOUT,
      'Connection timeout',
      'Check server address, port and network settings',
    );
  }

  if (message.includes('401') || message.includes('Unauthorized')) {
    return createPlexError(
      PlexErrorCode.AUTH_FAILED,
      'Authentication failed',
      'Check your Plex token',
    );
  }

  return createPlexError(
    PlexErrorCode.NETWORK_ERROR,
    'Connection failed',
    message,
  );
}
