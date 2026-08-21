import { isDatabaseError, isHttpError, isPlexError } from './error-types';

describe('error-types guards', () => {
  const withProps = (props: Record<string, unknown>) =>
    Object.assign(new Error('boom'), props);

  describe('isDatabaseError', () => {
    it('accepts an Error carrying a code', () => {
      expect(isDatabaseError(withProps({ code: 'SQLITE_BUSY' }))).toBe(true);
    });

    it('rejects an Error without a code', () => {
      expect(isDatabaseError(new Error('boom'))).toBe(false);
    });

    it('rejects non-Error values', () => {
      expect(isDatabaseError({ code: 'SQLITE_BUSY' })).toBe(false);
      expect(isDatabaseError(null)).toBe(false);
      expect(isDatabaseError('SQLITE_BUSY')).toBe(false);
    });
  });

  describe('isHttpError', () => {
    it('accepts an Error with statusCode', () => {
      expect(isHttpError(withProps({ statusCode: 500 }))).toBe(true);
    });

    it('accepts an Error with code', () => {
      expect(isHttpError(withProps({ code: 'ECONNREFUSED' }))).toBe(true);
    });

    it('rejects a bare Error', () => {
      expect(isHttpError(new Error('boom'))).toBe(false);
    });

    it('rejects non-Error values', () => {
      expect(isHttpError({ statusCode: 500 })).toBe(false);
      expect(isHttpError(undefined)).toBe(false);
    });
  });

  describe('isPlexError', () => {
    it('accepts an Error with statusCode', () => {
      expect(isPlexError(withProps({ statusCode: 401 }))).toBe(true);
    });

    it('rejects an Error carrying only a code', () => {
      expect(isPlexError(withProps({ code: 'ECONNREFUSED' }))).toBe(false);
    });

    it('rejects non-Error values', () => {
      expect(isPlexError({ statusCode: 401 })).toBe(false);
    });
  });
});
