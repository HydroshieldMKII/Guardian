import {
  dayLabel,
  endsAfterStart,
  findConflictingRule,
  minutesOfDay,
  sortTimeRules,
  windowsOverlap,
} from "@/lib/time-rules";
import type { UserTimeRule } from "@/types";

const rule = (overrides: Partial<UserTimeRule>): UserTimeRule => ({
  id: 1,
  userId: "u-1",
  ruleName: "Rule",
  enabled: true,
  action: "block",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("minutesOfDay", () => {
  it.each([
    ["00:00", 0],
    ["09:30", 570],
    ["23:59", 1439],
  ])("reads %s as %i minutes", (time, minutes) => {
    expect(minutesOfDay(time)).toBe(minutes);
  });
});

describe("endsAfterStart", () => {
  it("accepts an end later the same day", () => {
    expect(endsAfterStart("09:00", "09:01")).toBe(true);
  });

  it.each([
    ["09:00", "09:00"],
    ["22:00", "06:00"],
  ])("rejects %s to %s", (start, end) => {
    expect(endsAfterStart(start, end)).toBe(false);
  });
});

describe("windowsOverlap", () => {
  const morning = { startTime: "09:00", endTime: "12:00" };

  it("sees a shared stretch of time", () => {
    expect(
      windowsOverlap(morning, { startTime: "11:00", endTime: "13:00" }),
    ).toBe(true);
    expect(
      windowsOverlap({ startTime: "10:00", endTime: "11:00" }, morning),
    ).toBe(true);
  });

  it("lets two windows touch at one end", () => {
    expect(
      windowsOverlap(morning, { startTime: "12:00", endTime: "13:00" }),
    ).toBe(false);
    expect(
      windowsOverlap({ startTime: "08:00", endTime: "09:00" }, morning),
    ).toBe(false);
  });
});

describe("sortTimeRules", () => {
  it("orders by day, then by start time, without touching the input", () => {
    const rules = [
      rule({ id: 1, dayOfWeek: 2, startTime: "08:00" }),
      rule({ id: 2, dayOfWeek: 1, startTime: "18:00" }),
      rule({ id: 3, dayOfWeek: 1, startTime: "08:00" }),
    ];

    expect(sortTimeRules(rules).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(rules.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe("dayLabel", () => {
  it.each([
    [0, "Sunday"],
    [6, "Saturday"],
    [9, "Unknown"],
  ])("names day %i %s", (dayOfWeek, label) => {
    expect(dayLabel(dayOfWeek)).toBe(label);
  });
});

describe("findConflictingRule", () => {
  const rules = [
    rule({ id: 1, dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }),
    rule({ id: 2, dayOfWeek: 2, startTime: "09:00", endTime: "12:00" }),
  ];

  it("finds a rule on the same day that shares some time", () => {
    expect(
      findConflictingRule(rules, {
        dayOfWeek: 2,
        startTime: "11:00",
        endTime: "13:00",
      })?.id,
    ).toBe(2);
  });

  it("ignores rules on other days and windows that only touch", () => {
    expect(
      findConflictingRule(rules, {
        dayOfWeek: 1,
        startTime: "12:00",
        endTime: "13:00",
      }),
    ).toBeUndefined();
    expect(
      findConflictingRule(rules, {
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "12:00",
      }),
    ).toBeUndefined();
  });

  it("ignores the rule being edited", () => {
    expect(
      findConflictingRule(
        rules,
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
        1,
      ),
    ).toBeUndefined();
  });
});
