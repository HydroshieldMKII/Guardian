import type { DurationUnit } from "@/lib/duration";

export const DURATION_UNITS: DurationUnit[] = [
  "minutes",
  "hours",
  "days",
  "weeks",
];

export const QUICK_DURATIONS: {
  label: string;
  value: number;
  unit: DurationUnit;
}[] = [
  { label: "1 hour", value: 1, unit: "hours" },
  { label: "3 hours", value: 3, unit: "hours" },
  { label: "6 hours", value: 6, unit: "hours" },
  { label: "1 day", value: 1, unit: "days" },
  { label: "1 week", value: 1, unit: "weeks" },
];

export const BYPASSED_POLICIES = [
  {
    name: "Network policy",
    detail: "Restrictions on local network or internet streaming",
  },
  {
    name: "IP access",
    detail: "The allowed list of IP addresses and address ranges",
  },
  {
    name: "Time schedule",
    detail: "The hours during which streaming is blocked",
  },
  {
    name: "Device approval",
    detail: "Devices still pending approval, or already rejected",
  },
];

export const EXPIRY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};
