import { isIP } from 'net';
import { SettingKey } from '@/modules/config/settings.catalog';

export const MESSAGE_MAX_LENGTH = 500;
export const DEFAULT_TEXT_MAX_LENGTH = 1000;
export const LONG_TEXT_MAX_LENGTH = 10000;
export const SECRET_MAX_LENGTH = 500;
export const NAME_MAX_LENGTH = 255;
export const HOST_MAX_LENGTH = 253;
export const URL_MAX_LENGTH = 2048;
export const MAX_UTC_OFFSET_HOURS = 14;

const EMAIL_PATTERN = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const HOSTNAME_PATTERN = /^[A-Za-z0-9_]([A-Za-z0-9_.-]*[A-Za-z0-9_])?$/;
const UTC_OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;

export type FormatRule = (value: string) => void;

const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(email);

const isBracketedIpv6 = (value: string): boolean =>
  value.startsWith('[') &&
  value.endsWith(']') &&
  isIP(value.slice(1, -1)) === 6;

const isHostname = (value: string): boolean =>
  HOSTNAME_PATTERN.test(value) || isBracketedIpv6(value);

const hostRule =
  (label: string): FormatRule =>
  (value) => {
    if (value && !isHostname(value)) {
      throw new Error(
        `${label} must be a hostname or IP address without spaces, scheme or path`,
      );
    }
  };

const maxLengthRule =
  (label: string, max: number): FormatRule =>
  (value) => {
    if (value.length > max) {
      throw new Error(`${label} must be at most ${max} characters`);
    }
  };

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidUtcOffset = (value: string): boolean => {
  const match = UTC_OFFSET_PATTERN.exec(value);
  if (!match) return false;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return hours <= MAX_UTC_OFFSET_HOURS && minutes <= 59;
};

const messageRule = (label: string) => maxLengthRule(label, MESSAGE_MAX_LENGTH);

const emailListRule: FormatRule = (value) => {
  const emails = value
    .split(/[,;\n]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  for (const email of emails) {
    if (!isValidEmail(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }
};

export const FORMAT_RULES: Partial<Record<SettingKey, FormatRule>> = {
  PLEX_TOKEN: maxLengthRule('Plex token', SECRET_MAX_LENGTH),
  PLEX_SERVER_IP: (value) => {
    maxLengthRule('Plex server address', HOST_MAX_LENGTH)(value);
    hostRule('Plex server address')(value);
  },
  CUSTOM_PLEX_URL: (value) => {
    maxLengthRule('Custom Plex URL', URL_MAX_LENGTH)(value);
    if (value && !isHttpUrl(value)) {
      throw new Error('Custom Plex URL must be empty or an http(s) URL');
    }
  },
  TIMEZONE: (value) => {
    if (!isValidUtcOffset(value)) {
      throw new Error(
        `Timezone must be a UTC offset like +02:00 (up to ±${MAX_UTC_OFFSET_HOURS}:00)`,
      );
    }
  },
  MSG_DEVICE_PENDING: messageRule('Message'),
  MSG_DEVICE_REJECTED: messageRule('Message'),
  MSG_TIME_RESTRICTED: messageRule('Message'),
  MSG_IP_LAN_ONLY: messageRule('Message'),
  MSG_IP_WAN_ONLY: messageRule('Message'),
  MSG_IP_NOT_ALLOWED: messageRule('Message'),
  MSG_CONCURRENT_LIMIT: messageRule('Message'),
  DEFAULT_PAGE: (value) => {
    if (!['devices', 'streams'].includes(value)) {
      throw new Error('Default page must be either "devices" or "streams"');
    }
  },
  CLOUDFLARE_TURNSTILE_SITE_KEY: maxLengthRule(
    'Turnstile site key',
    SECRET_MAX_LENGTH,
  ),
  CLOUDFLARE_TURNSTILE_SECRET_KEY: maxLengthRule(
    'Turnstile secret key',
    SECRET_MAX_LENGTH,
  ),
  SMTP_HOST: (value) => {
    maxLengthRule('SMTP host', HOST_MAX_LENGTH)(value);
    hostRule('SMTP host')(value);
  },
  SMTP_USER: maxLengthRule('SMTP user', DEFAULT_TEXT_MAX_LENGTH),
  SMTP_PASSWORD: maxLengthRule('SMTP password', DEFAULT_TEXT_MAX_LENGTH),
  SMTP_FROM_EMAIL: (value) => {
    maxLengthRule('SMTP from email', NAME_MAX_LENGTH)(value);
    if (value && !isValidEmail(value)) {
      throw new Error('SMTP from email must be a valid email address');
    }
  },
  SMTP_FROM_NAME: maxLengthRule('SMTP from name', NAME_MAX_LENGTH),
  SMTP_TO_EMAILS: (value) => {
    maxLengthRule('SMTP recipients', LONG_TEXT_MAX_LENGTH)(value);
    emailListRule(value);
  },
  APPRISE_URLS: maxLengthRule('Apprise URLs', LONG_TEXT_MAX_LENGTH),
};
