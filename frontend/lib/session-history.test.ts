import {
  sessionDeviceName,
  sessionDuration,
  sessionProduct,
  sessionSubtitle,
  sessionTitle,
  sessionTone,
  type SessionHistoryEntry,
} from "@/lib/session-history";

const session = (
  overrides: Partial<SessionHistoryEntry> = {},
): SessionHistoryEntry => ({
  id: 1,
  sessionKey: "key-1",
  userId: "u-1",
  startedAt: "2026-01-01T10:00:00Z",
  endedAt: "2026-01-01T11:00:00Z",
  ...overrides,
});

describe("sessionTitle", () => {
  const episode = (overrides: Partial<SessionHistoryEntry>) =>
    session({ contentType: "episode", grandparentTitle: "Show", ...overrides });

  it.each([
    [
      { parentTitle: "Season 1", contentTitle: "Pilot" },
      "Show - Season 1: Pilot",
    ],
    [{ parentTitle: "Season 1" }, "Show - Season 1"],
    [{ contentTitle: "Pilot" }, "Show - Pilot"],
    [{}, "Show"],
  ])("builds an episode title from %j", (overrides, expected) => {
    expect(sessionTitle(episode(overrides))).toBe(expected);
  });

  it("uses the content title for anything else", () => {
    expect(sessionTitle(session({ contentTitle: "Arrival" }))).toBe("Arrival");
    expect(sessionTitle(session())).toBe("Unknown title");
  });
});

describe("sessionSubtitle", () => {
  it("names the artist of a track, with the year when known", () => {
    const track = session({ contentType: "track", grandparentTitle: "Band" });
    expect(sessionSubtitle(track)).toBe("Band");
    expect(sessionSubtitle({ ...track, year: 1999 })).toBe("Band • 1999");
  });

  it("falls back to the year, or nothing", () => {
    expect(sessionSubtitle(session({ year: 2016 }))).toBe("2016");
    expect(sessionSubtitle(session())).toBeNull();
  });
});

describe("sessionDeviceName", () => {
  const device = {
    id: 1,
    userId: "u-1",
    deviceIdentifier: "d-1",
    status: "approved",
    sessionCount: 1,
  };

  it("prefers the device name, then its product", () => {
    expect(
      sessionDeviceName(
        session({
          userDevice: {
            ...device,
            deviceName: "TV",
            deviceProduct: "Plex Web",
          },
        }),
      ),
    ).toBe("TV");
    expect(
      sessionDeviceName(
        session({ userDevice: { ...device, deviceProduct: "Plex Web" } }),
      ),
    ).toBe("Plex Web");
    expect(sessionDeviceName(session())).toBe("Unknown device");
  });
});

describe("sessionProduct", () => {
  it("tells Plexamp apart from the other Plex apps", () => {
    expect(sessionProduct(session({ product: "PlexAmp" }))).toBe("Plexamp");
    expect(sessionProduct(session({ product: "Plex for Roku" }))).toBe("Plex");
    expect(sessionProduct(session())).toBe("Unknown");
  });
});

describe("sessionDuration", () => {
  it("measures from start to end", () => {
    expect(sessionDuration(session())).toBe("1 hour");
  });

  it("measures an active session up to now", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T10:30:00Z"));
    expect(sessionDuration(session({ endedAt: undefined }))).toBe("30 minutes");
    jest.useRealTimers();
  });
});

describe("sessionTone", () => {
  it("separates active, stopped and ended sessions", () => {
    expect(sessionTone(session({ endedAt: undefined }))).toBe("positive");
    expect(sessionTone(session({ terminated: true }))).toBe("danger");
    expect(sessionTone(session())).toBe("neutral");
  });
});
