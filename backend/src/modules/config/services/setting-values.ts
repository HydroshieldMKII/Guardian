import { Logger } from '@nestjs/common';
import { SettingValue } from '@/modules/config/settings.catalog';

const logger = new Logger('SettingValues');

export const parseSettingValue = (
  value: string | null,
  type: string,
  key: string,
): SettingValue => {
  if (type === 'boolean') {
    return value === 'true';
  }
  if (type === 'number') {
    return parseFloat(value ?? '');
  }
  if (type === 'json') {
    try {
      return JSON.parse(value ?? 'null') as SettingValue;
    } catch {
      logger.warn(`Failed to parse JSON for ${key}: ${value}`);
    }
  }
  return value ?? '';
};

export const toStoredValue = (value: unknown): string =>
  typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value);
