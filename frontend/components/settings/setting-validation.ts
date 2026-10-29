import { EMAIL_PATTERN } from "@/lib/profile-validation";
import type { AppSetting } from "@/types";
import type { SettingsFormData } from "./settings-utils";

interface IntegerRule {
  label: string;
  min: number;
  max: number;
}

export const INTEGER_RULES: Record<string, IntegerRule> = {
  PLEXGUARD_REFRESH_INTERVAL: {
    label: "Session refresh interval",
    min: 5,
    max: 86400,
  },
  DEVICE_CLEANUP_INTERVAL_DAYS: {
    label: "Device cleanup interval",
    min: 1,
    max: 3650,
  },
  SMTP_PORT: { label: "SMTP port", min: 1, max: 65535 },
  PLEX_SERVER_PORT: { label: "Plex server port", min: 1, max: 65535 },
  CONCURRENT_STREAM_LIMIT: {
    label: "Concurrent stream limit",
    min: 0,
    max: 1000,
  },
};

const PLAIN_INTEGER_PATTERN = /^-?\d+$/;
const HOSTNAME_PATTERN = /^[A-Za-z0-9_]([A-Za-z0-9_.-]*[A-Za-z0-9_])?$/;
const BRACKETED_IPV6_PATTERN = /^\[[0-9A-Fa-f:.]+\]$/;
const HOST_MAX_LENGTH = 253;
const EMAIL_MAX_LENGTH = 255;

export const integerError = (
  value: string,
  { label, min, max }: IntegerRule,
): string | null => {
  if (!PLAIN_INTEGER_PATTERN.test(value)) {
    return `${label} must be a whole number between ${min} and ${max}`;
  }
  const parsed = Number(value);
  return parsed < min || parsed > max
    ? `${label} must be between ${min} and ${max}`
    : null;
};

const hostError = (label: string, value: string): string | null => {
  if (!value) return null;
  const valid =
    value.length <= HOST_MAX_LENGTH &&
    (HOSTNAME_PATTERN.test(value) || BRACKETED_IPV6_PATTERN.test(value));
  return valid
    ? null
    : `${label} must be a hostname or IP address without spaces, scheme or path`;
};

const emailError = (value: string): string | null =>
  !value || (EMAIL_PATTERN.test(value) && value.length <= EMAIL_MAX_LENGTH)
    ? null
    : "From email must be a valid email address";

const recipientsError = (value: string): string | null => {
  const invalid = value
    .split(/[,;\n]/)
    .map((email) => email.trim())
    .find((email) => email && !EMAIL_PATTERN.test(email));
  return invalid ? `Invalid email address: ${invalid}` : null;
};

const TEXT_RULES: Record<string, (value: string) => string | null> = {
  SMTP_HOST: (value) => hostError("SMTP host", value),
  PLEX_SERVER_IP: (value) => hostError("Plex server address", value),
  SMTP_FROM_EMAIL: emailError,
  SMTP_TO_EMAILS: recipientsError,
};

export const settingError = (
  key: string,
  value: string | boolean | number | undefined,
): string | null => {
  if (value === undefined || typeof value === "boolean") return null;
  const text = String(value);
  const integerRule = INTEGER_RULES[key];
  if (integerRule) return integerError(text, integerRule);
  return TEXT_RULES[key]?.(text) ?? null;
};

export const invalidChangedSettings = (
  settings: AppSetting[],
  formData: SettingsFormData,
): Record<string, string> =>
  Object.fromEntries(
    settings.flatMap(({ key, value }) => {
      const current = formData[key];
      if (current === undefined || String(current) === value) return [];
      const error = settingError(key, current);
      return error ? [[key, error]] : [];
    }),
  );
