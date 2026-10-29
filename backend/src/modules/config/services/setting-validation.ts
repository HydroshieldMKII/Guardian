import { SettingKey } from '@/modules/config/settings.catalog';

export const MIN_REFRESH_INTERVAL_SECONDS = 5;

const EMAIL_PATTERN = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface IntegerRule {
  notANumber: string;
  notWhole: string;
  outOfRange: string;
  min: number;
  max?: number;
}

const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(email);

const integer =
  (rule: IntegerRule) =>
  (value: string): void => {
    const parsed = Number(value);

    if (isNaN(parsed)) {
      throw new Error(rule.notANumber);
    }
    if (!Number.isInteger(parsed)) {
      throw new Error(rule.notWhole);
    }
    if (parsed < rule.min || (rule.max !== undefined && parsed > rule.max)) {
      throw new Error(rule.outOfRange);
    }
  };

const VALIDATORS: Partial<Record<SettingKey, (value: string) => void>> = {
  PLEXGUARD_REFRESH_INTERVAL: integer({
    notANumber: 'Session refresh interval must be a number',
    notWhole: 'Session refresh interval must be a whole number of seconds',
    outOfRange: `Session refresh interval must be at least ${MIN_REFRESH_INTERVAL_SECONDS} seconds`,
    min: MIN_REFRESH_INTERVAL_SECONDS,
  }),
  DEVICE_CLEANUP_INTERVAL_DAYS: integer({
    notANumber: 'Device cleanup interval must be a number',
    notWhole: 'Device cleanup interval must be a whole number (no decimals)',
    outOfRange: 'Device cleanup interval must be at least 1 day',
    min: 1,
  }),
  SMTP_PORT: integer({
    notANumber: 'SMTP port must be a valid number',
    notWhole: 'SMTP port must be a whole number (no decimals)',
    outOfRange: 'SMTP port must be between 1 and 65535',
    min: 1,
    max: 65535,
  }),
  SMTP_FROM_EMAIL: (value) => {
    if (value && !isValidEmail(value)) {
      throw new Error('SMTP from email must be a valid email address');
    }
  },
  SMTP_TO_EMAILS: (value) => {
    const emails = value
      .split(/[,;\n]/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    for (const email of emails) {
      if (!isValidEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }
  },
  DEFAULT_PAGE: (value) => {
    if (!['devices', 'streams'].includes(value)) {
      throw new Error('Default page must be either "devices" or "streams"');
    }
  },
};

export const validateSettingValue = (key: SettingKey, value: string): void => {
  VALIDATORS[key]?.(value);
};
