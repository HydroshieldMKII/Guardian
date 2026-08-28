import type { UserDevice, UserPreference, UserTimeRule } from "@/types";
import {
  devicePolicies,
  devicePolicyBadges,
  groupPolicyBadges,
  hasIPPolicy,
  hasTemporaryAccess,
  hasTimeSchedule,
  isPlexampDevice,
  isPolicyBypassed,
  temporaryAccessTimeLeft,
} from "@/lib/device-policies";

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  deviceProduct: "Plex for Roku",
  approved: true,
  status: "approved",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 0,
  ...overrides,
});

const preference = (
  overrides: Partial<UserPreference> = {},
): UserPreference => ({
  id: 1,
  userId: "u-1",
  defaultBlock: null,
  hidden: false,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  allowedIPs: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule =>
  ({
    id: 1,
    userId: "u-1",
    ruleName: "Bedtime",
    enabled: true,
    dayOfWeek: 1,
    startTime: "22:00",
    endTime: "23:00",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as UserTimeRule;

const inHours = (hours: number) =>
  new Date(Date.now() + hours * 3600_000).toISOString();

describe("isPlexampDevice", () => {
  it.each([
    ["by product", { deviceProduct: "Plexamp" }],
    ["by name", { deviceName: "Office PlexAmp" }],
  ])("recognises a Plexamp device %s", (_label, overrides) => {
    expect(isPlexampDevice(device(overrides))).toBe(true);
  });

  it("leaves an ordinary device alone", () => {
    expect(isPlexampDevice(device())).toBe(false);
  });
});

describe("hasTemporaryAccess", () => {
  it("is false without a grant", () => {
    expect(hasTemporaryAccess(device())).toBe(false);
  });

  it("is true while the grant is live", () => {
    expect(
      hasTemporaryAccess(device({ temporaryAccessUntil: inHours(1) })),
    ).toBe(true);
  });

  it("is false once it has lapsed", () => {
    expect(
      hasTemporaryAccess(device({ temporaryAccessUntil: inHours(-1) })),
    ).toBe(false);
  });
});

describe("temporaryAccessTimeLeft", () => {
  it("reports nothing without a grant", () => {
    expect(temporaryAccessTimeLeft(device())).toBeNull();
  });

  it("reports a lapsed grant as expired", () => {
    expect(
      temporaryAccessTimeLeft(device({ temporaryAccessUntil: inHours(-1) })),
    ).toBe("Expired");
  });

  it("counts down in the largest units that apply, spelled out", () => {
    expect(
      temporaryAccessTimeLeft(device({ temporaryAccessUntil: inHours(2) })),
    ).toBe("2 hours");
    expect(
      temporaryAccessTimeLeft(
        device({ temporaryAccessUntil: inHours(24 * 9) }),
      ),
    ).toBe("1 week and 2 days");
  });

  it("rounds a sliver of time up to a minute rather than to nothing", () => {
    expect(
      temporaryAccessTimeLeft(
        device({
          temporaryAccessUntil: new Date(Date.now() + 500).toISOString(),
        }),
      ),
    ).toBe("1 minute");
  });
});

describe("hasIPPolicy", () => {
  it("is off without a preference", () => {
    expect(hasIPPolicy(undefined)).toBe(false);
    expect(hasIPPolicy(preference())).toBe(false);
  });

  it.each([
    ["a network policy", { networkPolicy: "lan" as const }],
    ["a restricted access policy", { ipAccessPolicy: "restricted" as const }],
    ["a populated allow list", { allowedIPs: ["10.0.0.1"] }],
  ])("is on for %s", (_label, overrides) => {
    expect(hasIPPolicy(preference(overrides))).toBe(true);
  });

  it("tolerates an allow list stored as a string", () => {
    expect(
      hasIPPolicy(
        preference({ allowedIPs: "10.0.0.0/8" as unknown as string[] }),
      ),
    ).toBe(true);
    expect(
      hasIPPolicy(preference({ allowedIPs: "   " as unknown as string[] })),
    ).toBe(false);
  });

  it("is off when the allow list is missing entirely", () => {
    expect(
      hasIPPolicy(preference({ allowedIPs: null as unknown as string[] })),
    ).toBe(false);
  });
});

describe("hasTimeSchedule", () => {
  it("is off with no rules", () => {
    expect(hasTimeSchedule(undefined, "device-1")).toBe(false);
    expect(hasTimeSchedule([], "device-1")).toBe(false);
  });

  it("counts a user-wide rule against every device", () => {
    expect(hasTimeSchedule([rule()], "any-device")).toBe(true);
  });

  it("counts a rule aimed at this device", () => {
    expect(
      hasTimeSchedule([rule({ deviceIdentifier: "device-1" })], "device-1"),
    ).toBe(true);
  });

  it("ignores a rule aimed at another device", () => {
    expect(
      hasTimeSchedule([rule({ deviceIdentifier: "other" })], "device-1"),
    ).toBe(false);
  });

  it("ignores a disabled rule", () => {
    expect(hasTimeSchedule([rule({ enabled: false })], "device-1")).toBe(false);
  });
});

describe("devicePolicies", () => {
  it("reports nothing when no policy reaches the device", () => {
    expect(devicePolicies(device(), preference(), [])).toEqual([]);
  });

  it("reports the user's IP policy against every device", () => {
    expect(
      devicePolicies(device(), preference({ networkPolicy: "wan" }), []),
    ).toEqual(["ip"]);
  });

  it("reports a schedule and an IP policy together", () => {
    expect(
      devicePolicies(device(), preference({ networkPolicy: "wan" }), [rule()]),
    ).toEqual(["schedule", "ip"]);
  });

  it("reports a live temporary grant first", () => {
    expect(
      devicePolicies(
        device({ temporaryAccessUntil: inHours(1) }),
        preference({ networkPolicy: "wan" }),
        [rule()],
      ),
    ).toEqual(["temporary", "schedule", "ip"]);
  });

  it("drops the bypassed policies, keeping only the grant", () => {
    expect(
      devicePolicies(
        device({
          temporaryAccessUntil: inHours(1),
          temporaryAccessBypassPolicies: true,
        }),
        preference({ networkPolicy: "wan" }),
        [rule()],
      ),
    ).toEqual(["temporary"]);
  });

  it("ignores a bypass flag left over from a lapsed grant", () => {
    expect(
      devicePolicies(
        device({
          temporaryAccessUntil: inHours(-1),
          temporaryAccessBypassPolicies: true,
        }),
        preference({ networkPolicy: "wan" }),
        [rule()],
      ),
    ).toEqual(["schedule", "ip"]);
  });

  it("exempts PlexAmp, which no policy is enforced against", () => {
    expect(
      devicePolicies(
        device({ deviceProduct: "Plexamp", temporaryAccessUntil: inHours(1) }),
        preference({ networkPolicy: "wan" }),
        [rule()],
      ),
    ).toEqual([]);
  });
});

describe("isPolicyBypassed", () => {
  it("needs both a live grant and the flag", () => {
    expect(
      isPolicyBypassed(
        device({
          temporaryAccessUntil: inHours(1),
          temporaryAccessBypassPolicies: true,
        }),
      ),
    ).toBe(true);
    expect(
      isPolicyBypassed(device({ temporaryAccessBypassPolicies: true })),
    ).toBe(false);
  });
});

describe("devicePolicyBadges", () => {
  it("spells the policy out and puts the remaining time in the tooltip", () => {
    const [badge] = devicePolicyBadges(
      device({ temporaryAccessUntil: inHours(2) }),
      preference(),
      [],
    );

    expect(badge.label).toBe("Temporary Access");
    expect(badge.hint).toBe("Temporary access expires in 2 hours");
    expect(badge.tone).toBe("positive");
  });

  it("says so in the tooltip when the grant bypasses policies", () => {
    const [badge] = devicePolicyBadges(
      device({
        temporaryAccessUntil: inHours(2),
        temporaryAccessBypassPolicies: true,
      }),
      preference({ networkPolicy: "wan" }),
      [rule()],
    );

    expect(badge.hint).toContain(
      "bypasses the time schedule, IP access rules and device approval",
    );
  });

  it("labels and tones the schedule and IP badges", () => {
    const badges = devicePolicyBadges(
      device(),
      preference({ ipAccessPolicy: "restricted" }),
      [rule()],
    );

    expect(badges.map((badge) => badge.label)).toEqual([
      "Time Schedule",
      "IP Access",
    ]);
    expect(badges.map((badge) => badge.tone)).toEqual(["info", "accent"]);
    for (const badge of badges) {
      expect(badge.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("groupPolicyBadges", () => {
  it("raises a badge that any one device earns", () => {
    const badges = groupPolicyBadges(
      [device({ id: 1 }), device({ id: 2, temporaryAccessUntil: inHours(1) })],
      preference(),
      [],
    );

    expect(badges.map((badge) => badge.label)).toEqual(["Temporary Access"]);
  });

  it("shows each badge once however many devices earn it", () => {
    const badges = groupPolicyBadges(
      [
        device({ id: 1, temporaryAccessUntil: inHours(1) }),
        device({ id: 2, temporaryAccessUntil: inHours(3) }),
      ],
      preference({ networkPolicy: "lan" }),
      [rule()],
    );

    expect(badges.map((badge) => badge.label)).toEqual([
      "Temporary Access",
      "Time Schedule",
      "IP Access",
    ]);
  });

  it("speaks for the whole group rather than one device", () => {
    const [badge] = groupPolicyBadges(
      [device({ temporaryAccessUntil: inHours(2) })],
      preference(),
      [],
    );

    expect(badge.label).toBe("Temporary Access");
    expect(badge.hint).toBe("At least one device has temporary access");
  });

  it("stays empty for a user with no devices", () => {
    expect(groupPolicyBadges([], preference(), [])).toEqual([]);
  });

  it("keeps an IP policy off the row when the only device bypasses it", () => {
    const badges = groupPolicyBadges(
      [
        device({
          temporaryAccessUntil: inHours(1),
          temporaryAccessBypassPolicies: true,
        }),
      ],
      preference({ networkPolicy: "lan" }),
      [rule()],
    );

    expect(badges.map((badge) => badge.label)).toEqual(["Temporary Access"]);
  });
});
