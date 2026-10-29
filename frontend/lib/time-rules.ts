import type { UserTimeRule } from "@/types";

type TimeWindow = Pick<UserTimeRule, "startTime" | "endTime">;

export const minutesOfDay = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const endsAfterStart = (startTime: string, endTime: string): boolean =>
  minutesOfDay(endTime) > minutesOfDay(startTime);

export const windowsOverlap = (a: TimeWindow, b: TimeWindow): boolean =>
  minutesOfDay(a.startTime) < minutesOfDay(b.endTime) &&
  minutesOfDay(b.startTime) < minutesOfDay(a.endTime);

export const sortTimeRules = <Rule extends UserTimeRule>(
  rules: Rule[],
): Rule[] =>
  [...rules].sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek ||
      minutesOfDay(a.startTime) - minutesOfDay(b.startTime),
  );
