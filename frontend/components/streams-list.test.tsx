import { act, render, screen, waitFor, within } from "@testing-library/react";
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

jest.mock("@/hooks/useSwipeToRefresh", () => ({
  useSwipeToRefresh: () => ({ "data-swipe": "true" }),
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

const session = (overrides: Record<string, unknown> = {}) =>
  ({
    sessionKey: "s-1",
    title: "Arrival",
    grandparentTitle: "",
    User: { title: "alice" },
    Player: { title: "Living Room TV", platform: "Roku", product: "Plex" },
    ...overrides,
  }) as unknown as PlexSession;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  streams = [];
  error = null;
  revokingAuth = null;
  revokeDeviceAuthorization.mockResolvedValue(true);
});

describe("StreamsList", () => {
  describe("where its data comes from", () => {
    it("fetches when no sessions are supplied", () => {
      render(<StreamsList />);

      expect(fetchStreamsData).toHaveBeenCalled();
      expect(updateStreamsFromProps).not.toHaveBeenCalled();
    });

    it("uses supplied sessions instead of fetching", () => {
      const sessionsData = { sessions: [] } as unknown as StreamsResponse;
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

    it("shows a connection error with a retry", async () => {
      error = "backend unreachable";
      const onRefresh = jest.fn();
      const user = userEvent.setup();
      render(<StreamsList onRefresh={onRefresh} />);

      expect(screen.getByText("Connection Error")).toBeInTheDocument();
      expect(screen.getByText("backend unreachable")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try Again" }));
      expect(onRefresh).toHaveBeenCalled();
    });

    it("prefers the error over the stream list", () => {
      error = "boom";
      streams = [session()];
      render(<StreamsList />);

      expect(screen.queryByText("card:s-1")).toBeNull();
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

      await user.type(screen.getByPlaceholderText(/Search streams/), term);

      expect(screen.getByText(`card:${expected}`)).toBeInTheDocument();
      expect(screen.getByText("Showing 1 of 2 streams")).toBeInTheDocument();
    });

    it("matches on the show title", async () => {
      streams = [session({ sessionKey: "s-3", grandparentTitle: "Fringe" })];
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.type(screen.getByPlaceholderText(/Search streams/), "fringe");

      expect(screen.getByText("card:s-3")).toBeInTheDocument();
    });

    it("says when nothing matches", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.type(screen.getByPlaceholderText(/Search streams/), "zzz");

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

      await user.type(screen.getByPlaceholderText(/Search streams/), "x");

      expect(
        screen.getByText("No streams match your search"),
      ).toBeInTheDocument();
    });
  });

  describe("the toolbar", () => {
    it("reports and toggles live mode", async () => {
      const onAutoRefreshChange = jest.fn();
      const user = userEvent.setup();
      render(
        <StreamsList autoRefresh onAutoRefreshChange={onAutoRefreshChange} />,
      );

      expect(screen.getByRole("button", { name: /Live/ })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Live/ }));

      expect(onAutoRefreshChange).toHaveBeenCalledWith(false);
    });

    it("reports and toggles manual mode", async () => {
      const onAutoRefreshChange = jest.fn();
      const user = userEvent.setup();
      render(<StreamsList onAutoRefreshChange={onAutoRefreshChange} />);

      await user.click(screen.getByRole("button", { name: /Manual/ }));

      expect(onAutoRefreshChange).toHaveBeenCalledWith(true);
    });

    it("disables refresh briefly after a refresh", async () => {
      const onRefresh = jest.fn();
      render(<StreamsList onRefresh={onRefresh} />);
      const button = screen.getByRole("button", { name: /Refresh/ });

      jest.useFakeTimers();
      await act(async () => {
        button.click();
      });

      expect(onRefresh).toHaveBeenCalled();
      expect(button).toBeDisabled();

      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(button).not.toBeDisabled();
    });

    it("works without any callbacks supplied", async () => {
      const user = userEvent.setup();
      render(<StreamsList />);

      await user.click(screen.getByRole("button", { name: /Refresh/ }));
      await user.click(screen.getByRole("button", { name: /Manual/ }));

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
