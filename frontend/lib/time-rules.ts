import type { UserTimeRule } from "@/types";

type TimeWindow = Pick<UserTimeRule, "startTime" | "endTime">;
type DayWindow = Pick<UserTimeRule, "dayOfWeek" | "startTime" | "endTime">;

export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const dayLabel = (dayOfWeek: number): string =>
  DAYS_OF_WEEK.find((day) => day.value === dayOfWeek)?.label || "Unknown";

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

export const findConflictingRule = <Rule extends UserTimeRule>(
  rules: Rule[],
  window: DayWindow,
  excludeRuleId?: number,
): Rule | undefined =>
  rules.find(
    (rule) =>
      rule.id !== excludeRuleId &&
      rule.dayOfWeek === window.dayOfWeek &&
      windowsOverlap(window, rule),
  );
