import { renderHook } from "@testing-library/react";
import { UserDevice } from "@/types";
import { useDeviceUtils } from "./useDeviceUtils";

const NOW = new Date("2026-01-01T12:00:00.000Z");

const deviceExpiring = (offsetMs: number | null): UserDevice =>
  ({
    temporaryAccessUntil:
      offsetMs === null
        ? undefined
        : new Date(NOW.getTime() + offsetMs).toISOString(),
  }) as UserDevice;

const utils = () => renderHook(() => useDeviceUtils()).result.current;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("hasTemporaryAccess", () => {
  it("is false when no expiry is set", () => {
    expect(utils().hasTemporaryAccess(deviceExpiring(null))).toBe(false);
  });

  it("is true while the window is open", () => {
    expect(utils().hasTemporaryAccess(deviceExpiring(HOUR))).toBe(true);
  });

  it("is false once the window has passed", () => {
    expect(utils().hasTemporaryAccess(deviceExpiring(-HOUR))).toBe(false);
  });
});

describe("getTemporaryAccessTimeLeft", () => {
  it("returns null when no expiry is set", () => {
    expect(utils().getTemporaryAccessTimeLeft(deviceExpiring(null))).toBeNull();
  });

  it("reports an elapsed window as expired", () => {
    expect(utils().getTemporaryAccessTimeLeft(deviceExpiring(-MINUTE))).toBe(
      "Expired",
    );
  });

  it("rounds a sub-minute window up to a minute", () => {
    expect(utils().getTemporaryAccessTimeLeft(deviceExpiring(1))).toBe(
      "1 minute",
    );
  });

  it("spells minutes out", () => {
    expect(
      utils().getTemporaryAccessTimeLeft(deviceExpiring(30 * MINUTE)),
    ).toBe("30 minutes");
  });

  it("spells hours and minutes out", () => {
    expect(
      utils().getTemporaryAccessTimeLeft(deviceExpiring(2 * HOUR + 5 * MINUTE)),
    ).toBe("2 hours and 5 minutes");
  });

  it("spells days and hours out", () => {
    expect(
      utils().getTemporaryAccessTimeLeft(deviceExpiring(3 * DAY + 4 * HOUR)),
    ).toBe("3 days and 4 hours");
  });

  it("leads with weeks", () => {
    expect(
      utils().getTemporaryAccessTimeLeft(deviceExpiring(2 * WEEK + 1 * DAY)),
    ).toBe("2 weeks and 1 day");
  });

  it("keeps only the two most significant parts", () => {
    expect(
      utils().getTemporaryAccessTimeLeft(
        deviceExpiring(WEEK + DAY + HOUR + MINUTE),
      ),
    ).toBe("1 week and 1 day");
  });

  it("omits zeroed units", () => {
    expect(utils().getTemporaryAccessTimeLeft(deviceExpiring(WEEK))).toBe(
      "1 week",
    );
  });
});

describe("convertToMinutes", () => {
  it.each([
    [5, "minutes" as const, 5],
    [2, "hours" as const, 120],
    [1, "days" as const, 1440],
    [1, "weeks" as const, 10080],
  ])("converts %s %s", (value, unit, expected) => {
    expect(utils().convertToMinutes(value, unit)).toBe(expected);
  });

  it("rounds fractional input", () => {
    expect(utils().convertToMinutes(1.5, "hours")).toBe(90);
    expect(utils().convertToMinutes(2.4, "minutes")).toBe(2);
  });

  it("clamps non-positive input to one minute", () => {
    expect(utils().convertToMinutes(0, "hours")).toBe(1);
    expect(utils().convertToMinutes(-5, "days")).toBe(1);
  });
});

describe("formatDuration", () => {
  it("singularizes a value of one", () => {
    expect(utils().formatDuration(1, "hours")).toBe("1 hour");
    expect(utils().formatDuration(1, "days")).toBe("1 day");
  });

  it("keeps the plural otherwise", () => {
    expect(utils().formatDuration(3, "weeks")).toBe("3 weeks");
    expect(utils().formatDuration(0, "minutes")).toBe("0 minutes");
  });
});

describe("isValidDuration", () => {
  it("accepts a positive duration", () => {
    expect(utils().isValidDuration(5, "minutes")).toBe(true);
  });

  it("rejects zero and negatives", () => {
    expect(utils().isValidDuration(0, "minutes")).toBe(false);
    expect(utils().isValidDuration(-1, "hours")).toBe(false);
  });
});
