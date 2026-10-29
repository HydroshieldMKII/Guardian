import {
  TIME_OF_DAY_PATTERN,
  isScheduleActive,
  isTimeInWindow,
  minutesOfDay,
  readClock,
} from '@/common/utils/time-of-day';

describe('minutesOfDay', () => {
  it.each([
    ['00:00', 0],
    ['08:30', 510],
    ['23:59', 1439],
  ])('reads %s as %i minutes', (time, minutes) => {
    expect(minutesOfDay(time)).toBe(minutes);
  });
});

describe('isTimeInWindow', () => {
  it('includes the start of the window', () => {
    expect(isTimeInWindow('08:00', '08:00', '09:00')).toBe(true);
  });

  it('includes the end of the window', () => {
    expect(isTimeInWindow('09:00', '08:00', '09:00')).toBe(true);
  });

  it('excludes the minute after the window', () => {
    expect(isTimeInWindow('09:01', '08:00', '09:00')).toBe(false);
  });

  it('compares numerically so unpadded legacy values work', () => {
    expect(isTimeInWindow('18:39', '9:05', '23:59')).toBe(true);
  });

  it('excludes a time before the window', () => {
    expect(isTimeInWindow('07:59', '08:00', '09:00')).toBe(false);
  });
});

describe('TIME_OF_DAY_PATTERN', () => {
  it.each(['00:00', '09:05', '23:59'])('accepts %s', (time) => {
    expect(TIME_OF_DAY_PATTERN.test(time)).toBe(true);
  });

  it.each(['24:00', '25:00', '9:5', '9:05', '12:60', '', '12:00:00'])(
    'rejects %s',
    (time) => {
      expect(TIME_OF_DAY_PATTERN.test(time)).toBe(false);
    },
  );
});

describe('readClock', () => {
  it('reads the weekday and minutes from UTC fields', () => {
    expect(readClock(new Date(Date.UTC(2026, 0, 5, 18, 33)))).toEqual({
      dayOfWeek: 1,
      minutes: 18 * 60 + 33,
    });
  });

  describe('independence from the process zone', () => {
    const originalZone = process.env.TZ;

    afterEach(() => {
      if (originalZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalZone;
      }
    });

    it.each(['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland'])(
      'reads the same clock under %s',
      (zone) => {
        process.env.TZ = zone;
        const instant = new Date('2026-01-05T18:33:00.000Z');
        expect(readClock(instant)).toEqual({
          dayOfWeek: 1,
          minutes: 18 * 60 + 33,
        });
      },
    );
  });
});

describe('isScheduleActive', () => {
  const schedule = { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' };

  it('is active on the day inside the window', () => {
    expect(isScheduleActive(schedule, { dayOfWeek: 1, minutes: 540 })).toBe(
      true,
    );
  });

  it('is inactive on another day', () => {
    expect(isScheduleActive(schedule, { dayOfWeek: 2, minutes: 500 })).toBe(
      false,
    );
  });
});
