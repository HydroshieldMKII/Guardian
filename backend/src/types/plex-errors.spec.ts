import {
  ERROR_MESSAGES,
  PlexErrorCode,
  createPlexError,
  createPlexSuccess,
} from '@/types/plex-errors';

describe('createPlexError', () => {
  it('marks the response as unsuccessful', () => {
    expect(
      createPlexError(PlexErrorCode.AUTH_FAILED, 'Bad token').success,
    ).toBe(false);
  });

  it('carries the code and message', () => {
    expect(createPlexError(PlexErrorCode.NOT_FOUND, 'Missing')).toEqual({
      success: false,
      errorCode: PlexErrorCode.NOT_FOUND,
      message: 'Missing',
      details: undefined,
    });
  });

  it('carries optional details', () => {
    expect(
      createPlexError(PlexErrorCode.SSL_ERROR, 'TLS', 'self-signed').details,
    ).toBe('self-signed');
  });
});

describe('createPlexSuccess', () => {
  it('marks the response as successful', () => {
    expect(createPlexSuccess().success).toBe(true);
  });

  it('carries an optional message and payload', () => {
    expect(createPlexSuccess('ok', { size: 1 })).toEqual({
      success: true,
      message: 'ok',
      data: { size: 1 },
    });
  });

  it('leaves message and data undefined when omitted', () => {
    expect(createPlexSuccess()).toEqual({
      success: true,
      message: undefined,
      data: undefined,
    });
  });
});

describe('ERROR_MESSAGES', () => {
  it('covers every error code', () => {
    for (const code of Object.values(PlexErrorCode)) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('uses unique codes', () => {
    const codes = Object.values(PlexErrorCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
