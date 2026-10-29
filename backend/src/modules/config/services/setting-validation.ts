import {
  SETTINGS_CATALOG,
  SettingKey,
} from '@/modules/config/settings.catalog';
import { FORMAT_RULES } from '@/modules/config/services/setting-format-rules';

export const MIN_REFRESH_INTERVAL_SECONDS = 5;
export const MAX_REFRESH_INTERVAL_SECONDS = 86400;
export const MAX_CONCURRENT_STREAM_LIMIT = 1000;
export const MAX_CLEANUP_INTERVAL_DAYS = 3650;

const PLAIN_INTEGER_PATTERN = /^-?\d+$/;
const BOOLEAN_VALUES = ['true', 'false'];

export const READ_ONLY_SETTINGS: readonly SettingKey[] = ['APP_VERSION'];

interface IntegerRule {
  notANumber: string;
  notWhole: string;
  outOfRange: string;
  min: number;
  max: number;
}

const isPlainInteger = (value: string): boolean =>
  PLAIN_INTEGER_PATTERN.test(value);

const checkInteger = (rule: IntegerRule, value: string): void => {
  if (isNaN(Number(value))) {
    throw new Error(rule.notANumber);
  }
  if (!isPlainInteger(value)) {
    throw new Error(rule.notWhole);
  }
  const parsed = Number(value);
  if (parsed < rule.min || parsed > rule.max) {
    throw new Error(rule.outOfRange);
  }
};

const INTEGER_RULES: Partial<Record<SettingKey, IntegerRule>> = {
  PLEXGUARD_REFRESH_INTERVAL: {
    notANumber: 'Session refresh interval must be a number',
    notWhole: 'Session refresh interval must be a whole number of seconds',
    outOfRange: `Session refresh interval must be between ${MIN_REFRESH_INTERVAL_SECONDS} and ${MAX_REFRESH_INTERVAL_SECONDS} seconds`,
    min: MIN_REFRESH_INTERVAL_SECONDS,
    max: MAX_REFRESH_INTERVAL_SECONDS,
  },
  DEVICE_CLEANUP_INTERVAL_DAYS: {
    notANumber: 'Device cleanup interval must be a number',
    notWhole: 'Device cleanup interval must be a whole number (no decimals)',
    outOfRange: `Device cleanup interval must be between 1 and ${MAX_CLEANUP_INTERVAL_DAYS} days`,
    min: 1,
    max: MAX_CLEANUP_INTERVAL_DAYS,
  },
  SMTP_PORT: {
    notANumber: 'SMTP port must be a valid number',
    notWhole: 'SMTP port must be a whole number (no decimals)',
    outOfRange: 'SMTP port must be between 1 and 65535',
    min: 1,
    max: 65535,
  },
  PLEX_SERVER_PORT: {
    notANumber: 'Plex server port must be a valid number',
    notWhole: 'Plex server port must be a whole number (no decimals)',
    outOfRange: 'Plex server port must be between 1 and 65535',
    min: 1,
    max: 65535,
  },
  CONCURRENT_STREAM_LIMIT: {
    notANumber: 'Concurrent stream limit must be a number',
    notWhole: 'Concurrent stream limit must be a whole number',
    outOfRange: `Concurrent stream limit must be between 0 and ${MAX_CONCURRENT_STREAM_LIMIT}`,
    min: 0,
    max: MAX_CONCURRENT_STREAM_LIMIT,
  },
};

const checkBoolean = (key: SettingKey, value: string): void => {
  if (SETTINGS_CATALOG[key].type === 'boolean') {
    if (!BOOLEAN_VALUES.includes(value)) {
      throw new Error(`${key} must be true or false`);
    }
  }
};

export const isReadOnlySetting = (key: SettingKey): boolean =>
  READ_ONLY_SETTINGS.includes(key);

export const validateSettingValue = (key: SettingKey, value: string): void => {
  checkBoolean(key, value);
  const integerRule = INTEGER_RULES[key];
  if (integerRule) checkInteger(integerRule, value);
  FORMAT_RULES[key]?.(value);
};

export const clampSettingValue = (key: SettingKey, value: string): string => {
  const rule = INTEGER_RULES[key];
  if (!rule || !isPlainInteger(value)) {
    return value;
  }
  const parsed = Number(value);
  return String(Math.min(Math.max(parsed, rule.min), rule.max));
};
