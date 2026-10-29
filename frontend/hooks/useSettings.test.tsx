import { act, waitFor } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { appSetting } from "@/test-utils/dashboard";
import { renderHookWithQuery } from "@/test-utils/query";
import type { AppSetting } from "@/types";

const list = jest.fn<Promise<AppSetting[]>, []>();
jest.mock("@/lib/settings-api", () => ({
  settingsApi: { list: () => list() },
}));

type TestUser = { id: string } | null;
let auth: {
  setupRequired: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: TestUser;
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => auth,
  isAdminUser: (user: TestUser) => user !== null,
}));

const stored = [
  appSetting("PLEX_GUARD_DEFAULT_BLOCK", "false"),
  appSetting("PLEX_SERVER_PORT", "32400"),
  appSetting("TIMEZONE", "+00:00"),
];

const values = (settings: AppSetting[]) =>
  settings.map(({ key, value }) => ({ key, value }));

const renderLoaded = async () => {
  const rendered = renderHookWithQuery(() => useSettings());
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  auth = {
    setupRequired: false,
    isLoading: false,
    isAuthenticated: true,
    user: { id: "a-1" },
  };
  list.mockResolvedValue(stored);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("loading", () => {
  it("loads the settings for a signed-in admin", async () => {
    const { result } = await renderLoaded();

    expect(result.current.settings).toEqual(stored);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["during setup", { setupRequired: true }],
    ["while auth is loading", { isLoading: true }],
    ["when signed out", { isAuthenticated: false }],
    ["for anyone but an admin", { user: null }],
  ])("loads nothing %s", (_label, overrides) => {
    auth = { ...auth, ...overrides };
    const { result } = renderHookWithQuery(() => useSettings());

    expect(list).not.toHaveBeenCalled();
    expect(result.current.settings).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it("shares one load between every screen", async () => {
    const client = createQueryClient();
    renderHookWithQuery(() => useSettings(), client);
    const second = renderHookWithQuery(() => useSettings(), client);

    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("logs a failed load and stops loading", async () => {
    list.mockRejectedValue(new Error("down"));

    const { result } = await renderLoaded();

    expect(result.current.settings).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Request failed:",
      queryKeys.settings,
      expect.any(Error),
    );
  });

  it("loads again on refresh", async () => {
    const { result } = await renderLoaded();
    list.mockResolvedValue([appSetting("PLEX_SERVER_PORT", "32401")]);

    await act(() => result.current.refreshSettings());

    expect(list).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(values(result.current.settings)).toEqual([
        { key: "PLEX_SERVER_PORT", value: "32401" },
      ]),
    );
  });
});

describe("reading", () => {
  it("returns a stored value or null", async () => {
    const { result } = await renderLoaded();

    expect(result.current.getSetting("PLEX_SERVER_PORT")).toBe("32400");
    expect(result.current.getSetting("UNKNOWN")).toBeNull();
  });

  it.each([
    ["true", true],
    ["false", false],
    ["anything else", false],
  ])("blocks by default when the setting is %p", async (value, expected) => {
    list.mockResolvedValue([appSetting("PLEX_GUARD_DEFAULT_BLOCK", value)]);
    const { result } = await renderLoaded();

    expect(result.current.getGlobalDefaultBlock()).toBe(expected);
  });

  it("blocks by default when the setting is missing", async () => {
    list.mockResolvedValue([]);
    const { result } = await renderLoaded();

    expect(result.current.getGlobalDefaultBlock()).toBe(true);
  });
});

describe("updating", () => {
  it("writes saved values to every screen as strings", async () => {
    const { result, client } = await renderLoaded();

    act(() =>
      result.current.updateSettings([
        { key: "PLEX_GUARD_DEFAULT_BLOCK", value: true },
        { key: "PLEX_SERVER_PORT", value: 1 },
        { key: "PLEX_SERVER_PORT", value: 32402 },
        { key: "UNKNOWN", value: "ignored" },
      ]),
    );

    const expected = [
      { key: "PLEX_GUARD_DEFAULT_BLOCK", value: "true" },
      { key: "PLEX_SERVER_PORT", value: "32402" },
      { key: "TIMEZONE", value: "+00:00" },
    ];
    await waitFor(() =>
      expect(values(result.current.settings)).toEqual(expected),
    );
    expect(
      values(client.getQueryData<AppSetting[]>(queryKeys.settings) ?? []),
    ).toEqual(expected);
  });

  it("keeps an unloaded cache empty", () => {
    auth = { ...auth, user: null };
    const { result, client } = renderHookWithQuery(() => useSettings());

    act(() => result.current.updateSettings([{ key: "A", value: "b" }]));

    expect(client.getQueryData(queryKeys.settings)).toBeUndefined();
  });
});
