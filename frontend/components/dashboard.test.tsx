import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UnifiedDashboardData } from "@/types";
import { Dashboard } from "@/components/dashboard";
import { renderWithQuery } from "@/test-utils/query";
import { queryKeys } from "@/lib/query-keys";

const render = renderWithQuery;

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

const retryConnection = jest.fn();
let authState = { setupRequired: false, backendError: null as string | null };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ ...authState, retryConnection }),
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

  it("shows the last dashboard straight away when it is opened again", async () => {
    const first = await renderDashboard();
    first.unmount();
    getDashboardData.mockReturnValue(new Promise(() => {}));

    render(<Dashboard />, { client: first.client });

    expect(screen.getByText("device-management")).toBeInTheDocument();
  });

  it("recovers from a failed refresh once the next one succeeds", async () => {
    await renderDashboard();
    getDashboardData.mockRejectedValueOnce(new Error("blip"));

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "refresh devices" }));
    expect(
      await screen.findByText(/plex-error:Backend connection error/),
    ).toBeInTheDocument();

    getDashboardData.mockResolvedValue(dashboardData());
    await act(async () => {
      pushLive?.(dashboardData());
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
      "Request failed:",
      ["dashboard"],
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
      const { client } = await renderDashboard();
      getDashboardData.mockClear();
      const pushed = dashboardData({
        stats: {
          activeStreams: 9,
          totalDevices: 9,
          pendingDevices: 9,
          approvedDevices: 9,
        },
      });

      await act(async () => {
        pushLive?.(pushed);
      });

      expect(client.getQueryData(queryKeys.dashboard)).toEqual(pushed);
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

      expect(await screen.findByText("device-management")).toBeInTheDocument();
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
