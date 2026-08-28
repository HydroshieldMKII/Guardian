import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";

const push = jest.fn();
const router = { push };
jest.mock("next/navigation", () => ({ useRouter: () => router }));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

jest.mock("@/components/ui/confirmation-modal", () => ({
  ConfirmationModal: ({
    isOpen,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>confirm-delete</span>
        <button onClick={() => onConfirm()}>yes delete</button>
        <button onClick={() => onClose()}>no delete</button>
      </div>
    ) : null,
}));

const session = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  contentTitle: "Arrival",
  contentType: "movie",
  year: 2016,
  startedAt: "2026-01-01T10:00:00Z",
  endedAt: "2026-01-01T11:00:00Z",
  terminated: false,
  deviceAddress: "192.168.1.10",
  product: "Plex for Roku",
  userDevice: {
    deviceName: "Living Room TV",
    deviceProduct: "Plex for Roku",
    devicePlatform: "Roku",
    deviceIdentifier: "device-1",
  },
  ...overrides,
});

const fetchMock = jest.fn();
let consoleError: jest.SpyInstance;

const renderModal = async (
  props: {
    userId?: string | null;
    isOpen?: boolean;
    onNavigateToDevice?: jest.Mock;
    scrollToSessionId?: number | null;
  } = {},
) => {
  const onClose = jest.fn();
  const view = render(
    <UserHistoryModal
      userId={props.userId === undefined ? "u-1" : props.userId}
      username="testuser"
      isOpen={props.isOpen ?? true}
      onClose={onClose}
      onNavigateToDevice={props.onNavigateToDevice}
      scrollToSessionId={props.scrollToSessionId}
    />,
  );
  await act(async () => {});
  return {
    ...view,
    onClose,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

const ok = (data: unknown) =>
  Promise.resolve({ ok: true, json: async () => data });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockImplementation(() => ok([session()]));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("UserHistoryModal loading", () => {
  it("fetches history when it opens", async () => {
    await renderModal();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/history/u-1"),
    );
    expect(screen.getAllByText("Arrival").length).toBeGreaterThan(0);
  });

  it("fetches nothing without a user", async () => {
    await renderModal({ userId: null });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a session that Guardian stopped differently from one that ended", async () => {
    fetchMock.mockImplementation(() =>
      ok([
        session({ id: 1, contentTitle: "Stopped", terminated: true }),
        session({ id: 2, contentTitle: "Finished", terminated: false }),
      ]),
    );

    await renderModal();

    expect(screen.getAllByText("Stopped").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Finished").length).toBeGreaterThan(0);
  });

  it("survives being asked to scroll to a session it never loaded", async () => {
    await renderModal({ scrollToSessionId: 4242 });

    expect(screen.getAllByText("Arrival").length).toBeGreaterThan(0);
  });

  it("fetches nothing while closed", async () => {
    await renderModal({ isOpen: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches nothing without a user", async () => {
    await renderModal({ userId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for the first page of the newest sessions", async () => {
    await renderModal();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=25");
    expect(url).toContain("offset=0");
    expect(url).toContain("includeActive=true");
  });

  it("keeps the order the server returned", async () => {
    fetchMock.mockImplementation(() =>
      ok([
        session({ id: 2, contentTitle: "Newer" }),
        session({ id: 1, contentTitle: "Older" }),
      ]),
    );
    await renderModal();

    const rows = document.querySelectorAll("[data-session-id]");
    expect(rows[0].getAttribute("data-session-id")).toBe("2");
  });

  it("shows a loader before the response arrives", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<UserHistoryModal userId="u-1" isOpen onClose={jest.fn()} />);

    expect(screen.getByText("Loading history...")).toBeInTheDocument();
  });

  it("reserves the same height for the loader and the empty state", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<UserHistoryModal userId="u-1" isOpen onClose={jest.fn()} />);

    const loader = screen.getByText("Loading history...").parentElement;
    expect(loader?.className).toContain("min-h-80");

    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => ({ sessions: [] }) }),
    );
    cleanup();
    await renderModal();

    expect(
      screen.getByText("This user has not streamed anything yet").parentElement
        ?.className,
    ).toContain("min-h-80");
  });

  it("empties the list on a failed response", async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false }));
    await renderModal();

    expect(
      screen.getByText("This user has not streamed anything yet"),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching user history:",
      expect.any(Error),
    );
  });

  it("empties the list on a thrown request", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await renderModal();

    expect(
      screen.getByText("This user has not streamed anything yet"),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching user history:",
      expect.any(Error),
    );
  });

  it("copes with a null payload", async () => {
    fetchMock.mockImplementation(() => ok(null));
    await renderModal();

    expect(
      screen.getByText("This user has not streamed anything yet"),
    ).toBeInTheDocument();
  });

  it("refreshes in the background without blanking the list", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(screen.queryByText("Loading history...")).toBeNull();
    expect(screen.getAllByText("Arrival").length).toBeGreaterThan(0);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("keeps a background refresh quiet when it fails", async () => {
    const { user } = await renderModal();
    fetchMock.mockRejectedValue(new Error("offline"));

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Error refreshing user history:",
        expect.any(Error),
      ),
    );
    expect(screen.getAllByText("Arrival").length).toBeGreaterThan(0);
  });

  it("closes from the footer", async () => {
    const { user, onClose } = await renderModal();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the active badge without a leading dot", async () => {
    fetchMock.mockImplementation(() => ok([session({ endedAt: null })]));
    await renderModal();

    const pill = screen
      .getAllByText("Active")
      .map((node) => node.closest("span.rounded-full"))
      .find(Boolean);

    expect(pill).toBeDefined();
    expect(pill?.querySelectorAll("span[aria-hidden]")).toHaveLength(0);
  });

  it("polls while a session is still active", async () => {
    fetchMock.mockImplementation(() => ok([session({ endedAt: null })]));
    jest.useFakeTimers();
    render(<UserHistoryModal userId="u-1" isOpen onClose={jest.fn()} />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not poll when every session has ended", async () => {
    jest.useFakeTimers();
    render(<UserHistoryModal userId="u-1" isOpen onClose={jest.fn()} />);
    await act(async () => {});

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("UserHistoryModal formatting", () => {
  const renderWith = async (overrides: Record<string, unknown>) => {
    fetchMock.mockImplementation(() => ok([session(overrides)]));
    return renderModal();
  };

  it("joins series, season and episode", async () => {
    await renderWith({
      contentType: "episode",
      grandparentTitle: "Severance",
      parentTitle: "Season 1",
      contentTitle: "Good News",
    });
    expect(
      screen.getAllByText("Severance - Season 1: Good News").length,
    ).toBeGreaterThan(0);
  });

  it("uses the season alone when there is no episode title", async () => {
    await renderWith({
      contentType: "episode",
      grandparentTitle: "Severance",
      parentTitle: "Season 1",
      contentTitle: null,
    });
    expect(screen.getAllByText("Severance - Season 1").length).toBeGreaterThan(
      0,
    );
  });

  it("uses the episode alone when there is no season", async () => {
    await renderWith({
      contentType: "episode",
      grandparentTitle: "Severance",
      parentTitle: null,
      contentTitle: "Good News",
    });
    expect(screen.getAllByText("Severance - Good News").length).toBeGreaterThan(
      0,
    );
  });

  it("uses the series alone when there is nothing else", async () => {
    await renderWith({
      contentType: "episode",
      grandparentTitle: "Severance",
      parentTitle: null,
      contentTitle: null,
    });
    expect(screen.getAllByText("Severance").length).toBeGreaterThan(0);
  });

  it("falls back for untitled content", async () => {
    await renderWith({ contentTitle: null });
    expect(screen.getAllByText("Unknown Title").length).toBeGreaterThan(0);
  });

  it("shows artist and year for a track", async () => {
    await renderWith({
      contentType: "track",
      grandparentTitle: "Boards of Canada",
      year: 1998,
    });
    expect(
      screen.getAllByText("Boards of Canada • 1998").length,
    ).toBeGreaterThan(0);
  });

  it("shows the artist alone when there is no year", async () => {
    await renderWith({
      contentType: "track",
      grandparentTitle: "Boards of Canada",
      year: null,
    });
    expect(screen.getAllByText("Boards of Canada").length).toBeGreaterThan(0);
  });

  it("shows the year alone for other content", async () => {
    await renderWith({ year: 2016 });
    expect(screen.getAllByText("2016").length).toBeGreaterThan(0);
  });

  it("shows no subtitle when there is no year", async () => {
    await renderWith({ year: null, contentType: "movie" });
    expect(screen.getAllByText("Arrival").length).toBeGreaterThan(0);
  });

  it("copes with a session that has no recorded address", async () => {
    fetchMock.mockImplementation(() => ok([session({ deviceAddress: null })]));
    const { user } = await renderModal();

    await user.type(
      screen.getByPlaceholderText(/Search by title, device or IP/),
      "Arrival",
    );

    expect(
      document.querySelectorAll("[data-session-id]").length,
    ).toBeGreaterThan(0);
  });

  it("falls back to the device product when there is no name", async () => {
    await renderWith({
      userDevice: { deviceProduct: "Plex for Roku", deviceIdentifier: "d" },
    });
    expect(screen.getAllByText("Plex for Roku").length).toBeGreaterThan(0);
  });

  it("falls back again when there is no device at all", async () => {
    await renderWith({ userDevice: null });
    expect(screen.getAllByText("Unknown Device").length).toBeGreaterThan(0);
  });

  it("labels PlexAmp separately", async () => {
    await renderWith({ product: "plexamp" });
    expect(screen.getAllByText("Plexamp").length).toBeGreaterThan(0);
  });

  it("labels anything else as Plex", async () => {
    await renderWith({ product: "Plex for Roku" });
    expect(screen.getAllByText("Plex").length).toBeGreaterThan(0);
  });

  it("reads the product off the device when the session has none", async () => {
    await renderWith({ product: null });
    expect(screen.getAllByText("Plex").length).toBeGreaterThan(0);
  });

  it("says unknown with no product anywhere", async () => {
    await renderWith({ product: null, userDevice: { deviceName: "TV" } });
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });

  it.each([
    ["2026-01-01T10:00:00Z", "2026-01-01T10:00:45Z", "45 seconds"],
    [
      "2026-01-01T10:00:00Z",
      "2026-01-01T10:02:30Z",
      "2 minutes and 30 seconds",
    ],
    ["2026-01-01T10:00:00Z", "2026-01-01T11:01:05Z", "1 hour and 1 minute"],
  ])(
    "formats a %p - %p session as %p",
    async (startedAt, endedAt, expected) => {
      await renderWith({ startedAt, endedAt });
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    },
  );

  it("says unknown when the clock runs backwards", async () => {
    await renderWith({
      startedAt: "2026-01-01T11:00:00Z",
      endedAt: "2026-01-01T10:00:00Z",
    });
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });

  it("measures an active session up to now", async () => {
    await renderWith({
      endedAt: null,
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    });
    expect(screen.getAllByText(/^5 minutes/).length).toBeGreaterThan(0);
  });
});

describe("UserHistoryModal filtering", () => {
  const lastUrl = () =>
    fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;

  it("asks the server for the search term once typing settles", async () => {
    const { user } = await renderModal();

    await user.type(
      screen.getByPlaceholderText(/Search by title, device or IP/),
      "Severance",
    );

    await waitFor(() => expect(lastUrl()).toContain("search=Severance"));
    expect(lastUrl()).toContain("offset=0");
  });

  it("says when nothing matches", async () => {
    const { user } = await renderModal();
    fetchMock.mockImplementation(() => ok([]));

    await user.type(
      screen.getByPlaceholderText(/Search by title, device or IP/),
      "zzz",
    );

    expect(
      await screen.findByText("No streams match your search"),
    ).toBeInTheDocument();
  });

  it("asks the server for terminated sessions only", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(lastUrl()).toContain("terminatedOnly=true"));
  });

  it("leaves the filters out of the request by default", async () => {
    await renderModal();

    expect(lastUrl()).not.toContain("search=");
    expect(lastUrl()).not.toContain("terminatedOnly=");
  });
});

describe("UserHistoryModal searching", () => {
  const search = async (
    user: ReturnType<typeof userEvent.setup>,
    term: string,
  ) => {
    let release: (value: unknown) => void = () => {};
    const before = fetchMock.mock.calls.length;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    await user.type(
      screen.getByPlaceholderText(/Search by title, device or IP/),
      term,
    );
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before),
    );

    return async (results: unknown[]) => {
      await act(async () => {
        release({ ok: true, json: async () => results });
      });
    };
  };

  it("leaves the sessions already on screen in place", async () => {
    const { user } = await renderModal();

    await search(user, "Arr");

    expect(screen.getByText(/Arrival/)).toBeInTheDocument();
    expect(screen.queryByText("Loading history...")).toBeNull();
  });

  it("leaves the session count in place", async () => {
    const { user } = await renderModal();

    await search(user, "Arr");

    expect(
      screen.getByText(/Showing 1 session matching your filters/),
    ).toBeInTheDocument();
  });

  it("shows no spinner at all while a search is in flight", async () => {
    const { user, container } = await renderModal();

    await search(user, "Arr");

    expect(container.querySelectorAll(".animate-spin")).toHaveLength(0);
  });

  it("leaves the empty card quiet when a search comes back with nothing", async () => {
    const { user, container } = await renderModal();

    const settle = await search(user, "zzz");
    await settle([]);
    await search(user, "z");

    expect(
      screen.getByText("No streams match your search"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-spin")).toHaveLength(0);
  });

  it("still shows the full loader on the very first open", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));

    render(
      <UserHistoryModal
        userId="u-1"
        username="testuser"
        isOpen
        onClose={jest.fn()}
      />,
    );

    expect(await screen.findByText("Loading history...")).toBeInTheDocument();
  });

  it("shows the full loader again after the modal is closed and reopened", async () => {
    const { rerender } = await renderModal();

    rerender(
      <UserHistoryModal
        userId="u-1"
        username="testuser"
        isOpen={false}
        onClose={jest.fn()}
      />,
    );

    fetchMock.mockImplementation(() => new Promise(() => {}));
    rerender(
      <UserHistoryModal
        userId="u-1"
        username="testuser"
        isOpen
        onClose={jest.fn()}
      />,
    );

    expect(await screen.findByText("Loading history...")).toBeInTheDocument();
  });
});

describe("UserHistoryModal paging", () => {
  const fullPage = () =>
    Array.from({ length: 25 }, (_, index) =>
      session({ id: index + 1, contentTitle: `Session ${index + 1}` }),
    );

  it("offers to load older sessions when a full page comes back", async () => {
    fetchMock.mockImplementation(() => ok(fullPage()));
    await renderModal();

    expect(
      screen.getByRole("button", { name: "Load older sessions" }),
    ).toBeInTheDocument();
  });

  it("stops offering more once a short page comes back", async () => {
    await renderModal();

    expect(
      screen.queryByRole("button", { name: "Load older sessions" }),
    ).toBeNull();
  });

  it("appends the next page from the loaded offset", async () => {
    fetchMock.mockImplementationOnce(() => ok(fullPage()));
    fetchMock.mockImplementationOnce(() =>
      ok([session({ id: 99, contentTitle: "Much Older" })]),
    );
    const { user } = await renderModal();

    await user.click(
      screen.getByRole("button", { name: "Load older sessions" }),
    );

    expect(await screen.findByText("Much Older")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toContain("offset=25");
    expect(document.querySelectorAll("[data-session-id]")).toHaveLength(26);
    expect(
      screen.queryByRole("button", { name: "Load older sessions" }),
    ).toBeNull();
  });

  it("ignores rows the next page repeats", async () => {
    fetchMock.mockImplementationOnce(() => ok(fullPage()));
    fetchMock.mockImplementationOnce(() => ok([session({ id: 1 })]));
    const { user } = await renderModal();

    await user.click(
      screen.getByRole("button", { name: "Load older sessions" }),
    );

    await waitFor(() =>
      expect(document.querySelectorAll("[data-session-id]")).toHaveLength(25),
    );
  });

  it("stops offering more when the next page fails", async () => {
    fetchMock.mockImplementationOnce(() => ok(fullPage()));
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new Error("offline")),
    );
    const { user } = await renderModal();

    await user.click(
      screen.getByRole("button", { name: "Load older sessions" }),
    );

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading more user history:",
        expect.any(Error),
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Load older sessions" }),
    ).toBeNull();
  });

  it("loads the next page when the trigger scrolls into view", async () => {
    class TestIntersectionObserver implements IntersectionObserver {
      static callbacks: IntersectionObserverCallback[] = [];
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];
      constructor(callback: IntersectionObserverCallback) {
        TestIntersectionObserver.callbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    const original = global.IntersectionObserver;
    global.IntersectionObserver = TestIntersectionObserver;

    fetchMock.mockImplementationOnce(() => ok(fullPage()));
    fetchMock.mockImplementationOnce(() =>
      ok([session({ id: 99, contentTitle: "Much Older" })]),
    );
    await renderModal();

    const observer = new TestIntersectionObserver(() => {});
    const callback =
      TestIntersectionObserver.callbacks[
        TestIntersectionObserver.callbacks.length - 2
      ];
    await act(async () => {
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer,
      );
    });

    expect(await screen.findByText("Much Older")).toBeInTheDocument();
    global.IntersectionObserver = original;
  });

  it("stays put while the trigger is out of view", async () => {
    class TestIntersectionObserver implements IntersectionObserver {
      static callbacks: IntersectionObserverCallback[] = [];
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];
      constructor(callback: IntersectionObserverCallback) {
        TestIntersectionObserver.callbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    const original = global.IntersectionObserver;
    global.IntersectionObserver = TestIntersectionObserver;

    fetchMock.mockImplementationOnce(() => ok(fullPage()));
    await renderModal();
    const callsBefore = fetchMock.mock.calls.length;

    const observer = new TestIntersectionObserver(() => {});
    const callback =
      TestIntersectionObserver.callbacks[
        TestIntersectionObserver.callbacks.length - 2
      ];
    await act(async () => {
      callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer,
      );
    });

    expect(fetchMock.mock.calls).toHaveLength(callsBefore);
    global.IntersectionObserver = original;
  });

  it("refreshes every page it has already loaded", async () => {
    fetchMock.mockImplementationOnce(() => ok(fullPage()));
    fetchMock.mockImplementationOnce(() =>
      ok([session({ id: 99, contentTitle: "Much Older" })]),
    );
    const { user } = await renderModal();
    await user.click(
      screen.getByRole("button", { name: "Load older sessions" }),
    );
    await screen.findByText("Much Older");

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() =>
      expect(fetchMock.mock.calls[2][0]).toContain("limit=26"),
    );
  });
});

describe("UserHistoryModal navigation", () => {
  it("prefers the supplied callback", async () => {
    const onNavigateToDevice = jest.fn();
    const { user, onClose } = await renderModal({ onNavigateToDevice });

    await user.click(screen.getAllByTitle("Go to this device")[0]);

    expect(onClose).toHaveBeenCalled();
    expect(onNavigateToDevice).toHaveBeenCalledWith("u-1", "device-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("routes with query parameters when there is no callback", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Go to this device")[0]);

    expect(push).toHaveBeenCalledWith("/?userId=u-1&deviceId=device-1");
  });

  it("only closes when the device cannot be identified", async () => {
    fetchMock.mockImplementation(() => ok([session({ userDevice: null })]));
    const { user, onClose } = await renderModal();

    await user.click(screen.getAllByTitle("Go to this device")[0]);

    expect(onClose).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("UserHistoryModal deletion", () => {
  it("removes a session after confirmation", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete this entry")[0]);
    expect(screen.getByText("confirm-delete")).toBeInTheDocument();

    await user.click(screen.getByText("yes delete"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/history/1"),
        { method: "DELETE" },
      ),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Session Deleted" }),
    );
    expect(
      screen.getByText("This user has not streamed anything yet"),
    ).toBeInTheDocument();
  });

  it("reports a refusal from the server", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Promise.resolve({ ok: false })
        : ok([session()]),
    );
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete this entry")[0]);
    await user.click(screen.getByText("yes delete"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Delete Failed" }),
      ),
    );
  });

  it("reports a thrown failure", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Promise.reject(new Error("offline"))
        : ok([session()]),
    );
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete this entry")[0]);
    await user.click(screen.getByText("yes delete"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Delete Failed" }),
      ),
    );
  });

  it("also deletes from the mobile row", async () => {
    const { user } = await renderModal();
    const buttons = screen.getAllByTitle("Delete this entry");

    await user.click(buttons[buttons.length - 1]);
    await user.click(screen.getByText("yes delete"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/history/1"),
        { method: "DELETE" },
      ),
    );
  });

  it("hides the delete control for a session still running", async () => {
    fetchMock.mockImplementation(() => ok([session({ endedAt: null })]));
    await renderModal();

    expect(screen.queryByTitle("Delete this entry")).toBeNull();
  });

  it("can be cancelled", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete this entry")[0]);
    await user.click(screen.getByText("no delete"));

    expect(screen.queryByText("confirm-delete")).toBeNull();
    expect(screen.getAllByText("Arrival").length).toBeGreaterThan(0);
  });
});

describe("UserHistoryModal deep link", () => {
  it("scrolls to and highlights the named session", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await renderModal({ scrollToSessionId: 1 });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("does nothing when the session is not in the list", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await renderModal({ scrollToSessionId: 999 });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("pages further back looking for a session it has not loaded", async () => {
    fetchMock.mockImplementation(() =>
      ok(
        Array.from({ length: 25 }, (_, index) =>
          session({ id: index + 1, contentTitle: `Session ${index + 1}` }),
        ),
      ),
    );

    await renderModal({ scrollToSessionId: 999 });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    expect(fetchMock.mock.calls[1][0]).toContain("offset=25");
  });

  it("clears the highlight it added", async () => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
    render(
      <UserHistoryModal
        userId="u-1"
        isOpen
        onClose={jest.fn()}
        scrollToSessionId={1}
      />,
    );
    await act(async () => {});

    const card = document.querySelector('[data-session-id="1"]') as HTMLElement;
    expect(card.className).toContain("ring-2");

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(card.className).not.toContain("ring-2");
  });

  it("scrolls once, not on every background refresh", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    fetchMock.mockImplementation(() => ok([session({ endedAt: null })]));

    const { user } = await renderModal({ scrollToSessionId: 1 });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a target", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await renderModal({ scrollToSessionId: null });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("UserHistoryModal duration reporting", () => {
  const renderOne = async (overrides: Record<string, unknown>) => {
    fetchMock.mockImplementation(() => ok([session(overrides)]));
    return renderModal();
  };

  it("reports how long the session ran, not the playback position", async () => {
    await renderOne({
      startedAt: "2026-08-26T01:44:00.000Z",
      endedAt: "2026-08-26T01:45:09.000Z",
      duration: 1_446_000,
      viewOffset: 1_446_000,
    });

    expect(
      await screen.findAllByText("1 minute and 9 seconds"),
    ).not.toHaveLength(0);
    expect(screen.queryByText("24m 6s")).toBeNull();
  });

  it("ignores a playback position left over from a resumed stream", async () => {
    await renderOne({
      startedAt: "2026-08-26T12:26:00.000Z",
      endedAt: "2026-08-26T12:36:20.000Z",
      viewOffset: 30_000,
    });

    expect(
      await screen.findAllByText("10 minutes and 20 seconds"),
    ).not.toHaveLength(0);
  });

  it("keeps Unknown for an end that precedes the start", async () => {
    await renderOne({
      startedAt: "2026-08-26T12:26:00.000Z",
      endedAt: "2026-08-26T01:00:00.000Z",
    });

    expect(await screen.findAllByText("Unknown")).not.toHaveLength(0);
  });

  it("keeps Unknown for an unparseable timestamp", async () => {
    await renderOne({ startedAt: "not a date", endedAt: null });

    expect(await screen.findAllByText("Unknown")).not.toHaveLength(0);
  });
});
