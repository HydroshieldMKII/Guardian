import {
  formatClock,
  formatElapsed,
  formatMinutes,
  formatSeconds,
  formatTimeLeft,
  formatUnitCount,
  pluralize,
  toMinutes,
} from "@/lib/duration";

describe("pluralize", () => {
  it("keeps the noun singular for one", () => {
    expect(pluralize(1, "hour")).toBe("1 hour");
  });

  it.each([0, 2, 17])("adds an s for %p", (count) => {
    expect(pluralize(count, "hour")).toBe(`${count} hours`);
  });
});

describe("toMinutes", () => {
  it.each([
    [30, "minutes" as const, 30],
    [2, "hours" as const, 120],
    [3, "days" as const, 4320],
    [1, "weeks" as const, 10080],
  ])("converts %p %s", (value, unit, expected) => {
    expect(toMinutes(value, unit)).toBe(expected);
  });

  it("floors a non-positive value at one minute", () => {
    expect(toMinutes(0, "hours")).toBe(1);
    expect(toMinutes(-5, "days")).toBe(1);
  });

  it("rounds a fractional value", () => {
    expect(toMinutes(1.5, "hours")).toBe(90);
  });
});

describe("formatUnitCount", () => {
  it.each([
    [1, "hours" as const, "1 hour"],
    [3, "hours" as const, "3 hours"],
    [1, "weeks" as const, "1 week"],
    [2, "minutes" as const, "2 minutes"],
  ])("names %p %s in full", (value, unit, expected) => {
    expect(formatUnitCount(value, unit)).toBe(expected);
  });
});

describe("formatMinutes", () => {
  it.each([
    [45, "45 minutes"],
    [60, "1 hour"],
    [150, "2 hours and 30 minutes"],
    [1440, "1 day"],
    [1500, "1 day and 1 hour"],
    [10080, "1 week"],
    [13000, "1 week and 2 days"],
  ])("spells %p minutes out as %p", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it("keeps only the largest unit when asked", () => {
    expect(formatMinutes(150, 1)).toBe("2 hours");
  });

  it("joins three parts with commas and a final and", () => {
    expect(formatMinutes(1440 + 120 + 5, 3)).toBe(
      "1 day, 2 hours and 5 minutes",
    );
  });

  it.each([0, -10])("has words for %p minutes", (minutes) => {
    expect(formatMinutes(minutes)).toBe("less than a minute");
  });
});

describe("formatSeconds", () => {
  it.each([
    [5, "5 seconds"],
    [65, "1 minute and 5 seconds"],
    [3600, "1 hour"],
    [3725, "1 hour and 2 minutes"],
  ])("spells %p seconds out as %p", (seconds, expected) => {
    expect(formatSeconds(seconds)).toBe(expected);
  });

  it("has words for nothing at all", () => {
    expect(formatSeconds(0)).toBe("less than a second");
  });
});

describe("formatTimeLeft", () => {
  const inMinutes = (minutes: number) =>
    new Date(Date.now() + minutes * 60_000).toISOString();

  it("counts down to the deadline", () => {
    expect(formatTimeLeft(inMinutes(150))).toBe("2 hours and 30 minutes");
  });

  it("accepts a Date as well as a string", () => {
    expect(formatTimeLeft(new Date(Date.now() + 3_600_000))).toBe("1 hour");
  });

  it("rounds a sliver of time up to a minute rather than to nothing", () => {
    expect(formatTimeLeft(new Date(Date.now() + 500))).toBe("1 minute");
  });

  it.each([-1, -1000])("reports a deadline %p minutes ago as expired", (m) => {
    expect(formatTimeLeft(inMinutes(m))).toBe("Expired");
  });

  it("reports an unreadable date as expired rather than guessing", () => {
    expect(formatTimeLeft("not a date")).toBe("Expired");
  });
});

describe("formatElapsed", () => {
  it("spells out how long a stream has run", () => {
    expect(formatElapsed(3_725_000)).toBe("1 hour and 2 minutes");
  });

  it.each([Number.NaN, -1])("cannot read %p", (milliseconds) => {
    expect(formatElapsed(milliseconds)).toBe("Unknown");
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [5_000, "0:05"],
    [65_000, "1:05"],
    [600_000, "10:00"],
    [3_600_000, "1:00:00"],
    [3_725_000, "1:02:05"],
    [86_400_000, "24:00:00"],
  ])("formats %pms as %p", (milliseconds, expected) => {
    expect(formatClock(milliseconds)).toBe(expected);
  });

  it("never runs backwards", () => {
    expect(formatClock(-5000)).toBe("0:00");
  });
});
