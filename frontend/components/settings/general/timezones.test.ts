import { getCurrentTimeInOffset, UTC_OFFSETS } from "./timezones";

describe("timezones", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lists whole-hour offsets from -12 to +12", () => {
    expect(UTC_OFFSETS).toHaveLength(25);
    expect(UTC_OFFSETS[0]).toBe("-12:00");
    expect(UTC_OFFSETS[12]).toBe("+00:00");
    expect(UTC_OFFSETS[24]).toBe("+12:00");
  });

  it("shows the current time at an offset", () => {
    expect(getCurrentTimeInOffset("+02:30")).toBe("14:30");
    expect(getCurrentTimeInOffset("-05:00")).toBe("07:00");
  });

  it("treats an offset without minutes as a whole hour", () => {
    expect(getCurrentTimeInOffset("+03")).toBe("15:00");
  });
});
