import {
  clampSettingValue,
  validateSettingValue,
} from '@/modules/config/services/setting-validation';

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
