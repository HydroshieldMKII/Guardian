import {
  SETTINGS_CATALOG,
  SETTING_KEYS,
  isSettingKey,
} from '@/modules/config/settings.catalog';

describe('isSettingKey', () => {
  it('accepts every key the catalog declares', () => {
    for (const key of SETTING_KEYS) {
      expect(isSettingKey(key)).toBe(true);
    }
  });

  it('rejects a key the catalog does not declare', () => {
    expect(isSettingKey('NOT_A_SETTING')).toBe(false);
  });

  it.each([
    'toString',
    'valueOf',
    'constructor',
    'hasOwnProperty',
    '__proto__',
    '__defineGetter__',
    'isPrototypeOf',
  ])('rejects the inherited property %p', (inherited) => {
    expect(inherited in SETTINGS_CATALOG).toBe(true);
    expect(isSettingKey(inherited)).toBe(false);
  });
});
