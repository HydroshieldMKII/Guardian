export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ClockReading {
  dayOfWeek: number;
  minutes: number;
}

export const minutesOfDay = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const isMinuteInWindow = (
  minutes: number,
  startTime: string,
  endTime: string,
): boolean =>
  minutes >= minutesOfDay(startTime) && minutes <= minutesOfDay(endTime);

export const isTimeInWindow = (
  time: string,
  startTime: string,
  endTime: string,
): boolean => isMinuteInWindow(minutesOfDay(time), startTime, endTime);

export const readClock = (shiftedInstant: Date): ClockReading => ({
  dayOfWeek: shiftedInstant.getUTCDay(),
  minutes: shiftedInstant.getUTCHours() * 60 + shiftedInstant.getUTCMinutes(),
});

export const isScheduleActive = (
  schedule: { dayOfWeek: number; startTime: string; endTime: string },
  clock: ClockReading,
): boolean =>
  schedule.dayOfWeek === clock.dayOfWeek &&
  isMinuteInWindow(clock.minutes, schedule.startTime, schedule.endTime);
