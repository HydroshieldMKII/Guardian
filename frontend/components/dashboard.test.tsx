import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UnifiedDashboardData } from "@/types";
import { Dashboard } from "@/components/dashboard";

const push = jest.fn();
const replace = jest.fn();
const searchParams = new URLSearchParams();

const router = { push, replace };

jest.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const getDashboardData = jest.fn();
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
    onAutoRefreshChange,
    onRefresh,
    onNavigateToDevice,
    onNavigateToUser,
  }: {
    onAutoRefreshChange: (value: boolean) => void;
    onRefresh: () => void;
    onNavigateToDevice: (userId: string, deviceIdentifier: string) => void;
    onNavigateToUser: (userId: string) => void;
  }) => (
    <div>
      <span>streams-list</span>
      <button onClick={() => onAutoRefreshChange(false)}>pause streams</button>
      <button onClick={onRefresh}>refresh streams</button>
      <button onClick={() => onNavigateToDevice("u-3", "device-3")}>
        go to device
      </button>
      <button onClick={() => onNavigateToUser("u-3")}>go to user</button>
    </div>
  ),
}));

jest.mock("@/components/device-management", () => ({
  DeviceManagement: ({
    onAutoRefreshChange,
    onRefresh,
    navigationTarget,
    onNavigationComplete,
  }: {
    onAutoRefreshChange: (value: boolean) => void;
    onRefresh: () => void;
    navigationTarget: { userId: string; deviceIdentifier: string } | null;
    onNavigationComplete: () => void;
  }) => (
    <div>
      <span>device-management</span>
      <span>{`target:${navigationTarget?.deviceIdentifier ?? "none"}`}</span>
      <button onClick={() => onAutoRefreshChange(false)}>pause devices</button>
      <button onClick={onRefresh}>refresh devices</button>
      <button onClick={onNavigationComplete}>clear target</button>
    </div>
  ),
}));

jest.mock("@/components/error-handler", () => ({
  ErrorHandler: ({ backendError }: { backendError: string }) => (
    <div>backend-error:{backendError}</div>
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

  it("renders the device statistics once loaded", async () => {
    await renderDashboard();

    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  describe("the initial tab", () => {
    it("defaults to devices", async () => {
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

    it("falls back to devices for an unknown DEFAULT_PAGE", async () => {
      getDashboardData.mockResolvedValue(
        dashboardData({
          settings: [{ key: "DEFAULT_PAGE", value: "nonsense" }],
        } as Partial<UnifiedDashboardData>),
      );

      render(<Dashboard />);
      expect(await screen.findByText("device-management")).toBeInTheDocument();
    });

    it("switches tabs on click", async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole("button", { name: /Streams/ }));
      expect(screen.getByText("streams-list")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Devices/ }));
      expect(screen.getByText("device-management")).toBeInTheDocument();
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

    it("stops polling when auto-refresh is turned off", async () => {
      await renderWithTimers();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "pause devices" }));
      });

      await act(async () => {
        jest.advanceTimersByTime(30000);
      });
      expect(getDashboardData).toHaveBeenCalledTimes(1);
    });

    it("closes the live subscription when auto-refresh is turned off", async () => {
      await renderDashboard();
      expect(liveEnabled).toBe(true);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "pause devices" }));
      });
      expect(liveEnabled).toBe(false);
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

      expect(screen.getAllByText("9").length).toBeGreaterThan(0);
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
      expect(replace).toHaveBeenCalledWith("/", { scroll: false });
    });

    it("ignores a partial query string", async () => {
      searchParams.set("userId", "u-1");

      await renderDashboard();

      expect(screen.getByText("target:none")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("update checks", () => {
    it("runs once on mount", async () => {
      await renderDashboard();
      expect(checkForUpdatesIfEnabled).toHaveBeenCalled();
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
  describe("navigation handed up from the tabs", () => {
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

    it("switches to devices and targets the device a stream points at", async () => {
      const user = userEvent.setup();
      getDashboardData.mockResolvedValue(
        dashboardData({
          settings: [{ key: "DEFAULT_PAGE", value: "streams" }],
        } as Partial<UnifiedDashboardData>),
      );

      render(<Dashboard />);
      await screen.findByText("streams-list");
      await user.click(screen.getByRole("button", { name: "go to device" }));

      expect(screen.getByText("device-management")).toBeInTheDocument();
      expect(screen.getByText("target:device-3")).toBeInTheDocument();
    });

    it("clears the target once the tab reports it navigated", async () => {
      searchParams.set("userId", "u-1");
      searchParams.set("deviceId", "device-7");
      const user = userEvent.setup();
      await renderDashboard();
      expect(screen.getByText("target:device-7")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "clear target" }));

      expect(screen.getByText("target:none")).toBeInTheDocument();
    });

    it("refreshes silently from the streams tab", async () => {
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

    it("refreshes silently when a tab asks for it", async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole("button", { name: "refresh devices" }));

      await waitFor(() => expect(getDashboardData).toHaveBeenCalledTimes(2));
      expect(screen.getByText("device-management")).toBeInTheDocument();
    });

    describe("scrolling to a user", () => {
      it("highlights the matching card, then removes the highlight", async () => {
        getDashboardData.mockResolvedValue(
          dashboardData({
            settings: [{ key: "DEFAULT_PAGE", value: "streams" }],
          } as Partial<UnifiedDashboardData>),
        );

        render(<Dashboard />);
        await screen.findByText("streams-list");

        const card = document.createElement("div");
        card.setAttribute("data-user-id", "u-3");
        const scrollIntoView = jest.fn();
        card.scrollIntoView = scrollIntoView;
        document.body.appendChild(card);

        jest.useFakeTimers();
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "go to user" }));
        });

        await act(async () => {
          jest.advanceTimersByTime(100);
        });
        expect(scrollIntoView).toHaveBeenCalledWith({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        await act(async () => {
          jest.advanceTimersByTime(200);
        });
        expect(card.classList.contains("ring-2")).toBe(true);

        await act(async () => {
          jest.advanceTimersByTime(1500);
        });
        expect(card.classList.contains("ring-2")).toBe(false);

        card.remove();
      });

      it("does nothing when no card matches", async () => {
        getDashboardData.mockResolvedValue(
          dashboardData({
            settings: [{ key: "DEFAULT_PAGE", value: "streams" }],
          } as Partial<UnifiedDashboardData>),
        );

        render(<Dashboard />);
        await screen.findByText("streams-list");

        jest.useFakeTimers();
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "go to user" }));
        });

        await act(async () => {
          jest.advanceTimersByTime(2000);
        });

        expect(screen.getByText("device-management")).toBeInTheDocument();
      });
    });
  });
});
