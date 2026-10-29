import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlexSession, StreamsResponse } from "@/types";
import StreamsList from "@/components/streams-list";

const fetchStreamsData = jest.fn();
const updateStreamsFromProps = jest.fn();
const revokeDeviceAuthorization = jest.fn();
const setRevokingAuth = jest.fn();

let streams: PlexSession[] = [];
let error: string | null = null;
let revokingAuth: string | null = null;

jest.mock("@/hooks/useStreams", () => ({
  useStreamsData: () => ({
    streams,
    loading: false,
    error,
    fetchStreamsData,
    updateStreamsFromProps,
  }),
  useStreamActions: () => ({
    revokingAuth,
    revokeDeviceAuthorization,
    setRevokingAuth,
  }),
}));

let swipeRefresh: (() => void) | undefined;
jest.mock("@/hooks/useSwipeToRefresh", () => ({
  useSwipeToRefresh: ({ onRefresh }: { onRefresh: () => void }) => {
    swipeRefresh = onRefresh;
    return { "data-swipe": "true" };
  },
}));

jest.mock("@/components/streams", () => ({
  StreamCard: ({
    stream,
    isExpanded,
    isRevoking,
    onToggleExpand,
    onRemoveAccess,
  }: {
    stream: PlexSession;
    isExpanded: boolean;
    isRevoking: boolean;
    onToggleExpand: () => void;
    onRemoveAccess: () => void;
  }) => (
    <div>
      <span>{`card:${stream.sessionKey}`}</span>
      <span>{`expanded:${isExpanded}`}</span>
      <span>{`revoking:${isRevoking}`}</span>
      <button onClick={onToggleExpand}>{`toggle ${stream.sessionKey}`}</button>
      <button onClick={onRemoveAccess}>{`remove ${stream.sessionKey}`}</button>
    </div>
  ),
  RemoveAccessModal: ({
    stream,
    isRemoving,
    onConfirm,
    onCancel,
  }: {
    stream: PlexSession | null;
    isRemoving: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    stream ? (
      <div>
        <span>{`confirm:${stream.sessionKey}:${isRemoving}`}</span>
        <button onClick={onConfirm}>confirm remove</button>
        <button onClick={onCancel}>cancel remove</button>
      </div>
    ) : null,
  getContentTitle: (session: { title?: string }) => session.title ?? "",
  getDeviceIcon: () => null,
}));

const session = (overrides: Partial<PlexSession> = {}): PlexSession => ({
  sessionKey: "s-1",
  title: "Arrival",
  grandparentTitle: "",
  User: { title: "alice" },
  Player: { title: "Living Room TV", platform: "Roku", product: "Plex" },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  streams = [];
  error = null;
  revokingAuth = null;
  revokeDeviceAuthorization.mockResolvedValue(true);
});

describe("StreamsList", () => {
  describe("layout", () => {
    const keysIn = (column: HTMLElement) =>
      Array.from(column.querySelectorAll("span"))
        .map((span) => span.textContent)
        .filter((text) => text?.startsWith("card:"));

    const withWidth = (width: number) => {
      const original = window.innerWidth;
      window.innerWidth = width;
      return () => {
        window.innerWidth = original;
      };
    };

    beforeEach(() => {
      streams = ["a", "b", "c", "d", "e"].map((key) =>
        session({ sessionKey: key }),
      );
    });

    it("splits wide screens into two columns that grow on their own", () => {
      const restore = withWidth(1440);
      render(<StreamsList />);

      const [left, right] = screen.getAllByTestId("stream-column");
      expect(keysIn(left)).toEqual(["card:a", "card:c", "card:e"]);
      expect(keysIn(right)).toEqual(["card:b", "card:d"]);
      restore();
    });

    it("keeps cards in their column when a stream ends or starts", () => {
      const restore = withWidth(1440);
      const { rerender } = render(<StreamsList />);

      streams = ["b", "c", "d", "e", "f"].map((key) =>
        session({ sessionKey: key }),
      );
      rerender(<StreamsList />);

      const [left, right] = screen.getAllByTestId("stream-column");
      expect(keysIn(left)).toEqual(["card:c", "card:e", "card:f"]);
      expect(keysIn(right)).toEqual(["card:b", "card:d"]);
      restore();
    });

    it("keeps the open card in place when the columns rebalance", async () => {
      const restore = withWidth(1440);
      const { rerender } = render(<StreamsList />);
      await userEvent.click(screen.getByRole("button", { name: "toggle e" }));

      streams = ["a", "c", "e"].map((key) => session({ sessionKey: key }));
      rerender(<StreamsList />);

      const [left, right] = screen.getAllByTestId("stream-column");
      expect(keysIn(left)).toEqual(["card:a", "card:e"]);
      expect(keysIn(right)).toEqual(["card:c"]);
      restore();
    });

    it("spreads search results across both columns", async () => {
      const restore = withWidth(1440);
      streams = ["a", "b", "c", "d"].map((key) =>
        session({ sessionKey: key, title: key === "b" ? "Other" : "Match" }),
      );
      render(<StreamsList />);

      await userEvent.type(
        screen.getByRole("searchbox", {
          name: "Search by user, device, title or app",
        }),
        "match",
      );

      const [left, right] = screen.getAllByTestId("stream-column");
      expect(keysIn(left)).toEqual(["card:a", "card:d"]);
      expect(keysIn(right)).toEqual(["card:c"]);
      restore();
    });

    it("opens only the clicked card when sessions have no key", async () => {
      streams = [
        session({ sessionKey: undefined, title: "First" }),
        session({ sessionKey: undefined, title: "Second" }),
      ];
      render(<StreamsList />);

      await userEvent.click(screen.getAllByText("toggle undefined")[1]);

      expect(
        screen.getAllByText(/^expanded:/).map((node) => node.textContent),
      ).toEqual(["expanded:false", "expanded:true"]);
    });

    it("keeps one column in reading order on narrower screens", () => {
      const restore = withWidth(800);
      render(<StreamsList />);

      const columns = screen.getAllByTestId("stream-column");
      expect(columns).toHaveLength(1);
      expect(keysIn(columns[0])).toEqual([
        "card:a",
        "card:b",
        "card:c",
        "card:d",
        "card:e",
      ]);
      restore();
    });
  });

  describe("where its data comes from", () => {
    it("fetches when no sessions are supplied", () => {
      render(<StreamsList />);

      expect(fetchStreamsData).toHaveBeenCalled();
      expect(updateStreamsFromProps).not.toHaveBeenCalled();
    });

    it("uses supplied sessions instead of fetching", () => {
      const sessionsData: StreamsResponse = {
        MediaContainer: { size: 0, Metadata: [] },
      };
      render(<StreamsList sessionsData={sessionsData} />);

      expect(updateStreamsFromProps).toHaveBeenCalledWith(sessionsData);
      expect(fetchStreamsData).not.toHaveBeenCalled();
    });
  });

  describe("empty and error states", () => {
    it("says there are no active streams", () => {
      render(<StreamsList />);
      expect(screen.getByText("No active streams")).toBeInTheDocument();
    });

    it("refreshes when swiped down", async () => {
      const onRefresh = jest.fn();
      render(<StreamsList onRefresh={onRefresh} />);

      await act(async () => {
        swipeRefresh?.();
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("shows a connection error with a retry", async () => {
      error = "backend unreachable";
      const onRefresh = jest.fn();
      const user = userEvent.setup();
      render(<StreamsList onRefresh={onRefresh} />);

      expect(screen.getByText("Cannot reach the server")).toBeInTheDocument();
      expect(screen.getByText("backend unreachable")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try again" }));
      expect(onRefresh).toHaveBeenCalled();
    });

    it("prefers the error over the stream list", () => {
      error = "boom";
      streams = [session()];
      render(<StreamsList />);

      expect(screen.queryByText("card:s-1")).toBeNull();
    });
  });

  describe("the page header", () => {
    it("names the page", () => {
      render(<StreamsList />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Streams" }),
      ).toBeInTheDocument();
    });

    it("offers no live toggle", () => {
      render(<StreamsList />);
      expect(screen.queryByRole("button", { name: /Live|Manual/ })).toBeNull();
    });
  });

  describe("the grid", () => {
    it("never pads an odd count with a placeholder card", () => {
      streams = [session({ sessionKey: "s-1" })];
      const { container } = render(<StreamsList />);

      expect(
        container.querySelectorAll("[aria-hidden].border-dashed"),
      ).toHaveLength(0);
    });
  });

  describe("searching", () => {
    beforeEach(() => {
      streams = [
        session({ sessionKey: "s-1", title: "Arrival" }),
        session({
          sessionKey: "s-2",
          title: "Severance",
          User: { title: "bob" },
          Player: { title: "Bedroom", platform: "Android", product: "Plexamp" },
        }),
      ];
    });

    it("lists every stream with no search term", () => {
      render(<StreamsList />);

      expect(screen.getByText("card:s-1")).toBeInTheDocument();
      expect(screen.getByText("card:s-2")).toBeInTheDocument();
      expect(screen.queryByText(/Showing \d+ of/)).toBeNull();
    });

    it.each([
      ["bob", "s-2"],
      ["Bedroom", "s-2"],
      ["Android", "s-2"],
      ["Arrival", "s-1"],
      ["Plexamp", "s-2"],
    ])("matches %p on the expected field", async (term, expected) => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.type(
        screen.getByPlaceholderText(/Search by user, device, title or app/),
        term,
      );

      expect(screen.getByText(`card:${expected}`)).toBeInTheDocument();
      expect(screen.getByText("Showing 1 of 2 streams")).toBeInTheDocument();
    });

    it("matches on the show title", async () => {
      streams = [session({ sessionKey: "s-3", grandparentTitle: "Fringe" })];
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.type(
        screen.getByPlaceholderText(/Search by user, device, title or app/),
        "fringe",
      );

      expect(screen.getByText("card:s-3")).toBeInTheDocument();
    });

    it("says when nothing matches", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.type(
        screen.getByPlaceholderText(/Search by user, device, title or app/),
        "zzz",
      );

      expect(
        screen.getByText("No streams match your search"),
      ).toBeInTheDocument();
      expect(screen.getByText("Showing 0 of 2 streams")).toBeInTheDocument();
    });

    it("tolerates streams with no titles at all", async () => {
      streams = [
        session({
          sessionKey: "s-4",
          title: undefined,
          grandparentTitle: undefined,
          User: undefined,
          Player: undefined,
        }),
      ];
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.type(
        screen.getByPlaceholderText(/Search by user, device, title or app/),
        "x",
      );

      expect(
        screen.getByText("No streams match your search"),
      ).toBeInTheDocument();
    });
  });

  describe("the toolbar", () => {
    it("keeps refresh disabled until the request actually settles", async () => {
      let finish: () => void = () => {};
      const onRefresh = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      render(<StreamsList onRefresh={onRefresh} />);
      const button = screen.getByRole("button", { name: /Refresh/ });

      await act(async () => {
        button.click();
      });

      expect(onRefresh).toHaveBeenCalled();
      expect(button).toBeDisabled();

      await act(async () => {
        finish();
      });

      expect(button).not.toBeDisabled();
    });

    it("re-enables refresh when the request fails", async () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onRefresh = jest.fn(() => Promise.reject(new Error("offline")));
      render(<StreamsList onRefresh={onRefresh} />);
      const button = screen.getByRole("button", { name: /Refresh/ });

      await act(async () => {
        button.click();
      });

      expect(button).not.toBeDisabled();
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to refresh:",
        expect.any(Error),
      );
      consoleError.mockRestore();
    });

    it("works without any callbacks supplied", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.click(screen.getByRole("button", { name: /Refresh/ }));

      expect(screen.getByText("No active streams")).toBeInTheDocument();
    });
  });

  describe("expanding a card", () => {
    beforeEach(() => {
      streams = [
        session({ sessionKey: "s-1" }),
        session({ sessionKey: "s-2" }),
      ];
    });

    it("expands and collapses the same card", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.click(screen.getByRole("button", { name: "toggle s-1" }));
      expect(screen.getAllByText("expanded:true")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "toggle s-1" }));
      expect(screen.queryByText("expanded:true")).toBeNull();
    });

    it("moves the expansion to another card", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.click(screen.getByRole("button", { name: "toggle s-1" }));
      await user.click(screen.getByRole("button", { name: "toggle s-2" }));

      expect(screen.getAllByText("expanded:true")).toHaveLength(1);
      expect(screen.getAllByText("expanded:false")).toHaveLength(1);
    });

    it("falls back to the index as a key when there is no session key", () => {
      streams = [session({ sessionKey: undefined })];
      render(<StreamsList />);

      expect(screen.getByText("card:undefined")).toBeInTheDocument();
    });
  });

  describe("revoking access", () => {
    beforeEach(() => {
      streams = [session({ sessionKey: "s-1" })];
    });

    it("opens the confirmation for the chosen stream", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.click(screen.getByRole("button", { name: "remove s-1" }));

      expect(screen.getByText("confirm:s-1:false")).toBeInTheDocument();
    });

    it("revokes, then refreshes, then closes", async () => {
      const onRefresh = jest.fn();
      const user = userEvent.setup();
      render(<StreamsList onRefresh={onRefresh} />);

      await user.click(screen.getByRole("button", { name: "remove s-1" }));
      await user.click(screen.getByRole("button", { name: "confirm remove" }));

      await waitFor(() =>
        expect(revokeDeviceAuthorization).toHaveBeenCalledWith(
          expect.objectContaining({ sessionKey: "s-1" }),
        ),
      );
      expect(onRefresh).toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText(/^confirm:/)).toBeNull());
    });

    it("closes without refreshing when the revoke fails", async () => {
      revokeDeviceAuthorization.mockResolvedValue(false);
      const onRefresh = jest.fn();
      const user = userEvent.setup();
      render(<StreamsList onRefresh={onRefresh} />);

      await user.click(screen.getByRole("button", { name: "remove s-1" }));
      await user.click(screen.getByRole("button", { name: "confirm remove" }));

      await waitFor(() => expect(revokeDeviceAuthorization).toHaveBeenCalled());
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it("cancels without revoking", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.click(screen.getByRole("button", { name: "remove s-1" }));
      await user.click(screen.getByRole("button", { name: "cancel remove" }));

      expect(screen.queryByText(/^confirm:/)).toBeNull();
      expect(revokeDeviceAuthorization).not.toHaveBeenCalled();
    });

    it("marks the card and the modal as busy while revoking", () => {
      revokingAuth = "s-1";
      render(<StreamsList />);

      expect(screen.getByText("revoking:true")).toBeInTheDocument();
    });
  });
});
