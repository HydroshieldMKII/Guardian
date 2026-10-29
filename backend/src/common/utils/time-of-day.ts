export const minutesOfDay = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const isTimeInWindow = (
  time: string,
  startTime: string,
  endTime: string,
): boolean => {
  const minutes = minutesOfDay(time);
  return minutes >= minutesOfDay(startTime) && minutes < minutesOfDay(endTime);
};
