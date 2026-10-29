import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Notification } from "@/types";
import { NotificationMenu } from "@/components/notification-menu";

const markAsRead = jest.fn<Promise<void>, [number]>();
const remove = jest.fn<Promise<void>, [number]>();
const markAllAsRead = jest.fn<Promise<void>, []>();
const clearAll = jest.fn<Promise<void>, []>();
const markReadAutomatically = jest.fn<Promise<void>, [number]>();
const enabledCalls: boolean[] = [];
let notifications: Notification[] = [];
let unreadCount = 0;

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: (enabled: boolean) => {
    enabledCalls.push(enabled);
    return {
      notifications,
      unreadCount,
      markAsRead: (id: number) => markAsRead(id),
      remove: (id: number) => remove(id),
      markAllAsRead: () => markAllAsRead(),
      clearAll: () => clearAll(),
      markReadAutomatically: (id: number) => markReadAutomatically(id),
    };
  },
}));

let autoMarkRead: string | undefined;
jest.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    getSetting: (key: string) =>
      key === "AUTO_MARK_NOTIFICATION_READ" ? autoMarkRead : undefined,
  }),
}));

type TestUser = { id: string } | { plexUserId: string } | null;
let auth: { setupRequired: boolean; isAuthenticated: boolean; user: TestUser };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => auth,
  isAdminUser: (user: TestUser) => user !== null && "id" in user,
}));

jest.mock("@/components/device-management/UserHistoryModal", () => ({
  UserHistoryModal: ({
    userId,
    username,
    isOpen,
    scrollToSessionId,
    onClose,
  }: {
    userId: string | null;
    username?: string;
    isOpen: boolean;
    scrollToSessionId: number | null;
    onClose: () => void;
  }) => (
    <div>
      <span>{`history:${isOpen}:${userId}:${username ?? "-"}:${scrollToSessionId}`}</span>
      <button onClick={onClose}>close history</button>
    </div>
  ),
}));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const notification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  userId: "u-1",
  username: "testuser",
  deviceName: "Living Room TV",
  text: "New device seen",
  type: "info",
  read: false,
  createdAt: minutesAgo(5),
  sessionHistoryId: 42,
  ...overrides,
});

const CLOSED_HISTORY = "history:false:null:-:null";
const OPEN_HISTORY = "history:true:u-1:testuser:42";

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTitle("Notifications"));
  await screen.findByRole("dialog");
};

beforeEach(() => {
  jest.clearAllMocks();
  enabledCalls.length = 0;
  notifications = [];
  unreadCount = 0;
  autoMarkRead = "false";
  auth = { setupRequired: false, isAuthenticated: true, user: { id: "a-1" } };
  markAsRead.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
  markAllAsRead.mockResolvedValue(undefined);
  clearAll.mockResolvedValue(undefined);
  markReadAutomatically.mockResolvedValue(undefined);
});

describe("NotificationMenu feed", () => {
  it("follows the notifications for a signed-in admin", () => {
    render(<NotificationMenu />);

    expect(enabledCalls.at(-1)).toBe(true);
  });

  it.each([
    ["during setup", { setupRequired: true }],
    ["when signed out", { isAuthenticated: false }],
    ["for a Plex user", { user: { plexUserId: "p-1" } }],
    ["with no user at all", { user: null }],
  ])("stays off %s", (_label, overrides) => {
    auth = { ...auth, ...overrides };
    render(<NotificationMenu />);

    expect(enabledCalls.at(-1)).toBe(false);
  });
});

describe("NotificationMenu trigger", () => {
  it("shows a plain bell with nothing unread", () => {
    render(<NotificationMenu />);

    expect(screen.queryByTestId("unread-dot")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
  });

  it("marks unread mail with a dot and names the count", () => {
    unreadCount = 3;
    render(<NotificationMenu />);

    expect(screen.getByTestId("unread-dot")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Notifications, 3 unread" }),
    ).toBeInTheDocument();
  });

  it("keeps the dot the same size however much is unread", () => {
    unreadCount = 250;
    render(<NotificationMenu />);

    expect(screen.queryByText("99+")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Notifications, 250 unread" }),
    ).toBeInTheDocument();
  });
});

describe("NotificationMenu contents", () => {
  it("says there is nothing to show", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);

    await openMenu(user);

    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
  });

  it("lists notifications with their text", async () => {
    notifications = [
      notification({ id: 1, text: "First" }),
      notification({ id: 2, text: "Second" }),
    ];
    const user = userEvent.setup();
    render(<NotificationMenu />);

    await openMenu(user);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("offers bulk actions only when relevant", async () => {
    notifications = [notification({ read: true })];
    unreadCount = 0;
    const user = userEvent.setup();
    render(<NotificationMenu />);

    await openMenu(user);

    expect(
      screen.getByRole("button", { name: /Clear all/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mark all as read/ }),
    ).toBeNull();
  });

  describe("relative timestamps", () => {
    it.each([
      [1, "now"],
      [30, "30m ago"],
      [120, "2h ago"],
      [60 * 24 * 3, "3d ago"],
    ])("renders %p minutes ago as %p", async (minutes, expected) => {
      notifications = [notification({ createdAt: minutesAgo(minutes) })];
      const user = userEvent.setup();
      render(<NotificationMenu />);

      await openMenu(user);

      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  it("marks unread entries with a dot and a read button", async () => {
    notifications = [
      notification({ id: 1, read: false }),
      notification({ id: 2, read: true }),
    ];
    unreadCount = 1;
    const user = userEvent.setup();
    render(<NotificationMenu />);

    await openMenu(user);

    expect(
      screen.getAllByRole("button", { name: "Mark as read" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Delete this notification" }),
    ).toHaveLength(2);
  });
});

describe("NotificationMenu panel", () => {
  it("names the panel after its heading", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);

    await openMenu(user);

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Notifications");
  });

  it.each([
    [2, "2 unread"],
    [0, "All caught up"],
  ])("summarises %p unread as %p", async (count, expected) => {
    notifications = [notification({ read: count === 0 })];
    unreadCount = count;
    const user = userEvent.setup();
    render(<NotificationMenu />);

    await openMenu(user);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("lets the keyboard reach every action", async () => {
    notifications = [notification({ id: 1 })];
    unreadCount = 1;
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    const reached = new Set<string>();
    for (let step = 0; step < 6; step++) {
      await user.tab();
      const label =
        document.activeElement?.getAttribute("title") ??
        document.activeElement?.textContent ??
        "";
      reached.add(label);
    }

    expect(reached.has("Mark as read")).toBe(true);
    expect(reached.has("Delete this notification")).toBe(true);
    expect(reached.has("Open this stream in the user's history")).toBe(true);
  });

  it("opens a linked stream from the keyboard", async () => {
    notifications = [notification({ text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    screen.getByTitle("Open this stream in the user's history").focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText(OPEN_HISTORY)).toBeInTheDocument();
  });
});

describe("NotificationMenu actions", () => {
  beforeEach(() => {
    notifications = [notification({ id: 1 })];
    unreadCount = 1;
  });

  it("marks one as read", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(markAsRead).toHaveBeenCalledWith(1);
  });

  it("removes one", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(
      screen.getByRole("button", { name: "Delete this notification" }),
    );

    expect(remove).toHaveBeenCalledWith(1);
  });

  it("marks all as read", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: /Mark all as read/ }));

    expect(markAllAsRead).toHaveBeenCalled();
  });

  it("clears all", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: /Clear all/ }));

    expect(clearAll).toHaveBeenCalled();
  });
});

describe("opening session history from a notification", () => {
  it("starts with the history closed", () => {
    render(<NotificationMenu />);

    expect(screen.getByText(CLOSED_HISTORY)).toBeInTheDocument();
  });

  it("opens the history at the linked session", async () => {
    notifications = [notification({ text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Linked"));

    expect(screen.getByText(OPEN_HISTORY)).toBeInTheDocument();
  });

  it("closes the panel once the stream is on its way", async () => {
    notifications = [notification({ text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Linked"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resets the history when it closes", async () => {
    notifications = [notification({ text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);
    await user.click(screen.getByText("Linked"));

    await user.click(screen.getByRole("button", { name: "close history" }));

    expect(screen.getByText(CLOSED_HISTORY)).toBeInTheDocument();
  });

  it("stays open while triaging, so several can be cleared at once", async () => {
    notifications = [notification({ id: 1, text: "First" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByTitle("Mark as read"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does nothing when no session is linked", async () => {
    notifications = [
      notification({ sessionHistoryId: undefined, text: "Unlinked" }),
    ];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Unlinked"));

    expect(screen.getByText(CLOSED_HISTORY)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the panel without history when the user is unknown", async () => {
    autoMarkRead = "true";
    notifications = [notification({ userId: "", text: "Orphan" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Orphan"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(CLOSED_HISTORY)).toBeInTheDocument();
    expect(markReadAutomatically).not.toHaveBeenCalled();
  });

  it("marks an unread notification read when the setting is on", async () => {
    autoMarkRead = "true";
    notifications = [notification({ id: 7, text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Linked"));

    expect(markReadAutomatically).toHaveBeenCalledWith(7);
  });

  it.each([
    ["the setting is off", "false", false],
    ["the setting is missing", undefined, false],
    ["the notification is already read", "true", true],
  ])("leaves the read state alone when %s", async (_label, setting, read) => {
    autoMarkRead = setting;
    notifications = [notification({ read, text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Linked"));

    expect(screen.getByText(OPEN_HISTORY)).toBeInTheDocument();
    expect(markReadAutomatically).not.toHaveBeenCalled();
  });

  it("explains in the tooltip which is which", async () => {
    notifications = [
      notification({ id: 1, sessionHistoryId: 42, text: "Linked" }),
      notification({ id: 2, sessionHistoryId: undefined, text: "Unlinked" }),
    ];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    expect(screen.getByText("Linked").closest("[title]")).toHaveAttribute(
      "title",
      "Open this stream in the user's history",
    );
    expect(screen.getByText("Unlinked").closest("[title]")).toHaveAttribute(
      "title",
      "The stream behind this notification is no longer in the history",
    );
  });
});

describe("on a narrow viewport", () => {
  const originalWidth = window.innerWidth;

  const setWidth = (value: number) =>
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value,
    });

  beforeEach(() => setWidth(400));
  afterEach(() => setWidth(originalWidth));

  const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByTitle("Notifications"));
    return screen.findByRole("dialog");
  };

  it("opens a modal instead of a dropdown", async () => {
    notifications = [notification({ text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);

    const dialog = await openSheet(user);

    expect(within(dialog).getByText("Linked")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });

  it("names the panel for a screen reader", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);

    const dialog = await openSheet(user);

    expect(dialog).toHaveAccessibleName("Notifications");
  });

  it("still offers the bulk actions", async () => {
    notifications = [notification()];
    unreadCount = 1;
    const user = userEvent.setup();
    render(<NotificationMenu />);

    const dialog = await openSheet(user);

    expect(within(dialog).getByTitle("Mark all as read")).toBeInTheDocument();
    expect(within(dialog).getByText("Clear all")).toBeInTheDocument();
  });

  it("closes once a stream is on its way", async () => {
    notifications = [notification({ text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    const dialog = await openSheet(user);

    await user.click(within(dialog).getByText("Linked"));

    expect(screen.getByText(OPEN_HISTORY)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers a way out that is not the overlay", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    const dialog = await openSheet(user);

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says when there is nothing to show", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);

    const dialog = await openSheet(user);

    expect(within(dialog).getByText("No notifications")).toBeInTheDocument();
  });
});
