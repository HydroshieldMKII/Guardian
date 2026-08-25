import { UserTimeRule } from '@/entities/user-time-rule.entity';

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule =>
  Object.assign(new UserTimeRule(), {
    id: 1,
    userId: 'u1',
    ruleName: 'Bedtime',
    enabled: true,
    dayOfWeek: 1,
    startTime: '22:00',
    endTime: '23:30',
    ...overrides,
  });

describe('validateTimeRange', () => {
  it('accepts an end after the start', () => {
    expect(
      rule({ startTime: '08:00', endTime: '09:00' }).validateTimeRange(),
    ).toBe(true);
  });

  it('rejects an end equal to the start', () => {
    expect(
      rule({ startTime: '08:00', endTime: '08:00' }).validateTimeRange(),
    ).toBe(false);
  });

  it('rejects an end before the start', () => {
    expect(
      rule({ startTime: '09:00', endTime: '08:00' }).validateTimeRange(),
    ).toBe(false);
  });

  it('compares minutes, not just hours', () => {
    expect(
      rule({ startTime: '08:30', endTime: '08:45' }).validateTimeRange(),
    ).toBe(true);
    expect(
      rule({ startTime: '08:45', endTime: '08:30' }).validateTimeRange(),
    ).toBe(false);
  });
});

describe('overlaps', () => {
  it('is false across different users', () => {
    expect(rule({ id: 1 }).overlaps(rule({ id: 2, userId: 'other' }))).toBe(
      false,
    );
  });

  it('is false across different days', () => {
    expect(rule({ id: 1 }).overlaps(rule({ id: 2, dayOfWeek: 3 }))).toBe(false);
  });

  it('is false when both rules target different devices', () => {
    expect(
      rule({ id: 1, deviceIdentifier: 'a' }).overlaps(
        rule({ id: 2, deviceIdentifier: 'b' }),
      ),
    ).toBe(false);
  });

  it('is true when a user-wide rule meets a device rule', () => {
    expect(
      rule({ id: 1, deviceIdentifier: undefined }).overlaps(
        rule({ id: 2, deviceIdentifier: 'a' }),
      ),
    ).toBe(true);
  });

  it('is false against itself', () => {
    expect(rule({ id: 7 }).overlaps(rule({ id: 7 }))).toBe(false);
  });

  it('is true for a partial time overlap', () => {
    expect(
      rule({ id: 1, startTime: '08:00', endTime: '10:00' }).overlaps(
        rule({ id: 2, startTime: '09:00', endTime: '11:00' }),
      ),
    ).toBe(true);
  });

  it('is true when one range contains the other', () => {
    expect(
      rule({ id: 1, startTime: '08:00', endTime: '12:00' }).overlaps(
        rule({ id: 2, startTime: '09:00', endTime: '10:00' }),
      ),
    ).toBe(true);
  });

  it('is false for adjacent ranges that only touch', () => {
    expect(
      rule({ id: 1, startTime: '08:00', endTime: '09:00' }).overlaps(
        rule({ id: 2, startTime: '09:00', endTime: '10:00' }),
      ),
    ).toBe(false);
  });

  it('is false for disjoint ranges', () => {
    expect(
      rule({ id: 1, startTime: '08:00', endTime: '09:00' }).overlaps(
        rule({ id: 2, startTime: '18:00', endTime: '19:00' }),
      ),
    ).toBe(false);
  });

  it('is true for identical ranges on different rules', () => {
    expect(
      rule({ id: 1, startTime: '08:00', endTime: '09:00' }).overlaps(
        rule({ id: 2, startTime: '08:00', endTime: '09:00' }),
      ),
    ).toBe(true);
  });
});
