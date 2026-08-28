import { appUrl, config, isDevelopment } from '@/config/app.config';

describe('config', () => {
  it('serves the api under a single prefix', () => {
    expect(config.api.baseUrl).toBe('/api/pg');
  });
});

describe('isDevelopment', () => {
  it('reads the environment the app booted with', () => {
    expect(isDevelopment()).toBe(config.app.environment === 'development');
  });
});

describe('appUrl', () => {
  const original = process.env.APP_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = original;
    }
  });

  it('is absent until an address is configured', () => {
    delete process.env.APP_URL;
    expect(appUrl()).toBeNull();
  });

  it('keeps the origin of a plain address', () => {
    process.env.APP_URL = 'https://guardian.example.com';
    expect(appUrl()).toBe('https://guardian.example.com');
  });

  it('keeps a sub-path the app is served from', () => {
    process.env.APP_URL = 'https://example.com/guardian';
    expect(appUrl()).toBe('https://example.com/guardian');
  });

  it('drops a trailing slash so links do not double up', () => {
    process.env.APP_URL = 'https://example.com/guardian//';
    expect(appUrl()).toBe('https://example.com/guardian');
  });

  it('drops the query and fragment', () => {
    process.env.APP_URL = 'https://example.com/app?a=1#b';
    expect(appUrl()).toBe('https://example.com/app');
  });

  it('accepts plain http for a LAN install', () => {
    process.env.APP_URL = 'http://192.168.1.10:3000';
    expect(appUrl()).toBe('http://192.168.1.10:3000');
  });

  it.each([
    '',
    '   ',
    'guardian.example.com',
    'javascript:alert(1)',
    'ftp://x',
  ])('refuses %p', (value) => {
    process.env.APP_URL = value;
    expect(appUrl()).toBeNull();
  });
});
