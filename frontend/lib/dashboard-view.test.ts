import {
  dashboardCounts,
  dashboardHref,
  resolveDashboardView,
} from "@/lib/dashboard-view";
import { appSetting, dashboardData } from "@/test-utils/dashboard";
import type { UserDevice, UserPreference } from "@/types";

const withDefaultPage = (value: string) =>
  dashboardData({ settings: [appSetting("DEFAULT_PAGE", value)] });

const device = (
  id: number,
  overrides: Partial<UserDevice> = {},
): UserDevice => ({
  id,
  userId: "u-1",
  deviceIdentifier: `device-${id}`,
  deviceName: "TV",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 0,
  ...overrides,
});

const hiddenUser: UserPreference = {
  id: 1,
  userId: "u-2",
  defaultBlock: null,
  hidden: true,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("dashboardHref", () => {
  it.each([
    ["streams", "/?view=streams"],
    ["users", "/?view=users"],
  ] as const)("links to the %s view", (view, href) => {
    expect(dashboardHref(view)).toBe(href);
  });
});

describe("resolveDashboardView", () => {
  it.each(["streams", "users"] as const)(
    "follows a requested %s view over the default page",
    (view) => {
      const other = view === "streams" ? "users" : "streams";
      expect(resolveDashboardView(view, withDefaultPage(other))).toBe(view);
    },
  );

  it("knows the requested view before the data arrives", () => {
    expect(resolveDashboardView("streams", undefined)).toBe("streams");
  });

  it("has no view without a request or data", () => {
    expect(resolveDashboardView(null, undefined)).toBeNull();
  });

  it("opens the streams default page", () => {
    expect(resolveDashboardView(null, withDefaultPage("streams"))).toBe(
      "streams",
    );
  });

  it.each(["users", "devices", "nonsense"])(
    "opens users for a %s default page",
    (value) => {
      expect(resolveDashboardView(null, withDefaultPage(value))).toBe("users");
    },
  );

  it("opens users when no default page is stored", () => {
    expect(resolveDashboardView(null, dashboardData())).toBe("users");
  });

  it("ignores a view the dashboard does not know", () => {
    expect(resolveDashboardView("elsewhere", withDefaultPage("streams"))).toBe(
      "streams",
    );
  });
});

describe("dashboardCounts", () => {
  it("counts nothing before the data arrives", () => {
    expect(dashboardCounts(undefined)).toEqual({
      pendingDevices: 0,
      activeStreams: 0,
    });
  });

  it("counts active streams and only the devices the approval queue shows", () => {
    const all = [
      device(1),
      device(2),
      device(3, { userId: "u-2" }),
      device(4, { deviceProduct: "Plexamp" }),
      device(5, { status: "approved", approved: true }),
    ];
    const data = dashboardData({
      devices: { all, pending: all, approved: [], processed: [] },
      users: [hiddenUser],
      stats: {
        activeStreams: 3,
        totalDevices: 5,
        pendingDevices: 4,
        approvedDevices: 1,
      },
    });

    expect(dashboardCounts(data)).toEqual({
      pendingDevices: 2,
      activeStreams: 3,
    });
  });
});
