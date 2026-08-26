import { act, renderHook, waitFor } from "@testing-library/react";
import { AppSetting } from "@/types";
import { SettingsProvider, useSettings } from "./settings-context";
import { useAuth, isAdminUser } from "./auth-context";

jest.mock("./auth-context", () => ({
  useAuth: jest.fn(),
  isAdminUser: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedIsAdminUser = jest.mocked(isAdminUser);

const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();

const setting = (key: string, value: string): AppSetting =>
  ({ key, value }) as AppSetting;

const authState = (overrides: Partial<ReturnType<typeof useAuth>> = {}) =>
  ({
    setupRequired: false,
    isLoading: false,
    isAuthenticated: true,
    user: { username: "admin" },
    ...overrides,
  }) as ReturnType<typeof useAuth>;

const jsonOk = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const setup = () =>
  renderHook(() => useSettings(), {
    wrapper: ({ children }) => <SettingsProvider>{children}</SettingsProvider>,
  });

const settled = async (hook: ReturnType<typeof setup>) =>
  waitFor(() => expect(hook.result.current.loading).toBe(false));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  globalThis.fetch = fetchMock;
  fetchMock.mockImplementation(async () =>
    jsonOk([
      setting("PLEX_GUARD_DEFAULT_BLOCK", "true"),
      setting("PLEX_SERVER_PORT", "32400"),
      setting("PLEX_SERVER_IP", "10.0.0.5"),
      setting("USE_SSL", "false"),
      setting("TIMEZONE", "not-a-number"),
    ]),
  );
  mockedUseAuth.mockReturnValue(authState());
  mockedIsAdminUser.mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useSettings", () => {
  it("throws when used outside its provider", () => {
    const silence = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSettings())).toThrow(
      "useSettings must be used within a SettingsProvider",
    );
    silence.mockRestore();
  });
});

describe("fetching", () => {
  it("loads settings for an authenticated admin", async () => {
    const hook = setup();
    await settled(hook);

    expect(fetchMock).toHaveBeenCalledWith("/api/pg/config");
    expect(hook.result.current.settings).toHaveLength(5);
    expect(hook.result.current.error).toBeNull();
  });

  it("skips fetching for a non-admin", async () => {
    mockedIsAdminUser.mockReturnValue(false);
    setup();

    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips fetching when unauthenticated", async () => {
    mockedUseAuth.mockReturnValue(authState({ isAuthenticated: false }));
    setup();

    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records an error when the response is not ok", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 500 }));
    const hook = setup();

    await settled(hook);
    expect(hook.result.current.error).toBe("Failed to fetch configuration");
  });

  it("records an error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const hook = setup();

    await settled(hook);
    expect(hook.result.current.error).toBe("Error fetching configuration");
  });

  it("refetches on refreshSettings", async () => {
    const hook = setup();
    await settled(hook);

    await act(async () => {
      await hook.result.current.refreshSettings();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("accessors", () => {
  const loaded = async () => {
    const hook = setup();
    await settled(hook);
    return hook;
  };

  it("getSetting returns the raw value", async () => {
    const hook = await loaded();
    expect(hook.result.current.getSetting("PLEX_SERVER_IP")).toBe("10.0.0.5");
  });

  it("getSetting returns null for an unknown key", async () => {
    const hook = await loaded();
    expect(hook.result.current.getSetting("NOPE")).toBeNull();
  });

  it("getBooleanSetting parses true and false", async () => {
    const hook = await loaded();
    expect(hook.result.current.getBooleanSetting("PLEX_GUARD_DEFAULT_BLOCK")).toBe(
      true,
    );
    expect(hook.result.current.getBooleanSetting("USE_SSL")).toBe(false);
  });

  it("getBooleanSetting returns null for an unknown key", async () => {
    const hook = await loaded();
    expect(hook.result.current.getBooleanSetting("NOPE")).toBeNull();
  });

  it("getNumberSetting parses a numeric value", async () => {
    const hook = await loaded();
    expect(hook.result.current.getNumberSetting("PLEX_SERVER_PORT")).toBe(32400);
  });

  it("getNumberSetting returns null for a non-numeric value", async () => {
    const hook = await loaded();
    expect(hook.result.current.getNumberSetting("TIMEZONE")).toBeNull();
  });

  it("getNumberSetting returns null for an unknown key", async () => {
    const hook = await loaded();
    expect(hook.result.current.getNumberSetting("NOPE")).toBeNull();
  });

  it("getGlobalDefaultBlock reflects the stored value", async () => {
    const hook = await loaded();
    expect(hook.result.current.getGlobalDefaultBlock()).toBe(true);
  });

  it("getGlobalDefaultBlock defaults to blocking when unset", async () => {
    fetchMock.mockImplementation(async () => jsonOk([]));
    const hook = await loaded();
    expect(hook.result.current.getGlobalDefaultBlock()).toBe(true);
  });
});

describe("updateSettings", () => {
  it("applies an update in place", async () => {
    const hook = setup();
    await settled(hook);

    act(() => {
      hook.result.current.updateSettings([
        { key: "PLEX_SERVER_IP", value: "10.0.0.9" },
      ]);
    });

    expect(hook.result.current.getSetting("PLEX_SERVER_IP")).toBe("10.0.0.9");
  });

  it("stringifies non-string values", async () => {
    const hook = setup();
    await settled(hook);

    act(() => {
      hook.result.current.updateSettings([
        { key: "PLEX_SERVER_PORT", value: 32401 },
      ]);
    });

    expect(hook.result.current.getSetting("PLEX_SERVER_PORT")).toBe("32401");
  });

  it("ignores updates for unknown keys", async () => {
    const hook = setup();
    await settled(hook);

    act(() => {
      hook.result.current.updateSettings([{ key: "NOPE", value: "x" }]);
    });

    expect(hook.result.current.settings).toHaveLength(5);
  });

  it("applies several updates at once", async () => {
    const hook = setup();
    await settled(hook);

    act(() => {
      hook.result.current.updateSettings([
        { key: "USE_SSL", value: true },
        { key: "PLEX_SERVER_IP", value: "1.2.3.4" },
      ]);
    });

    expect(hook.result.current.getBooleanSetting("USE_SSL")).toBe(true);
    expect(hook.result.current.getSetting("PLEX_SERVER_IP")).toBe("1.2.3.4");
  });
});
