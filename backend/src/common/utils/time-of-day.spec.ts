import { isTimeInWindow, minutesOfDay } from '@/common/utils/time-of-day';

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

  it('excludes the end of the window', () => {
    expect(isTimeInWindow('09:00', '08:00', '09:00')).toBe(false);
  });

  it('excludes a time before the window', () => {
    expect(isTimeInWindow('07:59', '08:00', '09:00')).toBe(false);
  });
});
