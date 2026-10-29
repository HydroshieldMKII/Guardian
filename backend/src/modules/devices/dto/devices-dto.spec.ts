import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BatchTemporaryAccessDto,
  MAX_TEMPORARY_ACCESS_MINUTES,
  TemporaryAccessDto,
} from './temporary-access.dto';
import { MAX_DEVICE_NAME_LENGTH, RenameDeviceDto } from './rename-device.dto';
import { ExcludeFromConcurrentLimitDto } from './exclude-from-concurrent-limit.dto';

const build = <T extends object>(cls: new () => T, payload: unknown): T =>
  plainToInstance(cls, payload);

const invalidProperties = <T extends object>(
  cls: new () => T,
  payload: unknown,
) => validateSync(build(cls, payload)).map((error) => error.property);

describe('TemporaryAccessDto', () => {
  it.each([1, 30, 1440, MAX_TEMPORARY_ACCESS_MINUTES])(
    'accepts %s minutes',
    (durationMinutes) => {
      expect(
        invalidProperties(TemporaryAccessDto, { durationMinutes }),
      ).toEqual([]);
    },
  );

  it.each([
    undefined,
    null,
    0,
    -5,
    0.1,
    1.5,
    '5',
    'abc',
    1e15,
    1e20,
    MAX_TEMPORARY_ACCESS_MINUTES + 1,
  ])('rejects duration %p', (durationMinutes) => {
    expect(invalidProperties(TemporaryAccessDto, { durationMinutes })).toEqual([
      'durationMinutes',
    ]);
  });

  it('rejects an empty body', () => {
    expect(invalidProperties(TemporaryAccessDto, {})).toEqual([
      'durationMinutes',
    ]);
  });

  it('rejects a non-boolean bypass flag', () => {
    expect(
      invalidProperties(TemporaryAccessDto, {
        durationMinutes: 5,
        bypassPolicies: 'yes',
      }),
    ).toEqual(['bypassPolicies']);
  });
});

describe('BatchTemporaryAccessDto', () => {
  const valid = { deviceIds: [1, 2], durationMinutes: 15 };

  it('accepts a well formed payload', () => {
    expect(invalidProperties(BatchTemporaryAccessDto, valid)).toEqual([]);
  });

  it.each([
    ['an empty list', { ...valid, deviceIds: [] }, 'deviceIds'],
    ['a string list', { ...valid, deviceIds: 'abc' }, 'deviceIds'],
    ['a fractional id', { ...valid, deviceIds: [1.5] }, 'deviceIds'],
    ['a zero id', { ...valid, deviceIds: [0] }, 'deviceIds'],
    ['a huge duration', { ...valid, durationMinutes: 1e20 }, 'durationMinutes'],
    ['a zero duration', { ...valid, durationMinutes: 0 }, 'durationMinutes'],
    [
      'a negative duration',
      { ...valid, durationMinutes: -5 },
      'durationMinutes',
    ],
  ])('rejects %s', (_label, payload, property) => {
    expect(invalidProperties(BatchTemporaryAccessDto, payload)).toEqual([
      property,
    ]);
  });
});

describe('RenameDeviceDto', () => {
  it('trims the name', () => {
    expect(build(RenameDeviceDto, { newName: '  Living room  ' }).newName).toBe(
      'Living room',
    );
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['null', null],
    ['missing', undefined],
    ['numeric', 5],
    ['oversized', 'x'.repeat(MAX_DEVICE_NAME_LENGTH + 1)],
  ])('rejects a %s name', (_label, newName) => {
    expect(invalidProperties(RenameDeviceDto, { newName })).toEqual([
      'newName',
    ]);
  });

  it('accepts a name at the length limit', () => {
    expect(
      invalidProperties(RenameDeviceDto, {
        newName: 'x'.repeat(MAX_DEVICE_NAME_LENGTH),
      }),
    ).toEqual([]);
  });
});

describe('ExcludeFromConcurrentLimitDto', () => {
  it.each([true, false])('accepts %s', (exclude) => {
    expect(
      invalidProperties(ExcludeFromConcurrentLimitDto, { exclude }),
    ).toEqual([]);
  });

  it.each(['maybe', 1, null, undefined])('rejects %p', (exclude) => {
    expect(
      invalidProperties(ExcludeFromConcurrentLimitDto, { exclude }),
    ).toEqual(['exclude']);
  });

  it('rejects an empty body', () => {
    expect(invalidProperties(ExcludeFromConcurrentLimitDto, {})).toEqual([
      'exclude',
    ]);
  });
});
