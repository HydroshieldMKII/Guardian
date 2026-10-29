import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  MAX_CONCURRENT_STREAM_LIMIT,
  UpdateConcurrentStreamLimitDto,
} from './update-concurrent-stream-limit.dto';
import { UpdateUserIPPolicyDto } from './update-user-ip-policy.dto';
import { UpdateUserPreferenceDto } from './update-user-preference.dto';

const invalidProperties = <T extends object>(
  cls: new () => T,
  payload: unknown,
) => validateSync(plainToInstance(cls, payload)).map((error) => error.property);

describe('UpdateConcurrentStreamLimitDto', () => {
  it.each([null, 0, 1, 5, MAX_CONCURRENT_STREAM_LIMIT])(
    'accepts %p',
    (value) => {
      expect(
        invalidProperties(UpdateConcurrentStreamLimitDto, {
          concurrentStreamLimit: value,
        }),
      ).toEqual([]);
    },
  );

  it.each([
    -3,
    'abc',
    '3',
    1.5,
    1e30,
    MAX_CONCURRENT_STREAM_LIMIT + 1,
    undefined,
  ])('rejects %p', (value) => {
    expect(
      invalidProperties(UpdateConcurrentStreamLimitDto, {
        concurrentStreamLimit: value,
      }),
    ).toEqual(['concurrentStreamLimit']);
  });
});

describe('UpdateUserPreferenceDto', () => {
  it.each([true, false, null])('accepts %p', (defaultBlock) => {
    expect(
      invalidProperties(UpdateUserPreferenceDto, { defaultBlock }),
    ).toEqual([]);
  });

  it.each(['garbage', 1, undefined, {}])('rejects %p', (defaultBlock) => {
    expect(
      invalidProperties(UpdateUserPreferenceDto, { defaultBlock }),
    ).toEqual(['defaultBlock']);
  });
});

describe('UpdateUserIPPolicyDto', () => {
  it('accepts the payload the UI sends', () => {
    expect(
      invalidProperties(UpdateUserIPPolicyDto, {
        networkPolicy: 'lan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['10.0.0.1', '192.168.0.0/16', '2001:db8::1', 'fd00::/8'],
      }),
    ).toEqual([]);
  });

  it('accepts a partial payload and an empty list', () => {
    expect(invalidProperties(UpdateUserIPPolicyDto, {})).toEqual([]);
    expect(
      invalidProperties(UpdateUserIPPolicyDto, {
        ipAccessPolicy: 'all',
        allowedIPs: [],
      }),
    ).toEqual([]);
  });

  it.each([
    [{ networkPolicy: 'bogus' }, 'networkPolicy'],
    [{ ipAccessPolicy: 'sometimes' }, 'ipAccessPolicy'],
    [{ allowedIPs: 'abc' }, 'allowedIPs'],
    [{ allowedIPs: [1, null, {}] }, 'allowedIPs'],
    [{ allowedIPs: ['not-an-ip'] }, 'allowedIPs'],
    [{ allowedIPs: ['999.1.1.1'] }, 'allowedIPs'],
    [{ allowedIPs: ['10.0.0.0/33'] }, 'allowedIPs'],
    [{ allowedIPs: ['fd00::/129'] }, 'allowedIPs'],
    [{ allowedIPs: ['10.0.0.1', ''] }, 'allowedIPs'],
  ])('rejects %j', (payload, property) => {
    expect(invalidProperties(UpdateUserIPPolicyDto, payload)).toEqual([
      property,
    ]);
  });
});
