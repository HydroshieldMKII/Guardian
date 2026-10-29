export type TimeRulePreset = 'weekdays-only' | 'weekends-only';

export interface PresetRule {
  dayOfWeek: number;
  ruleName: string;
  startTime: string;
  endTime: string;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const BLOCKED_DAYS: Record<TimeRulePreset, number[]> = {
  'weekdays-only': [0, 6],
  'weekends-only': [1, 2, 3, 4, 5],
};

export const presetRules = (preset: TimeRulePreset): PresetRule[] =>
  (BLOCKED_DAYS[preset] ?? []).map((dayOfWeek) => ({
    dayOfWeek,
    ruleName: `${DAY_NAMES[dayOfWeek]} - Block All Day`,
    startTime: '00:00',
    endTime: '23:59',
  }));
