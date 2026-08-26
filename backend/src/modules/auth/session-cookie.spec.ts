import type { Request } from 'express';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  extractSessionToken,
  isSecureRequest,
  sessionCookieOptions,
} from '@/modules/auth/session-cookie';

const request = (
  overrides: Partial<Pick<Request, 'cookies' | 'secure' | 'headers'>> = {},
) => {
  const stub: Pick<Request, 'cookies' | 'secure' | 'headers'> = {
    cookies: {},
    secure: false,
    headers: {},
    ...overrides,
  };
  return stub as Request;
};

describe('isSecureRequest', () => {
  it('trusts a directly served TLS connection', () => {
    expect(isSecureRequest(request({ secure: true }))).toBe(true);
  });

  it('trusts an https hop reported by a reverse proxy', () => {
    expect(
      isSecureRequest(request({ headers: { 'x-forwarded-proto': 'https' } })),
    ).toBe(true);
  });

  it('reads only the first hop of a forwarded chain', () => {
    expect(
      isSecureRequest(
        request({ headers: { 'x-forwarded-proto': 'https, http' } }),
      ),
    ).toBe(true);
    expect(
      isSecureRequest(
        request({ headers: { 'x-forwarded-proto': 'http, https' } }),
      ),
    ).toBe(false);
  });

  it('ignores casing and padding', () => {
    expect(
      isSecureRequest(request({ headers: { 'x-forwarded-proto': ' HTTPS ' } })),
    ).toBe(true);
  });

  it('accepts a repeated header as a list', () => {
    expect(
      isSecureRequest(
        request({ headers: { 'x-forwarded-proto': ['https', 'http'] } }),
      ),
    ).toBe(true);
  });

  it('reports plain http as insecure', () => {
    expect(isSecureRequest(request())).toBe(false);
    expect(
      isSecureRequest(request({ headers: { 'x-forwarded-proto': 'http' } })),
    ).toBe(false);
  });
});

describe('sessionCookieOptions', () => {
  it('locks the cookie away from scripts and cross-site requests', () => {
    expect(sessionCookieOptions(request())).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });
  });

  it('marks the cookie secure once the request arrives over https', () => {
    expect(sessionCookieOptions(request({ secure: true }))).toMatchObject({
      secure: true,
    });
  });

  it('expires the cookie in step with the session', () => {
    expect(SESSION_DURATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('extractSessionToken', () => {
  it('reads the session cookie', () => {
    expect(
      extractSessionToken(
        request({ cookies: { [SESSION_COOKIE_NAME]: 'token-1' } }),
      ),
    ).toBe('token-1');
  });

  it('returns null when the cookie is absent', () => {
    expect(
      extractSessionToken(request({ cookies: { other: 'x' } })),
    ).toBeNull();
  });

  it('returns null when no cookies were parsed at all', () => {
    const stub: Partial<Pick<Request, 'cookies'>> = {};
    expect(extractSessionToken(stub as Request)).toBeNull();
  });

  it('never reads a bearer header', () => {
    expect(
      extractSessionToken(
        request({ headers: { authorization: 'Bearer token-1' } }),
      ),
    ).toBeNull();
  });
});
