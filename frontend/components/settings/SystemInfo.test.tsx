import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting } from "@/types";
import type { SettingsFormData } from "@/components/settings/settings-utils";
import { SystemInfo } from "@/components/settings/SystemInfo";

const getHealth = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: { getHealth: (...a: unknown[]) => getHealth(...a) },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const checkForUpdatesManually = jest.fn();
let versionInfo: Record<string, unknown> | null = null;
jest.mock("@/contexts/version-context", () => ({
  useVersion: () => ({ versionInfo, checkForUpdatesManually }),
}));

const health = (overrides: Record<string, unknown> = {}) => ({
  status: "ok",
  timestamp: "2026-01-01T00:00:00Z",
  service: "guardian",
  uptime: {
    milliseconds: 90_000,
    seconds: 90,
    startTime: "2026-01-01T00:00:00Z",
  },
  ...overrides,
});

const autoCheck = {
  key: "AUTO_CHECK_UPDATES",
  value: "false",
  type: "boolean",
} as AppSetting;

const renderPanel = async (
  props: { settings?: AppSetting[]; formData?: SettingsFormData } = {},
) => {
  const onFormDataChange = jest.fn();
  const view = render(
    <SystemInfo
      settings={props.settings ?? ([] as AppSetting[])}
      formData={props.formData ?? {}}
      onFormDataChange={onFormDataChange}
    />,
  );
  await act(async () => {});
  return { ...view, onFormDataChange, user: userEvent.setup() };
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  versionInfo = {
    version: "2.0.0",
    databaseVersion: "2.0.0",
    isVersionMismatch: false,
  };
  getHealth.mockResolvedValue(health());
  checkForUpdatesManually.mockResolvedValue({
    hasUpdate: false,
    currentVersion: "2.0.0",
    latestVersion: "2.0.0",
  });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("SystemInfo versions", () => {
  it("shows both versions", async () => {
    await renderPanel();

    expect(screen.getAllByText("v2.0.0").length).toBe(2);
  });

  it("falls back when versions are unknown", async () => {
    versionInfo = null;
    await renderPanel();

    expect(screen.getAllByText("vN/A").length).toBe(2);
  });

  it("warns on a version mismatch", async () => {
    versionInfo = { ...versionInfo, isVersionMismatch: true };
    await renderPanel();

    expect(screen.getByText(/Version Mismatch:/)).toBeInTheDocument();
  });
});

describe("SystemInfo health", () => {
  it.each(["ok", "healthy"])(
    "reports %s as OK with latency",
    async (status) => {
      getHealth.mockResolvedValue(health({ status }));
      await renderPanel();

      expect(screen.getByText("OK")).toBeInTheDocument();
      expect(screen.getByText(/^\d+ms$/)).toBeInTheDocument();
    },
  );

  it("reports an unexpected status as an error", async () => {
    getHealth.mockResolvedValue(health({ status: "degraded" }));
    await renderPanel();

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText(/Latency:/)).toBeNull();
  });

  it("shows a checking state before the first response", () => {
    getHealth.mockReturnValue(new Promise(() => {}));
    render(
      <SystemInfo
        settings={[] as AppSetting[]}
        formData={{}}
        onFormDataChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Checking...")).toBeInTheDocument();
  });

  it("reports a failed health check", async () => {
    getHealth.mockRejectedValue(new Error("offline"));
    await renderPanel();

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to fetch uptime info:",
      expect.any(Error),
    );
  });

  it("copes with a response carrying no uptime", async () => {
    getHealth.mockResolvedValue(health({ uptime: undefined }));
    await renderPanel();

    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText(/\(since /)).toBeNull();
  });

  it("shows when the service started", async () => {
    await renderPanel();
    expect(screen.getByText(/^\(since .+\)$/)).toBeInTheDocument();
  });
});

describe("SystemInfo uptime formatting", () => {
  it.each([
    [45, "45s"],
    [90, "1m 30s"],
    [3661, "1h 1m 1s"],
    [90061, "1d 1h 1m"],
  ])("formats %p seconds as %p", async (seconds, expected) => {
    getHealth.mockResolvedValue(
      health({
        uptime: {
          milliseconds: seconds * 1000,
          seconds,
          startTime: "2026-01-01T00:00:00Z",
        },
      }),
    );
    await renderPanel();

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("ticks up every second", async () => {
    getHealth.mockResolvedValue(
      health({
        uptime: {
          milliseconds: 45000,
          seconds: 45,
          startTime: "2026-01-01T00:00:00Z",
        },
      }),
    );
    jest.useFakeTimers();
    render(
      <SystemInfo
        settings={[] as AppSetting[]}
        formData={{}}
        onFormDataChange={jest.fn()}
      />,
    );
    await act(async () => {});
    expect(screen.getByText("45s")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText("47s")).toBeInTheDocument();
  });

  it("re-fetches health every five minutes", async () => {
    jest.useFakeTimers();
    render(
      <SystemInfo
        settings={[] as AppSetting[]}
        formData={{}}
        onFormDataChange={jest.fn()}
      />,
    );
    await act(async () => {});
    expect(getHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(getHealth).toHaveBeenCalledTimes(2);
  });

  it("stops both timers on unmount", async () => {
    jest.useFakeTimers();
    const { unmount } = render(
      <SystemInfo
        settings={[] as AppSetting[]}
        formData={{}}
        onFormDataChange={jest.fn()}
      />,
    );
    await act(async () => {});
    unmount();

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(getHealth).toHaveBeenCalledTimes(1);
  });
});

describe("SystemInfo update checks", () => {
  it("keeps the automatic update check with the manual one", async () => {
    const { user, onFormDataChange } = await renderPanel({
      settings: [autoCheck],
    });

    await user.click(screen.getByRole("switch"));

    expect(onFormDataChange).toHaveBeenCalledWith({
      AUTO_CHECK_UPDATES: true,
    });
  });

  it("omits the automatic check when the setting is missing", async () => {
    await renderPanel();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("reports that the app is current", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Check for Updates/ }));

    expect(
      await screen.findByText(
        "You are running the latest version of Guardian.",
      ),
    ).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("announces a new version", async () => {
    checkForUpdatesManually.mockResolvedValue({
      hasUpdate: true,
      currentVersion: "2.0.0",
      latestVersion: "2.1.0",
      updateUrl: "https://example.test",
    });
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Check for Updates/ }));

    expect(
      await screen.findByText("A new version (2.1.0) is available!"),
    ).toBeInTheDocument();
    expect(screen.getByText("Latest version: v2.1.0")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "default" }),
    );
  });

  it("omits the version line when the server does not name one", async () => {
    checkForUpdatesManually.mockResolvedValue({
      hasUpdate: true,
      currentVersion: "2.0.0",
    });
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Check for Updates/ }));

    await waitFor(() =>
      expect(screen.queryByText(/Latest version: v/)).toBeNull(),
    );
  });

  it("reports a null result as a failure", async () => {
    checkForUpdatesManually.mockResolvedValue(null);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Check for Updates/ }));

    expect(
      await screen.findByText(
        "Failed to check for updates. Please try again later.",
      ),
    ).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("reports a thrown failure", async () => {
    checkForUpdatesManually.mockRejectedValue(new Error("rate limited"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Check for Updates/ }));

    expect(
      await screen.findByText(
        "Failed to check for updates. Please try again later.",
      ),
    ).toBeInTheDocument();
  });

  it("is disabled until the current version is known", async () => {
    versionInfo = {};
    await renderPanel();

    expect(
      screen.getByRole("button", { name: /Check for Updates/ }),
    ).toBeDisabled();
  });

  it("shows progress while checking", async () => {
    checkForUpdatesManually.mockReturnValue(new Promise(() => {}));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Check for Updates/ }));

    expect(screen.getByText("Checking for Updates...")).toBeInTheDocument();
  });
});
