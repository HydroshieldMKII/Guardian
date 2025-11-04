/**
 * Utility types for error handling
 */

export interface DatabaseError extends Error {
  code?: string;
}

export interface HttpError extends Error {
  statusCode?: number;
  statusMessage?: string;
  code?: string;
  response?: string;
  responseCode?: number;
  command?: string;
}

export interface PlexError extends Error {
  statusCode?: number;
  statusMessage?: string;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof Error && 'code' in error;
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && ('statusCode' in error || 'code' in error);
}

export function isPlexError(error: unknown): error is PlexError {
  return error instanceof Error && 'statusCode' in error;
}
