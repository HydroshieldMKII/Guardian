export type DurationUnit = "minutes" | "hours" | "days" | "weeks";

const MINUTES_IN: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
};

const MINUTE_UNITS: [string, number][] = [
  ["week", MINUTES_IN.weeks],
  ["day", MINUTES_IN.days],
  ["hour", MINUTES_IN.hours],
  ["minute", MINUTES_IN.minutes],
];

const SECOND_UNITS: [string, number][] = [
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

export const pluralize = (count: number, noun: string): string =>
  `${count} ${count === 1 ? noun : `${noun}s`}`;

const isFilled = (parts: string[]): parts is [string, ...string[]] =>
  parts.length > 0;

const joinParts = (parts: [string, ...string[]]): string => {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

const breakDown = (
  total: number,
  units: [string, number][],
  maxParts: number,
): string[] => {
  const parts: string[] = [];
  let rest = Math.max(0, total);

  for (const [noun, size] of units) {
    if (parts.length === maxParts) break;
    const count = Math.floor(rest / size);
    if (count === 0) continue;
    parts.push(pluralize(count, noun));
    rest -= count * size;
  }

  return parts;
};

export const toMinutes = (value: number, unit: DurationUnit): number =>
  value <= 0 ? 1 : Math.round(value * MINUTES_IN[unit]);

export const formatUnitCount = (value: number, unit: DurationUnit): string =>
  pluralize(value, unit.slice(0, -1));

export const formatMinutes = (minutes: number, maxParts = 2): string => {
  const parts = breakDown(Math.round(minutes), MINUTE_UNITS, maxParts);
  return isFilled(parts) ? joinParts(parts) : "less than a minute";
};

export const formatSeconds = (seconds: number, maxParts = 2): string => {
  const parts = breakDown(Math.round(seconds), SECOND_UNITS, maxParts);
  return isFilled(parts) ? joinParts(parts) : "less than a second";
};

export const formatTimeLeft = (until: string | Date, maxParts = 2): string => {
  const remaining = new Date(until).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "Expired";
  return formatMinutes(Math.ceil(remaining / 60_000), maxParts);
};

export const formatElapsed = (milliseconds: number, maxParts = 2): string => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Unknown";
  return formatSeconds(Math.floor(milliseconds / 1000), maxParts);
};

export const formatClock = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes % 60)}:${pad(seconds % 60)}`
    : `${minutes}:${pad(seconds % 60)}`;
};
