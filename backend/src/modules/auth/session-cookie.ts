import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function isSecureRequest(req: Request): boolean {
  if (req.secure) {
    return true;
  }

  const forwarded = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  return protocol?.split(',')[0].trim().toLowerCase() === 'https';
}

export function sessionCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS,
    path: '/',
  };
}

export function extractSessionToken(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[SESSION_COOKIE_NAME] ?? null;
}
