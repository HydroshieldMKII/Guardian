import { act, waitFor } from "@testing-library/react";
import {
  UPDATE_CHECK_COOLDOWN_MS,
  UPDATE_CHECK_INTERVAL_MS,
  useUpdateCheck,
} from "@/hooks/useUpdateCheck";
import type { LatestRelease } from "@/lib/version";
import { renderHookWithQuery } from "@/test-utils/query";

const latestRelease = jest.fn<Promise<LatestRelease>, []>();
jest.mock("@/lib/version-api", () => ({
  versionApi: { latestRelease: () => latestRelease() },
}));

let installedVersion: string | undefined;
jest.mock("@/hooks/useVersionInfo", () => ({
  useVersionInfo: () => ({
    versionInfo: installedVersion ? { version: installedVersion } : null,
  }),
}));

let autoCheck: string | null;
jest.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    getSetting: (key: string) =>
      key === "AUTO_CHECK_UPDATES" ? autoCheck : null,
  }),
}));

const release = (version: string): LatestRelease => ({
  version,
  url: `https://example.test/v${version}`,
  notes: "Fixes",
});

const flush = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  installedVersion = "1.3.5";
  autoCheck = "true";
  latestRelease.mockResolvedValue(release("2.0.0"));
});

afterEach(() => {
  consoleError.mockRestore();
  jest.useRealTimers();
});

describe("checking automatically", () => {
  it("reports an available update", async () => {
    const { result } = renderHookWithQuery(() => useUpdateCheck());

    await waitFor(() =>
      expect(result.current.updateInfo).toEqual({
        hasUpdate: true,
        latestVersion: "2.0.0",
        currentVersion: "1.3.5",
        updateUrl: "https://example.test/v2.0.0",
        releaseNotes: "Fixes",
      }),
    );
  });

  it("reports being up to date", async () => {
    latestRelease.mockResolvedValue(release("1.3.5"));
    const { result } = renderHookWithQuery(() => useUpdateCheck());

    await waitFor(() =>
      expect(result.current.updateInfo?.hasUpdate).toBe(false),
    );
  });

  it.each([
    ["the setting is off", "false", "1.3.5"],
    ["the setting is missing", null, "1.3.5"],
    ["the version is unknown", "true", undefined],
  ])("does nothing while %s", (_label, setting, version) => {
    autoCheck = setting;
    installedVersion = version;
    const { result } = renderHookWithQuery(() => useUpdateCheck());

    expect(latestRelease).not.toHaveBeenCalled();
    expect(result.current.updateInfo).toBeNull();
  });

  it("checks again periodically", async () => {
    jest.useFakeTimers();
    renderHookWithQuery(() => useUpdateCheck());
    await flush();
    expect(latestRelease).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    });

    expect(latestRelease).toHaveBeenCalledTimes(2);
  });

  it("shares a recent check between screens", async () => {
    jest.useFakeTimers();
    const first = renderHookWithQuery(() => useUpdateCheck());
    await flush();

    renderHookWithQuery(() => useUpdateCheck(), first.client);
    await flush();
    expect(latestRelease).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(UPDATE_CHECK_COOLDOWN_MS + 1);
    });
    renderHookWithQuery(() => useUpdateCheck(), first.client);
    await flush();
    expect(latestRelease).toHaveBeenCalledTimes(2);
  });
});

describe("checking manually", () => {
  it("checks even with automatic checks off and shares the result", async () => {
    autoCheck = "false";
    latestRelease.mockResolvedValue(release("1.4.0"));
    const { result } = renderHookWithQuery(() => useUpdateCheck());

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > = null;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome).toEqual(
      expect.objectContaining({ hasUpdate: true, latestVersion: "1.4.0" }),
    );
    await waitFor(() =>
      expect(result.current.updateInfo?.latestVersion).toBe("1.4.0"),
    );
  });

  it("asks GitHub again even right after a check", async () => {
    const { result } = renderHookWithQuery(() => useUpdateCheck());
    await waitFor(() => expect(result.current.updateInfo).not.toBeNull());

    await act(() => result.current.checkForUpdatesManually());

    expect(latestRelease).toHaveBeenCalledTimes(2);
  });

  it("returns nothing before the version is known", async () => {
    installedVersion = undefined;
    const { result } = renderHookWithQuery(() => useUpdateCheck());

    await expect(result.current.checkForUpdatesManually()).resolves.toBeNull();
    expect(latestRelease).not.toHaveBeenCalled();
  });

  it("returns nothing when GitHub fails", async () => {
    autoCheck = "false";
    latestRelease.mockRejectedValue(new Error("rate limited"));
    const { result } = renderHookWithQuery(() => useUpdateCheck());

    let outcome: Awaited<
      ReturnType<typeof result.current.checkForUpdatesManually>
    > = null;
    await act(async () => {
      outcome = await result.current.checkForUpdatesManually();
    });

    expect(outcome).toBeNull();
  });
});
