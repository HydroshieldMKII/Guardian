import { act, waitFor } from "@testing-library/react";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import type { VersionInfo } from "@/lib/version";
import { renderHookWithQuery } from "@/test-utils/query";

const info = jest.fn<Promise<VersionInfo>, []>();
jest.mock("@/lib/version-api", () => ({
  versionApi: { info: () => info() },
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

const installed = (version: string): VersionInfo => ({
  version,
  name: "guardian",
  databaseVersion: version,
  codeVersion: version,
  isVersionMismatch: false,
});

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
  info.mockResolvedValue(installed("1.3.5"));
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("useVersionInfo", () => {
  it("loads the installed version for a signed-in admin", async () => {
    const { result } = renderHookWithQuery(() => useVersionInfo());

    expect(result.current.versionInfo).toBeNull();
    await waitFor(() =>
      expect(result.current.versionInfo).toEqual(installed("1.3.5")),
    );
  });

  it.each([
    ["during setup", { setupRequired: true }],
    ["while auth is loading", { isLoading: true }],
    ["when signed out", { isAuthenticated: false }],
    ["for anyone but an admin", { user: null }],
  ])("loads nothing %s", (_label, overrides) => {
    auth = { ...auth, ...overrides };
    const { result } = renderHookWithQuery(() => useVersionInfo());

    expect(info).not.toHaveBeenCalled();
    expect(result.current.versionInfo).toBeNull();
  });

  it("loads once for every screen", async () => {
    const client = createQueryClient();
    renderHookWithQuery(() => useVersionInfo(), client);
    const second = renderHookWithQuery(() => useVersionInfo(), client);

    await waitFor(() =>
      expect(second.result.current.versionInfo).not.toBeNull(),
    );
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("logs a failed load and shows nothing", async () => {
    info.mockRejectedValue(new Error("down"));
    const { result } = renderHookWithQuery(() => useVersionInfo());

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Request failed:",
        queryKeys.version.info,
        expect.any(Error),
      ),
    );
    expect(result.current.versionInfo).toBeNull();
  });

  it("loads again on refresh", async () => {
    const { result } = renderHookWithQuery(() => useVersionInfo());
    await waitFor(() => expect(result.current.versionInfo).not.toBeNull());
    info.mockResolvedValue(installed("1.3.6"));

    await act(() => result.current.refreshVersionInfo());

    await waitFor(() =>
      expect(result.current.versionInfo?.version).toBe("1.3.6"),
    );
  });
});
