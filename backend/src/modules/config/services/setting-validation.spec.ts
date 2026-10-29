import {
  clampSettingValue,
  isReadOnlySetting,
  validateSettingValue,
} from '@/modules/config/services/setting-validation';
import { MESSAGE_MAX_LENGTH } from '@/modules/config/services/setting-format-rules';
import {
  SETTINGS_CATALOG,
  SETTING_KEYS,
  SettingKey,
} from '@/modules/config/settings.catalog';

describe('clampSettingValue', () => {
  it.each([
    ['PLEXGUARD_REFRESH_INTERVAL', '2', '5'],
    ['PLEXGUARD_REFRESH_INTERVAL', '-4', '5'],
    ['PLEXGUARD_REFRESH_INTERVAL', '90', '90'],
    ['DEVICE_CLEANUP_INTERVAL_DAYS', '0', '1'],
    ['SMTP_PORT', '0', '1'],
    ['SMTP_PORT', '70000', '65535'],
    ['SMTP_PORT', '587', '587'],
  ] as const)('brings %s %s to %s', (key, value, expected) => {
    expect(clampSettingValue(key, value)).toBe(expected);
  });

  it.each([
    ['PLEXGUARD_REFRESH_INTERVAL', '7.5'],
    ['PLEXGUARD_REFRESH_INTERVAL', 'soon'],
    ['PLEXGUARD_REFRESH_INTERVAL', ''],
    ['PLEXGUARD_REFRESH_INTERVAL', '  '],
    ['DEFAULT_PAGE', 'nowhere'],
  ] as const)('leaves %s %p for validation to judge', (key, value) => {
    expect(clampSettingValue(key, value)).toBe(value);
  });

  it('produces a value that passes validation', () => {
    expect(() =>
      validateSettingValue(
        'SMTP_PORT',
        clampSettingValue('SMTP_PORT', '99999'),
      ),
    ).not.toThrow();
  });
});

describe('validateSettingValue', () => {
  const rejects = (key: SettingKey, value: string) =>
    expect(() => validateSettingValue(key, value)).toThrow();
  const accepts = (key: SettingKey, value: string) =>
    expect(() => validateSettingValue(key, value)).not.toThrow();

  it.each([
    '3000000',
    '1000000000000',
    '86401',
    '4',
    '0x10',
    '5.0',
    '1e3',
    ' 7',
  ])('rejects a refresh interval of %p', (value) =>
    rejects('PLEXGUARD_REFRESH_INTERVAL', value),
  );

  it.each(['5', '10', '86400'])('accepts a refresh interval of %p', (value) =>
    accepts('PLEXGUARD_REFRESH_INTERVAL', value),
  );

  it.each(['-1', 'abc', '1.5', '', '1001', '0x2'])(
    'rejects a global stream limit of %p',
    (value) => rejects('CONCURRENT_STREAM_LIMIT', value),
  );

  it.each(['0', '1', '1000'])('accepts a global stream limit of %p', (value) =>
    accepts('CONCURRENT_STREAM_LIMIT', value),
  );

  it.each(['0', '3651', '1.0'])('rejects a cleanup interval of %p', (value) =>
    rejects('DEVICE_CLEANUP_INTERVAL_DAYS', value),
  );

  it.each(['1', '30', '3650'])('accepts a cleanup interval of %p', (value) =>
    accepts('DEVICE_CLEANUP_INTERVAL_DAYS', value),
  );

  it.each(['USE_SSL', 'PLEX_GUARD_STRICT_MODE', 'SMTP_ENABLED'] as const)(
    'accepts only true or false for %s',
    (key) => {
      accepts(key, 'true');
      accepts(key, 'false');
      rejects(key, 'yes');
      rejects(key, 'True');
      rejects(key, '1');
      rejects(key, '');
    },
  );

  it.each(['0', '65536', 'abc', '32400.0', '0x10', ''])(
    'rejects a Plex port of %p',
    (value) => rejects('PLEX_SERVER_PORT', value),
  );

  it.each(['1', '32400', '65535'])('accepts a Plex port of %p', (value) =>
    accepts('PLEX_SERVER_PORT', value),
  );

  it.each([
    'http://10.0.0.5',
    '10.0.0.5:32400',
    'host name',
    'host/path',
    'a'.repeat(254),
    '[nope]',
  ])('rejects a Plex address of %p', (value) =>
    rejects('PLEX_SERVER_IP', value),
  );

  it.each(['', '10.0.0.5', 'plex.example.com', 'plex_server', '[::1]'])(
    'accepts a Plex address of %p',
    (value) => accepts('PLEX_SERVER_IP', value),
  );

  it.each(['UTC', '', '+2:00', '+15:00', '+02:60', '02:00', '+02:00 '])(
    'rejects a timezone of %p',
    (value) => rejects('TIMEZONE', value),
  );

  it.each(['+00:00', '-12:00', '+14:00', '+05:30'])(
    'accepts a timezone of %p',
    (value) => accepts('TIMEZONE', value),
  );

  it.each([
    'plex.example.com',
    'ftp://plex.example.com',
    'javascript:alert(1)',
  ])('rejects a custom Plex URL of %p', (value) =>
    rejects('CUSTOM_PLEX_URL', value),
  );

  it.each([
    '',
    'http://plex.example.com',
    'https://plex.example.com:32400/web',
  ])('accepts a custom Plex URL of %p', (value) =>
    accepts('CUSTOM_PLEX_URL', value),
  );

  it.each([
    'MSG_DEVICE_PENDING',
    'MSG_DEVICE_REJECTED',
    'MSG_TIME_RESTRICTED',
    'MSG_IP_LAN_ONLY',
    'MSG_IP_WAN_ONLY',
    'MSG_IP_NOT_ALLOWED',
    'MSG_CONCURRENT_LIMIT',
  ] as const)('limits %s to %i characters', (key) => {
    accepts(key, 'x'.repeat(MESSAGE_MAX_LENGTH));
    rejects(key, 'x'.repeat(MESSAGE_MAX_LENGTH + 1));
  });

  it.each(['PLEX_TOKEN', 'SMTP_HOST', 'SMTP_USER', 'APPRISE_URLS'] as const)(
    'caps the length of %s',
    (key) => rejects(key, 'x'.repeat(20001)),
  );

  it('rejects an SMTP host with a scheme', () => {
    rejects('SMTP_HOST', 'https://smtp.example.com');
    accepts('SMTP_HOST', 'smtp.example.com');
  });

  it('rejects a read-only setting for writes', () => {
    expect(isReadOnlySetting('APP_VERSION')).toBe(true);
    expect(isReadOnlySetting('TIMEZONE')).toBe(false);
  });

  it('holds every setting to a rule that accepts its default', () => {
    for (const key of SETTING_KEYS) {
      const { value } = SETTINGS_CATALOG[key];
      if (key === 'APP_VERSION') continue;
      expect(() => validateSettingValue(key, value)).not.toThrow();
    }
  });
});

describe('clampSettingValue for unusual numerals', () => {
  it.each([
    ['PLEXGUARD_REFRESH_INTERVAL', '3000000', '86400'],
    ['PLEXGUARD_REFRESH_INTERVAL', '0x10', '0x10'],
    ['CONCURRENT_STREAM_LIMIT', '-1', '0'],
    ['CONCURRENT_STREAM_LIMIT', '5000', '1000'],
    ['PLEX_SERVER_PORT', '70000', '65535'],
  ] as const)('brings %s %s to %s', (key, value, expected) => {
    expect(clampSettingValue(key, value)).toBe(expected);
  });
});
