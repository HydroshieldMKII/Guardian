import { act, waitFor } from "@testing-library/react";
import type { InfiniteData } from "@tanstack/react-query";
import { renderHookWithQuery } from "@/test-utils/query";
import { useSessionHistory } from "@/hooks/device-management/useSessionHistory";
import type { SessionHistoryEntry } from "@/lib/session-history";
import {
  sessionHistoryApi,
  type SessionHistoryFilter,
} from "@/lib/session-history-api";

jest.mock("@/lib/session-history-api", () => ({
  sessionHistoryApi: { page: jest.fn(), remove: jest.fn() },
}));

const page = jest.mocked(sessionHistoryApi.page);

const session = (id: number, active = false) =>
  ({
    id,
    sessionKey: `key-${id}`,
    userId: "u-1",
    startedAt: "2026-01-01",
    endedAt: active ? undefined : "2026-01-01",
  }) satisfies SessionHistoryEntry;

const sessions = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => session(from + index));

const defaults: SessionHistoryFilter = {
  search: "",
  terminatedOnly: false,
  app: "all",
};

const setup = (
  props: {
    userId?: string | null;
    filter?: SessionHistoryFilter;
    enabled?: boolean;
  } = {},
) => {
  let current = {
    userId: "u-1" as string | null,
    filter: defaults,
    enabled: true,
    ...props,
  };
  const view = renderHookWithQuery(() =>
    useSessionHistory(current.userId, current.filter, current.enabled),
  );
  const update = (next: Partial<typeof current>) => {
    current = { ...current, ...next };
    view.rerender();
  };
  return { ...view, update };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  page.mockResolvedValue([session(1)]);
});

describe("useSessionHistory", () => {
  it("loads the first page for the user and filter", async () => {
    const { result } = setup();

    expect(result.current.firstLoad).toBe(true);
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.firstLoad).toBe(false);
    expect(page).toHaveBeenCalledWith("u-1", defaults, 0, 25);
    expect(result.current.hasMore).toBe(false);
  });

  it.each([
    ["without a user", { userId: null }],
    ["while closed", { enabled: false }],
  ])("stays idle %s", async (_, props) => {
    const { result } = setup(props);

    await act(async () => {});
    expect(page).not.toHaveBeenCalled();
    expect(result.current.firstLoad).toBe(false);
  });

  it("continues from the number of distinct sessions it holds", async () => {
    page
      .mockResolvedValueOnce(sessions(1, 25))
      .mockResolvedValueOnce([session(25), session(26)]);
    const { result } = setup();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.sessions).toHaveLength(26));
    expect(page).toHaveBeenLastCalledWith("u-1", defaults, 25, 25);
    expect(result.current.hasMore).toBe(false);
  });

  it("ignores more requests while a page is on its way", async () => {
    page.mockResolvedValueOnce(sessions(1, 25));
    const { result } = setup();
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    page.mockReturnValue(new Promise(() => {}));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));
    act(() => result.current.loadMore());

    expect(page).toHaveBeenCalledTimes(2);
  });

  it("stops offering more after a failed page", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    page
      .mockResolvedValueOnce(sessions(1, 25))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.sessions).toHaveLength(25);
    jest.mocked(console.error).mockRestore();
  });

  it("keeps the previous list while a new filter loads, and loads no more meanwhile", async () => {
    page.mockResolvedValueOnce(sessions(1, 25));
    const { result, update } = setup();
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    page.mockReturnValue(new Promise(() => {}));

    update({ filter: { ...defaults, search: "arrival" } });
    await waitFor(() => expect(result.current.switching).toBe(true));
    act(() => result.current.loadMore());

    expect(result.current.sessions).toHaveLength(25);
    expect(page).toHaveBeenCalledTimes(2);
    expect(page).toHaveBeenLastCalledWith(
      "u-1",
      { ...defaults, search: "arrival" },
      0,
      25,
    );
  });

  it("shows the refresh indicator only for a manual refresh", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    let finish: (value: SessionHistoryEntry[]) => void = () => {};
    page.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    let refreshing: Promise<void> = Promise.resolve();
    act(() => {
      refreshing = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      finish([session(1), session(2)]);
      await refreshing;
    });
    expect(result.current.refreshing).toBe(false);
    expect(result.current.sessions).toHaveLength(2);
  });

  it("polls only while a session is still running", async () => {
    jest.useFakeTimers();
    page.mockResolvedValue([session(1, true)]);
    const { result } = setup();
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(result.current.sessions).toHaveLength(1);

    page.mockResolvedValue([session(1)]);
    await act(() => jest.advanceTimersByTimeAsync(10000));
    expect(page).toHaveBeenCalledTimes(2);

    await act(() => jest.advanceTimersByTimeAsync(30000));
    expect(page).toHaveBeenCalledTimes(2);
  });

  it("drops a deleted session from every cached filter", async () => {
    page.mockResolvedValue([session(1), session(2)]);
    const searched = { ...defaults, search: "key" };
    const { result, client, update } = setup({ filter: searched });
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    update({ filter: defaults });
    await waitFor(() => expect(result.current.switching).toBe(false));

    act(() => result.current.removeSession(1));

    await waitFor(() =>
      expect(result.current.sessions.map((entry) => entry.id)).toEqual([2]),
    );
    const cachedIds = client
      .getQueriesData<InfiniteData<SessionHistoryEntry[]>>({
        queryKey: ["sessionHistory"],
      })
      .map(([, data]) => data?.pages.flat().map((entry) => entry.id));
    expect(cachedIds).toEqual([[2], [2]]);
  });
});
