import { act, render, screen, waitFor, within } from "@testing-library/react";
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

  it("fetches nothing while closed", async () => {
    await renderModal({ isOpen: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches nothing without a user", async () => {
    await renderModal({ userId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sorts newest first", async () => {
    fetchMock.mockImplementation(() =>
      ok([
        session({
          id: 1,
          contentTitle: "Older",
          startedAt: "2026-01-01T00:00:00Z",
        }),
        session({
          id: 2,
          contentTitle: "Newer",
          startedAt: "2026-02-01T00:00:00Z",
        }),
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

  it("empties the list on a failed response", async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false }));
    await renderModal();

    expect(screen.getByText("No streaming history found")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Failed to fetch user history");
  });

  it("empties the list on a thrown request", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await renderModal();

    expect(screen.getByText("No streaming history found")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching user history:",
      expect.any(Error),
    );
  });

  it("copes with a null payload", async () => {
    fetchMock.mockImplementation(() => ok(null));
    await renderModal();

    expect(screen.getByText("No streaming history found")).toBeInTheDocument();
  });

  it("refreshes on demand", async () => {
    const { user } = await renderModal();

    await user.click(
      document.querySelector("button .lucide-refresh-cw")
        ?.parentElement as HTMLElement,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
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
      screen.getByPlaceholderText(/Search by title, device, or IP/),
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
    expect(screen.getAllByText("Plex Amp").length).toBeGreaterThan(0);
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
    ["2026-01-01T10:00:00Z", "2026-01-01T10:00:45Z", "45s"],
    ["2026-01-01T10:00:00Z", "2026-01-01T10:02:30Z", "2m 30s"],
    ["2026-01-01T10:00:00Z", "2026-01-01T11:01:05Z", "1h 1m 5s"],
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
    await renderWith({ endedAt: null, startedAt: new Date().toISOString() });
    expect(screen.getAllByText(/\d+s/).length).toBeGreaterThan(0);
  });
});

describe("UserHistoryModal filtering", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(() =>
      ok([
        session({ id: 1, contentTitle: "Arrival", terminated: false }),
        session({
          id: 2,
          contentTitle: "Severance",
          terminated: true,
          deviceAddress: "10.0.0.9",
          userDevice: {
            deviceName: "Bedroom",
            deviceIdentifier: "device-2",
          },
        }),
      ]),
    );
  });

  it.each([
    ["Severance", "2"],
    ["Bedroom", "2"],
    ["10.0.0.9", "2"],
    ["Arrival", "1"],
  ])("matches %p", async (term, expectedId) => {
    const { user } = await renderModal();

    await user.type(
      screen.getByPlaceholderText(/Search by title, device, or IP/),
      term,
    );

    const rows = document.querySelectorAll("[data-session-id]");
    expect(
      Array.from(rows).every(
        (r) => r.getAttribute("data-session-id") === expectedId,
      ),
    ).toBe(true);
  });

  it("says when nothing matches", async () => {
    const { user } = await renderModal();

    await user.type(
      screen.getByPlaceholderText(/Search by title, device, or IP/),
      "zzz",
    );

    expect(
      screen.getByText("No sessions found matching your filters"),
    ).toBeInTheDocument();
  });

  it("filters to terminated sessions only", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("switch"));

    const rows = document.querySelectorAll("[data-session-id]");
    expect(
      Array.from(rows).every((r) => r.getAttribute("data-session-id") === "2"),
    ).toBe(true);
  });
});

describe("UserHistoryModal navigation", () => {
  it("prefers the supplied callback", async () => {
    const onNavigateToDevice = jest.fn();
    const { user, onClose } = await renderModal({ onNavigateToDevice });

    await user.click(screen.getAllByTitle("Scroll to Device")[0]);

    expect(onClose).toHaveBeenCalled();
    expect(onNavigateToDevice).toHaveBeenCalledWith("u-1", "device-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("routes with query parameters when there is no callback", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Scroll to Device")[0]);

    expect(push).toHaveBeenCalledWith("/?userId=u-1&deviceId=device-1");
  });

  it("only closes when the device cannot be identified", async () => {
    fetchMock.mockImplementation(() => ok([session({ userDevice: null })]));
    const { user, onClose } = await renderModal();

    await user.click(screen.getAllByTitle("Scroll to Device")[0]);

    expect(onClose).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("UserHistoryModal deletion", () => {
  it("removes a session after confirmation", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete Session")[0]);
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
    expect(screen.getByText("No streaming history found")).toBeInTheDocument();
  });

  it("reports a refusal from the server", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Promise.resolve({ ok: false })
        : ok([session()]),
    );
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete Session")[0]);
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

    await user.click(screen.getAllByTitle("Delete Session")[0]);
    await user.click(screen.getByText("yes delete"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Delete Failed" }),
      ),
    );
  });

  it("also deletes from the mobile row", async () => {
    const { user } = await renderModal();
    const buttons = screen.getAllByTitle("Delete Session");

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

    expect(screen.queryByTitle("Delete Session")).toBeNull();
  });

  it("can be cancelled", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByTitle("Delete Session")[0]);
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

  it("does nothing without a target", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await renderModal({ scrollToSessionId: null });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
