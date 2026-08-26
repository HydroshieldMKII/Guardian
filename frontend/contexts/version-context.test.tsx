import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { VersionProvider, useVersion } from "./version-context";

const mockAuthState = {
  setupRequired: false,
  isLoading: false,
  isAuthenticated: true,
  user: { id: "admin-1", username: "testuser" } as Record<string, unknown> | null,
};

jest.mock("./auth-context", () => ({
  useAuth: () => mockAuthState,
  isAdminUser: (user: Record<string, unknown> | null) =>
    user !== null && "id" in user,
}));

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const GITHUB_LATEST =
  "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest";

const routes: Record<string, () => Response> = {};

const release = (tag: string) => ({
  tag_name: tag,
  html_url: `https://github.com/HydroshieldMKII/Guardian/releases/${tag}`,
  body: "release notes",
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <VersionProvider>{children}</VersionProvider>
);

const renderVersion = async () => {
  const rendered = renderHook(() => useVersion(), { wrapper });
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;

  mockAuthState.setupRequired = false;
  mockAuthState.isLoading = false;
  mockAuthState.isAuthenticated = true;
  mockAuthState.user = { id: "admin-1", username: "testuser" };

  for (const key of Object.keys(routes)) delete routes[key];
  routes["/api/pg/config/version"] = () =>
    json({
      version: "1.3.5",
      name: "Guardian",
      databaseVersion: "1.3.5",
      codeVersion: "1.3.5",
      isVersionMismatch: false,
    });
  routes["/api/pg/config"] = () =>
    json([{ key: "AUTO_CHECK_UPDATES", value: "false" }]);
  routes[GITHUB_LATEST] = () => json(release("v1.4.0"));

  fetchMock.mockImplementation(async (url) => {
    const handler = routes[String(url)];
    if (!handler) throw new Error(`unmocked route ${String(url)}`);
    return handler();
  });
});

describe("useVersion", () => {
  it("refuses to be used outside a provider", () => {
    expect(() => renderHook(() => useVersion())).toThrow(
      "useVersion must be used within a VersionProvider",
    );
  });
});

describe("loading the version", () => {
  it("loads the version info for a signed-in admin", async () => {
    const { result } = await renderVersion();

    expect(result.current.versionInfo).toMatchObject({ version: "1.3.5" });
    expect(result.current.error).toBeNull();
  });

  it.each([
    ["setup is still required", { setupRequired: true }],
    ["auth is still loading", { isLoading: true }],
    ["nobody is signed in", { isAuthenticated: false }],
    ["the user is a portal user", { user: { plexUserId: "plex-9" } }],
  ])("does not ask for the version while %s", async (_label, patch) => {
    Object.assign(mockAuthState, patch);

    const { result } = await renderVersion();

    expect(result.current.versionInfo).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a server error", async () => {
    routes["/api/pg/config/version"] = () => json({}, { status: 500 });

    const { result } = await renderVersion();

    expect(result.current.error).toBe("Failed to fetch version info: 500");
    expect(result.current.versionInfo).toBeNull();
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const { result } = await renderVersion();
    expect(result.current.error).toBe("offline");
  });

  it("reports a non-Error failure generically", async () => {
    fetchMock.mockRejectedValue("boom");

    const { result } = await renderVersion();
    expect(result.current.error).toBe("Unknown error");
  });

  it("clears a previous error when refreshed", async () => {
    routes["/api/pg/config/version"] = () => json({}, { status: 500 });
    const { result } = await renderVersion();
    expect(result.current.error).not.toBeNull();

    routes["/api/pg/config/version"] = () => json({ version: "1.3.6" });
    await act(async () => {
      await result.current.refreshVersionInfo();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.versionInfo).toMatchObject({ version: "1.3.6" });
  });
});

describe("checkForUpdatesManually", () => {
  it("reports an available update", async () => {
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome).toMatchObject({
      hasUpdate: true,
      latestVersion: "1.4.0",
      currentVersion: "1.3.5",
    });
    expect(result.current.updateInfo?.hasUpdate).toBe(true);
  });

  it("reports being up to date", async () => {
    routes[GITHUB_LATEST] = () => json(release("v1.3.5"));
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome?.hasUpdate).toBe(false);
    expect(result.current.updateInfo).toBeNull();
  });

  it("ignores a release tag with no v prefix", async () => {
    routes[GITHUB_LATEST] = () => json(release("2.0.0"));
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome?.latestVersion).toBe("2.0.0");
    expect(outcome?.hasUpdate).toBe(true);
  });

  it("defaults empty release notes to an empty string", async () => {
    routes[GITHUB_LATEST] = () =>
      json({ ...release("v1.4.0"), body: null });
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesManually();
    });

    expect(result.current.updateInfo?.releaseNotes).toBe("");
  });

  it("returns nothing before the version is known", async () => {
    mockAuthState.isAuthenticated = false;
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome).toBeNull();
  });

  it("returns nothing when GitHub rejects the request", async () => {
    routes[GITHUB_LATEST] = () => json({}, { status: 403 });
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome).toBeNull();
  });

  it("returns nothing when GitHub is unreachable", async () => {
    const { result } = await renderVersion();
    routes[GITHUB_LATEST] = () => {
      throw new Error("offline");
    };

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome).toBeNull();
  });
});

describe("checkForUpdatesIfEnabled", () => {
  const enableAutoCheck = () => {
    routes["/api/pg/config"] = () =>
      json([{ key: "AUTO_CHECK_UPDATES", value: "true" }]);
  };

  it("does nothing while auto-checking is disabled", async () => {
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url) === GITHUB_LATEST),
    ).toBe(false);
  });

  it("checks GitHub when auto-checking is enabled", async () => {
    enableAutoCheck();
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toMatchObject({ hasUpdate: true, latestVersion: "1.4.0" });
    expect(result.current.updateInfo?.hasUpdate).toBe(true);
  });

  it("serves a repeat check from the cache while rate limited", async () => {
    enableAutoCheck();
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesIfEnabled();
    });

    const githubCalls = () =>
      fetchMock.mock.calls.filter(([url]) => String(url) === GITHUB_LATEST)
        .length;
    const before = githubCalls();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(githubCalls()).toBe(before);
    expect(outcome).toMatchObject({ hasUpdate: true, latestVersion: "1.4.0" });
    expect(result.current.updateInfo?.hasUpdate).toBe(true);
  });

  it("keeps the banner clear on a rate limited check with no update", async () => {
    enableAutoCheck();
    routes[GITHUB_LATEST] = () => json(release("v1.3.5"));
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesIfEnabled();
    });

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toMatchObject({ hasUpdate: false });
    expect(result.current.updateInfo).toBeNull();
  });

  it("reports a release with no notes as an empty string", async () => {
    enableAutoCheck();
    routes[GITHUB_LATEST] = () =>
      json({
        tag_name: "v1.4.0",
        html_url: "https://example.com/release",
      });
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome?.releaseNotes).toBe("");
    expect(result.current.updateInfo?.releaseNotes).toBe("");
  });

  it("leaves the banner alone when there is no update", async () => {
    enableAutoCheck();
    routes[GITHUB_LATEST] = () => json(release("v1.3.5"));
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesIfEnabled();
    });

    expect(result.current.updateInfo).toBeNull();
  });

  it("does nothing during setup", async () => {
    mockAuthState.setupRequired = true;
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toBeNull();
  });

  it("does nothing when the settings request fails", async () => {
    routes["/api/pg/config"] = () => json({}, { status: 500 });
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toBeNull();
  });

  it("does nothing when the setting is absent", async () => {
    routes["/api/pg/config"] = () => json([{ key: "TIMEZONE", value: "UTC" }]);
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toBeNull();
  });

  it("returns nothing when GitHub rejects the request", async () => {
    enableAutoCheck();
    routes[GITHUB_LATEST] = () => json({}, { status: 403 });
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toBeNull();
  });

  it("swallows a network failure", async () => {
    enableAutoCheck();
    const { result } = await renderVersion();
    routes["/api/pg/config"] = () => {
      throw new Error("offline");
    };

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(outcome).toBeNull();
  });

  it("serves a second check within the cooldown from cache", async () => {
    enableAutoCheck();
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesIfEnabled();
    });
    const callsAfterFirst = fetchMock.mock.calls.length;

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesIfEnabled>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesIfEnabled();
    });

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    expect(outcome).toMatchObject({ hasUpdate: true });
  });

  it("restores the banner from the cached result", async () => {
    enableAutoCheck();
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesIfEnabled();
    });
    act(() => result.current.clearUpdateInfo());
    expect(result.current.updateInfo).toBeNull();

    await act(async () => {
      await result.current.checkForUpdatesIfEnabled();
    });

    expect(result.current.updateInfo?.hasUpdate).toBe(true);
  });
});

describe("clearUpdateInfo", () => {
  it("dismisses the update banner", async () => {
    const { result } = await renderVersion();

    await act(async () => {
      await result.current.checkForUpdatesManually();
    });
    expect(result.current.updateInfo).not.toBeNull();

    act(() => result.current.clearUpdateInfo());
    expect(result.current.updateInfo).toBeNull();
  });
});

describe("version comparison", () => {
  it.each([
    ["1.4.0", true],
    ["1.3.6", true],
    ["2.0.0", true],
    ["1.3.5", false],
    ["1.3.4", false],
    ["1.2.9", false],
    ["1.3", false],
    ["1.3.5.1", true],
  ])("treats %s against 1.3.5 as hasUpdate=%p", async (tag, expected) => {
    routes[GITHUB_LATEST] = () => json(release(`v${tag}`));
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome?.hasUpdate).toBe(expected);
  });

  it("treats an unparseable segment as zero", async () => {
    routes[GITHUB_LATEST] = () => json(release("v1.3.beta"));
    const { result } = await renderVersion();

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome?.hasUpdate).toBe(false);
  });
});
