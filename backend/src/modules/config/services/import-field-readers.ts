export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };
export type FieldReader<T> = (value: unknown) => Parsed<T>;
export type FieldReaders<T> = { [K in keyof T]-?: FieldReader<T[K]> };

const accept = <T>(value: T): Parsed<T> => ({ ok: true, value });
const reject = (reason: string): Parsed<never> => ({ ok: false, reason });

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readText: FieldReader<string> = (value) =>
  typeof value === 'string' ? accept(value) : reject('must be a string');

export const readFilledText: FieldReader<string> = (value) =>
  typeof value === 'string' && value.trim() !== ''
    ? accept(value)
    : reject('must be a non-empty string');

export const readBoundedText =
  (maxLength: number): FieldReader<string> =>
  (value) =>
    typeof value === 'string' && value.length <= maxLength
      ? accept(value)
      : reject(`must be a string of at most ${maxLength} characters`);

export const readBoolean: FieldReader<boolean> = (value) =>
  typeof value === 'boolean' ? accept(value) : reject('must be true or false');

export const readCount: FieldReader<number> = (value) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? accept(value)
    : reject('must be a whole number of at least 0');

export const readDate: FieldReader<Date> = (value) => {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  return parsed && !isNaN(parsed.getTime())
    ? accept(parsed)
    : reject('must be a valid date');
};

export const readTextList: FieldReader<string[]> = (value) =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? accept(
        value.filter((entry): entry is string => typeof entry === 'string'),
      )
    : reject('must be a list of strings');

export const readTextListOrEmpty: FieldReader<string[]> = (value) =>
  value === null ? accept([]) : readTextList(value);

export const readOneOf =
  <T extends string>(allowed: readonly T[]): FieldReader<T> =>
  (value) => {
    const match = allowed.find((candidate) => candidate === value);
    return match !== undefined
      ? accept(match)
      : reject(`must be one of ${allowed.join(', ')}`);
  };

export const orNull =
  <T>(read: FieldReader<T>): FieldReader<T | null> =>
  (value) =>
    value === null ? accept(null) : read(value);

const keysOf = <T extends object>(object: T): (keyof T & string)[] =>
  Object.keys(object).filter((key): key is keyof T & string => key in object);

export const readFields = <T extends object>(
  record: Record<string, unknown>,
  readers: FieldReaders<T>,
  label: string,
  problems: string[],
): Partial<T> => {
  const result: Partial<T> = {};
  for (const key of keysOf(readers)) {
    const raw = record[key];
    if (raw === undefined) continue;
    const parsed = readers[key](raw);
    if (parsed.ok) {
      result[key] = parsed.value;
    } else {
      problems.push(`${label}.${key} ${parsed.reason}`);
    }
  }
  return result;
};
