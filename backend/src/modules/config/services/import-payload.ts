import { BadRequestException } from '@nestjs/common';
import { DeviceStatus, UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import {
  FieldReaders,
  isRecord,
  orNull,
  readBoolean,
  readBoundedText,
  readCount,
  readDate,
  readFields,
  readFilledText,
  readOneOf,
  readText,
  readTextListOrEmpty,
} from '@/modules/config/services/import-field-readers';

export interface ImportedSetting {
  key: string;
  value: string;
}

export type ImportedDevice = Partial<UserDevice> &
  Pick<UserDevice, 'userId' | 'deviceIdentifier'>;

export type ImportedPreference = Partial<UserPreference> &
  Pick<UserPreference, 'userId'>;

export interface ParsedImport {
  settings: ImportedSetting[];
  devices: ImportedDevice[];
  preferences: ImportedPreference[];
}

const DEVICE_STATUSES: readonly DeviceStatus[] = [
  'pending',
  'approved',
  'rejected',
];
const MAX_REPORTED_PROBLEMS = 10;

const optionalText = orNull(readText);
const optionalDate = orNull(readDate);

type DeviceFields = Omit<UserDevice, 'id'>;
type PreferenceFields = Omit<UserPreference, 'id' | 'createdAt' | 'updatedAt'>;

const DEVICE_READERS: FieldReaders<DeviceFields> = {
  userId: readFilledText,
  deviceIdentifier: readFilledText,
  username: optionalText,
  avatarUrl: optionalText,
  deviceName: optionalText,
  devicePlatform: optionalText,
  deviceProduct: optionalText,
  deviceVersion: optionalText,
  status: readOneOf(DEVICE_STATUSES),
  firstSeen: readDate,
  lastSeen: readDate,
  sessionCount: readCount,
  currentSessionKey: optionalText,
  ipAddress: optionalText,
  temporaryAccessUntil: optionalDate,
  temporaryAccessGrantedAt: optionalDate,
  temporaryAccessDurationMinutes: orNull(readCount),
  temporaryAccessBypassPolicies: readBoolean,
  excludeFromConcurrentLimit: readBoolean,
  requestDescription: orNull(readBoundedText(500)),
  requestSubmittedAt: optionalDate,
  requestNoteReadAt: optionalDate,
};

const PREFERENCE_READERS: FieldReaders<PreferenceFields> = {
  userId: readFilledText,
  username: optionalText,
  avatarUrl: optionalText,
  defaultBlock: orNull(readBoolean),
  hidden: readBoolean,
  networkPolicy: readOneOf(['both', 'lan', 'wan']),
  ipAccessPolicy: readOneOf(['all', 'restricted']),
  allowedIPs: readTextListOrEmpty,
  concurrentStreamLimit: orNull(readCount),
};

const readCollection = (
  data: Record<string, unknown>,
  name: string,
  problems: string[],
): unknown[] => {
  const items = data[name];
  if (items === undefined) return [];
  if (Array.isArray(items)) return items;
  problems.push(`${name} must be a list`);
  return [];
};

const readEntries = <T>(
  items: unknown[],
  name: string,
  problems: string[],
  read: (record: Record<string, unknown>, label: string) => T | null,
): T[] =>
  items.flatMap((item, index) => {
    const label = `${name}[${index}]`;
    if (!isRecord(item)) {
      problems.push(`${label} must be an object`);
      return [];
    }
    const entry = read(item, label);
    return entry ? [entry] : [];
  });

const readSetting = (
  record: Record<string, unknown>,
  label: string,
  problems: string[],
): ImportedSetting | null => {
  const { key, value } = record;
  if (typeof key !== 'string' || key.trim() === '') {
    problems.push(`${label}.key must be a non-empty string`);
    return null;
  }
  if (value !== null && typeof value !== 'string') {
    problems.push(`${label}.value must be a string`);
    return null;
  }
  return { key, value: value ?? '' };
};

const readDevice = (
  record: Record<string, unknown>,
  label: string,
  problems: string[],
): ImportedDevice | null => {
  const before = problems.length;
  const fields = readFields(record, DEVICE_READERS, label, problems);
  const { userId, deviceIdentifier } = fields;
  if (userId === undefined) problems.push(`${label}.userId is required`);
  if (deviceIdentifier === undefined) {
    problems.push(`${label}.deviceIdentifier is required`);
  }
  if (problems.length > before || !userId || !deviceIdentifier) return null;
  return { ...fields, userId, deviceIdentifier };
};

const readPreference = (
  record: Record<string, unknown>,
  label: string,
  problems: string[],
): ImportedPreference | null => {
  const before = problems.length;
  const fields = readFields(record, PREFERENCE_READERS, label, problems);
  const { userId } = fields;
  if (userId === undefined) problems.push(`${label}.userId is required`);
  if (problems.length > before || !userId) return null;
  return { ...fields, userId };
};

const reportDuplicates = <T>(
  entries: T[],
  name: string,
  identify: (entry: T) => string,
  problems: string[],
): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    const id = identify(entry);
    if (seen.has(id)) problems.push(`${name} contains a duplicate: ${id}`);
    seen.add(id);
  }
};

export const parseImportPayload = (raw: unknown): ParsedImport => {
  if (!isRecord(raw) || !isRecord(raw.data)) {
    throw new BadRequestException(
      'Failed to import database: Invalid import data format',
    );
  }

  const problems: string[] = [];
  const { data } = raw;

  const settings = readEntries(
    readCollection(data, 'settings', problems),
    'settings',
    problems,
    (record, label) => readSetting(record, label, problems),
  );
  const devices = readEntries(
    readCollection(data, 'userDevices', problems),
    'userDevices',
    problems,
    (record, label) => readDevice(record, label, problems),
  );
  const preferences = readEntries(
    readCollection(data, 'userPreferences', problems),
    'userPreferences',
    problems,
    (record, label) => readPreference(record, label, problems),
  );

  reportDuplicates(settings, 'settings', (s) => s.key, problems);
  reportDuplicates(
    devices,
    'userDevices',
    (d) => `${d.userId}/${d.deviceIdentifier}`,
    problems,
  );
  reportDuplicates(preferences, 'userPreferences', (p) => p.userId, problems);

  if (problems.length > 0) {
    const shown = problems.slice(0, MAX_REPORTED_PROBLEMS).join('; ');
    const hidden = problems.length - MAX_REPORTED_PROBLEMS;
    throw new BadRequestException(
      `Failed to import database: ${shown}${hidden > 0 ? `; and ${hidden} more` : ''}`,
    );
  }

  return { settings, devices, preferences };
};
