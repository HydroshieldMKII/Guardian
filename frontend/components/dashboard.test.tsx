import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { UnifiedDashboardData, UserDevice, UserPreference } from "@/types";
import { Dashboard } from "@/components/dashboard";

const push = jest.fn();
const replace = jest.fn();
const searchParams = new URLSearchParams();

const router = { push, replace };

jest.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const getDashboardData = jest.fn<Promise<UnifiedDashboardData>, unknown[]>();
jest.mock("@/lib/api", () => ({
  apiClient: {
    getDashboardData: (...args: unknown[]) => getDashboardData(...args),
  },
}));

const checkForUpdatesIfEnabled = jest.fn();
let versionInfo: { version?: string } | null = null;
jest.mock("@/contexts/version-context", () => ({
  useVersion: () => ({ versionInfo, checkForUpdatesIfEnabled }),
}));

const retryConnection = jest.fn();
let authState = { setupRequired: false, backendError: null as string | null };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ ...authState, retryConnection }),
}));

const publish = jest.fn();
jest.mock("@/contexts/dashboard-nav-context", () => ({
  ...jest.requireActual<typeof import("@/contexts/dashboard-nav-context")>(
    "@/contexts/dashboard-nav-context",
  ),
  useDashboardNav: () => ({
    view: null,
    pendingDevices: 0,
    activeStreams: 0,
    publish,
  }),
}));

let liveConnected = false;
let liveEnabled = true;
let pushLive: ((payload: UnifiedDashboardData) => void) | null = null;
jest.mock("@/hooks/useLiveDashboard", () => ({
  useLiveDashboard: (
    onUpdate: (payload: UnifiedDashboardData) => void,
    enabled: boolean,
  ) => {
    pushLive = onUpdate;
    liveEnabled = enabled;
    return { connected: liveConnected, lastUpdate: null };
  },
}));

jest.mock("@/components/streams-list", () => ({
  __esModule: true,
  default: ({
    onRefresh,
    onNavigateToDevice,
    onNavigateToUser,
  }: {
    onRefresh: () => void;
    onNavigateToDevice: (userId: string, deviceIdentifier: string) => void;
    onNavigateToUser: (userId: string) => void;
  }) => (
    <div>
      <span>streams-list</span>
      <button onClick={onRefresh}>refresh streams</button>
      <button onClick={() => onNavigateToDevice("u-3", "device-3")}>
        go to device
      </button>
      <button onClick={() => onNavigateToUser("u-3")}>go to user</button>
    </div>
  ),
}));

const mockNavigationCallbacks = new Set<() => void>();

jest.mock("@/components/device-management", () => ({
  DeviceManagement: ({
    onRefresh,
    navigationTarget,
    onNavigationComplete,
    selectedUserId,
    onSelectUser,
  }: {
    onRefresh: () => void;
    navigationTarget: { userId: string; deviceIdentifier: string } | null;
    onNavigationComplete: () => void;
    selectedUserId: string | null;
    onSelectUser: (userId: string | null) => void;
  }) => (
    <div ref={() => void mockNavigationCallbacks.add(onNavigationComplete)}>
      <span>device-management</span>
      <span>{`target:${navigationTarget?.deviceIdentifier ?? "none"}`}</span>
      <span>{`selected:${selectedUserId ?? "none"}`}</span>
      <button onClick={() => onSelectUser("u 5/x")}>select user</button>
      <button onClick={() => onSelectUser(null)}>deselect user</button>
      <button onClick={onRefresh}>refresh devices</button>
      <button onClick={onNavigationComplete}>clear target</button>
    </div>
  ),
}));

jest.mock("@/components/error-handler", () => ({
  ErrorHandler: ({
    backendError,
    onRetry,
  }: {
    backendError: string;
    onRetry: () => void;
  }) => (
    <div>
      <div>backend-error:{backendError}</div>
      <button onClick={onRetry}>retry backend</button>
    </div>
  ),
  PlexErrorHandler: ({
    plexStatus,
    onShowSettings,
  }: {
    plexStatus: { connectionStatus?: string } | null;
    onShowSettings: () => void;
  }) => (
    <div>
      <span>{`plex-error:${plexStatus?.connectionStatus ?? "none"}`}</span>
      <button onClick={onShowSettings}>open settings</button>
    </div>
  ),
}));

const dashboardData = (
  overrides: Partial<UnifiedDashboardData> = {},
): UnifiedDashboardData =>
  ({
    stats: {
      activeStreams: 2,
      totalDevices: 5,
      pendingDevices: 1,
      approvedDevices: 4,
    },
    plexStatus: { configured: true, hasValidCredentials: true },
    settings: [],
    devices: { all: [], pending: [], approved: [], processed: [] },
    users: [],
    ...overrides,
  }) as UnifiedDashboardData;

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  authState = { setupRequired: false, backendError: null };
  versionInfo = null;
  liveConnected = false;
  liveEnabled = true;
  pushLive = null;
  Array.from(searchParams.keys()).forEach((key) => searchParams.delete(key));
  getDashboardData.mockResolvedValue(dashboardData());
});

afterEach(async () => {
  cleanup();
  jest.useRealTimers();
  await act(async () => {});
  consoleError.mockRestore();
});

const renderDashboard = async () => {
  const view = render(<Dashboard />);
  await screen.findByText("device-management");
  return view;
};

describe("Dashboard", () => {
  it("renders the backend error handler instead of anything else", () => {
    authState = { setupRequired: false, backendError: "offline" };
    render(<Dashboard />);

    expect(screen.getByText("backend-error:offline")).toBeInTheDocument();
    expect(screen.queryByText("device-management")).toBeNull();
  });

  it("retries the backend connection from the error handler", async () => {
    authState = { setupRequired: false, backendError: "offline" };
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: "retry backend" }));

    expect(retryConnection).toHaveBeenCalledTimes(1);
  });

  it("renders nothing and fetches nothing during setup", () => {
    authState = { setupRequired: true, backendError: null };
    const { container } = render(<Dashboard />);

    expect(container).toBeEmptyDOMElement();
    expect(getDashboardData).not.toHaveBeenCalled();
  });

  it("keeps the live subscription closed during setup", () => {
    authState = { setupRequired: true, backendError: null };
    render(<Dashboard />);

    expect(liveEnabled).toBe(false);
  });

  it("shows a loader until the first payload arrives", async () => {
    let resolve: (value: UnifiedDashboardData) => void = () => {};
    getDashboardData.mockReturnValue(
      new Promise<UnifiedDashboardData>((r) => {
        resolve = r;
      }),
    );

    render(<Dashboard />);
    expect(screen.queryByText("device-management")).toBeNull();

    await act(async () => {
      resolve(dashboardData());
    });
    expect(await screen.findByText("device-management")).toBeInTheDocument();
  });

  it("prompts for configuration when Plex has no valid credentials", async () => {
    getDashboardData.mockResolvedValue(
      dashboardData({
        plexStatus: {
          configured: true,
          hasValidCredentials: false,
          connectionStatus: "Token rejected",
        },
      }),
    );

    render(<Dashboard />);

    expect(
      await screen.findByText("plex-error:Token rejected"),
    ).toBeInTheDocument();
  });

  it("surfaces a fetch failure as a backend connection status", async () => {
    getDashboardData.mockRejectedValue(new Error("boom"));

    render(<Dashboard />);

    expect(
      await screen.findByText(/plex-error:Backend connection error/),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to fetch dashboard stats:",
      expect.any(Error),
    );
  });

  it("prompts for configuration when Plex is not configured at all", async () => {
    getDashboardData.mockResolvedValue(
      dashboardData({
        plexStatus: {
          configured: false,
          hasValidCredentials: false,
          connectionStatus: "Not configured",
        },
      }),
    );

    render(<Dashboard />);

    expect(
      await screen.findByText("plex-error:Not configured"),
    ).toBeInTheDocument();
  });

  it("leaves the navbar's last counts alone until the first payload", () => {
    getDashboardData.mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);

    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes the view and the counts to the navbar once loaded", async () => {
    await renderDashboard();

    expect(publish).toHaveBeenLastCalledWith({
      view: "users",
      pendingDevices: 0,
      activeStreams: 2,
    });
  });

  it("counts only the devices the approval queue shows", async () => {
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
    const all = [
      device(1),
      device(2),
      device(3, { userId: "u-2" }),
      device(4, { deviceProduct: "Plexamp" }),
      device(5, { status: "approved", approved: true }),
    ];
    getDashboardData.mockResolvedValue(
      dashboardData({
        devices: { all, pending: all, approved: [], processed: [] },
        users: [hiddenUser],
      }),
    );

    await renderDashboard();

    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ pendingDevices: 2 }),
    );
  });

  describe("the view", () => {
    const withDefaultPage = (value: string) =>
      getDashboardData.mockResolvedValue(
        dashboardData({
          settings: [{ key: "DEFAULT_PAGE", value }],
        } as Partial<UnifiedDashboardData>),
      );

    it("defaults to users", async () => {
      await renderDashboard();
      expect(screen.getByText("device-management")).toBeInTheDocument();
    });

    it("honours a DEFAULT_PAGE of streams", async () => {
      getDashboardData.mockResolvedValue(
        dashboardData({
          settings: [{ key: "DEFAULT_PAGE", value: "streams" }],
        } as Partial<UnifiedDashboardData>),
      );

      render(<Dashboard />);
      expect(await screen.findByText("streams-list")).toBeInTheDocument();
    });

    it("falls back to users for an unknown DEFAULT_PAGE", async () => {
      getDashboardData.mockResolvedValue(
        dashboardData({
          settings: [{ key: "DEFAULT_PAGE", value: "nonsense" }],
        } as Partial<UnifiedDashboardData>),
      );

      render(<Dashboard />);
      expect(await screen.findByText("device-management")).toBeInTheDocument();
    });

    it("follows a streams view param over the default page", async () => {
      searchParams.set("view", "streams");

      render(<Dashboard />);

      expect(await screen.findByText("streams-list")).toBeInTheDocument();
      expect(publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: "streams" }),
      );
    });

    it("follows a users view param over a streams default page", async () => {
      withDefaultPage("streams");
      searchParams.set("view", "users");

      render(<Dashboard />);

      expect(await screen.findByText("device-management")).toBeInTheDocument();
      expect(screen.queryByText("streams-list")).toBeNull();
    });

    it("ignores an unknown view param", async () => {
      withDefaultPage("streams");
      searchParams.set("view", "nonsense");

      render(<Dashboard />);

      expect(await screen.findByText("streams-list")).toBeInTheDocument();
    });

    it("hands the user param to the users view", async () => {
      searchParams.set("view", "users");
      searchParams.set("user", "u-2");

      await renderDashboard();

      expect(screen.getByText("selected:u-2")).toBeInTheDocument();
    });

    it("selects no user without a user param", async () => {
      await renderDashboard();

      expect(screen.getByText("selected:none")).toBeInTheDocument();
    });

    it("pushes the selected user into the URL and scrolls to the top", async () => {
      const scrollTo = jest
        .spyOn(window, "scrollTo")
        .mockImplementation(() => {});
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole("button", { name: "select user" }));

      expect(push).toHaveBeenCalledWith("/?view=users&user=u%205%2Fx", {
        scroll: false,
      });
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      scrollTo.mockRestore();
    });

    it("drops the user from the URL when the selection clears", async () => {
      const scrollTo = jest
        .spyOn(window, "scrollTo")
        .mockImplementation(() => {});
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole("button", { name: "deselect user" }));

      expect(push).toHaveBeenCalledWith("/?view=users", { scroll: false });
      scrollTo.mockRestore();
    });
  });

  describe("live updates versus polling", () => {
    const renderWithTimers = async () => {
      jest.useFakeTimers();
      render(<Dashboard />);
      await act(async () => {});
    };

    it("polls on an interval while the stream is down", async () => {
      await renderWithTimers();
      expect(getDashboardData).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(getDashboardData).toHaveBeenCalledTimes(2);

      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(getDashboardData).toHaveBeenCalledTimes(3);
    });

    it("stops polling once the stream connects", async () => {
      liveConnected = true;
      await renderWithTimers();
      expect(getDashboardData).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(30000);
      });
      expect(getDashboardData).toHaveBeenCalledTimes(1);
    });

    it("keeps the live subscription open", async () => {
      await renderDashboard();
      expect(liveEnabled).toBe(true);
    });

    it("applies a pushed payload without any fetch", async () => {
      liveConnected = true;
      await renderDashboard();
      getDashboardData.mockClear();

      await act(async () => {
        pushLive?.(
          dashboardData({
            stats: {
              activeStreams: 9,
              totalDevices: 9,
              pendingDevices: 9,
              approvedDevices: 9,
            },
          }),
        );
      });

      expect(publish).toHaveBeenLastCalledWith({
        view: "users",
        pendingDevices: 0,
        activeStreams: 9,
      });
      expect(getDashboardData).not.toHaveBeenCalled();
    });

    it("clears the loader when the first update arrives over the stream", async () => {
      liveConnected = true;
      getDashboardData.mockReturnValue(new Promise(() => {}));

      render(<Dashboard />);
      expect(screen.queryByText("device-management")).toBeNull();

      await act(async () => {
        pushLive?.(dashboardData());
      });

      expect(screen.getByText("device-management")).toBeInTheDocument();
    });
  });

  describe("deep links", () => {
    it("targets a device from the query string and cleans the URL", async () => {
      searchParams.set("userId", "u-1");
      searchParams.set("deviceId", "device-7");

      await renderDashboard();

      expect(screen.getByText("target:device-7")).toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith("/?view=users&user=u-1", {
        scroll: false,
      });
    });

    it("encodes the user id it moves into the URL", async () => {
      searchParams.set("userId", "a&b");
      searchParams.set("deviceId", "device-7");

      await renderDashboard();

      expect(replace).toHaveBeenCalledWith("/?view=users&user=a%26b", {
        scroll: false,
      });
    });

    it("ignores a partial query string", async () => {
      searchParams.set("userId", "u-1");

      await renderDashboard();

      expect(screen.getByText("target:none")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("update checks", () => {
    it("runs on mount when the version is known", async () => {
      versionInfo = { version: "2.0.0" };
      await renderDashboard();
      expect(checkForUpdatesIfEnabled).toHaveBeenCalledTimes(1);
    });

    it("waits for the version before checking", async () => {
      await renderDashboard();
      expect(checkForUpdatesIfEnabled).not.toHaveBeenCalled();
    });

    it("runs again when the version becomes known", async () => {
      const { rerender } = await renderDashboard();
      const initial = checkForUpdatesIfEnabled.mock.calls.length;

      versionInfo = { version: "2.0.0" };
      await act(async () => {
        rerender(<Dashboard />);
      });

      expect(checkForUpdatesIfEnabled.mock.calls.length).toBeGreaterThan(
        initial,
      );
    });
  });
  describe("navigation handed up from the views", () => {
    it("opens settings from the configuration prompt", async () => {
      const user = userEvent.setup();
      getDashboardData.mockResolvedValue(
        dashboardData({
          plexStatus: {
            configured: false,
            hasValidCredentials: false,
            connectionStatus: "Not configured",
          },
        }),
      );

      render(<Dashboard />);
      await user.click(
        await screen.findByRole("button", { name: "open settings" }),
      );

      expect(push).toHaveBeenCalledWith("/settings");
    });

    it("routes to the user and targets the device a stream points at", async () => {
      const user = userEvent.setup();
      searchParams.set("view", "streams");

      const { rerender } = render(<Dashboard />);
      await screen.findByText("streams-list");
      await user.click(screen.getByRole("button", { name: "go to device" }));

      expect(push).toHaveBeenCalledWith("/?view=users&user=u-3", {
        scroll: false,
      });

      searchParams.set("view", "users");
      searchParams.set("user", "u-3");
      rerender(<Dashboard />);

      expect(screen.getByText("device-management")).toBeInTheDocument();
      expect(screen.getByText("selected:u-3")).toBeInTheDocument();
      expect(screen.getByText("target:device-3")).toBeInTheDocument();
    });

    it("clears the target once the view reports it navigated", async () => {
      searchParams.set("userId", "u-1");
      searchParams.set("deviceId", "device-7");
      const user = userEvent.setup();
      await renderDashboard();
      expect(screen.getByText("target:device-7")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "clear target" }));

      expect(screen.getByText("target:none")).toBeInTheDocument();
    });

    it("hands the view the same completion callback across renders", async () => {
      mockNavigationCallbacks.clear();
      searchParams.set("userId", "u-1");
      searchParams.set("deviceId", "device-7");
      const view = await renderDashboard();

      view.rerender(<Dashboard />);

      expect(mockNavigationCallbacks.size).toBe(1);
    });

    it("refreshes silently from the streams view", async () => {
      const user = userEvent.setup();
      getDashboardData.mockResolvedValue(
        dashboardData({
          settings: [{ key: "DEFAULT_PAGE", value: "streams" }],
        } as Partial<UnifiedDashboardData>),
      );

      render(<Dashboard />);
      await screen.findByText("streams-list");

      await user.click(screen.getByRole("button", { name: "refresh streams" }));

      await waitFor(() => expect(getDashboardData).toHaveBeenCalledTimes(2));
    });

    it("refreshes silently when a view asks for it", async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole("button", { name: "refresh devices" }));

      await waitFor(() => expect(getDashboardData).toHaveBeenCalledTimes(2));
      expect(screen.getByText("device-management")).toBeInTheDocument();
    });

    it("opens the user from a stream at the top of the page", async () => {
      const user = userEvent.setup();
      const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation();
      searchParams.set("view", "streams");

      render(<Dashboard />);
      await screen.findByText("streams-list");
      await user.click(screen.getByRole("button", { name: "go to user" }));

      expect(push).toHaveBeenCalledWith("/?view=users&user=u-3", {
        scroll: false,
      });
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      scrollTo.mockRestore();
    });
  });
});
