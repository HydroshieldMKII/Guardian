import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Notification } from "@/types";
import { NotificationMenu } from "@/components/notification-menu";

const updateNotifications = jest.fn();
const onNotificationClick = jest.fn();
let notifications: Notification[] = [];
let unreadCount = 0;

jest.mock("@/contexts/notification-context", () => ({
  useNotificationContext: () => ({
    notifications,
    unreadCount,
    updateNotifications,
    onNotificationClick,
  }),
}));

const markNotificationAsRead = jest.fn();
const deleteNotification = jest.fn();
const markAllNotificationsAsRead = jest.fn();
const clearAllNotifications = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    markNotificationAsRead: (...a: unknown[]) => markNotificationAsRead(...a),
    deleteNotification: (...a: unknown[]) => deleteNotification(...a),
    markAllNotificationsAsRead: (...a: unknown[]) =>
      markAllNotificationsAsRead(...a),
    clearAllNotifications: (...a: unknown[]) => clearAllNotifications(...a),
  },
}));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const notification = (overrides: Partial<Notification> = {}) =>
  ({
    id: 1,
    text: "New device seen",
    read: false,
    createdAt: minutesAgo(5),
    sessionHistoryId: 42,
    ...overrides,
  }) as Notification;

let consoleError: jest.SpyInstance;

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = document.querySelector<HTMLElement>('[aria-haspopup="menu"]');
  await user.click(trigger as HTMLElement);
  await screen.findByRole("menu");
};

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  notifications = [];
  unreadCount = 0;
  markNotificationAsRead.mockResolvedValue(undefined);
  deleteNotification.mockResolvedValue(undefined);
  markAllNotificationsAsRead.mockResolvedValue(undefined);
  clearAllNotifications.mockResolvedValue(undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("NotificationMenu trigger", () => {
  it("shows a plain bell with nothing unread", () => {
    const { container } = render(<NotificationMenu />);

    expect(container.querySelector(".lucide-bell")).not.toBeNull();
    expect(container.querySelector(".lucide-bell-ring")).toBeNull();
  });

  it("shows a ringing bell and a count when there is unread mail", () => {
    unreadCount = 3;
    const { container } = render(<NotificationMenu />);

    expect(container.querySelector(".lucide-bell-ring")).not.toBeNull();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the badge at 99+", () => {
    unreadCount = 250;
    render(<NotificationMenu />);
    expect(screen.getByText("99+")).toBeInTheDocument();
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

    await waitFor(() => expect(markNotificationAsRead).toHaveBeenCalledWith(1));
    const updater = updateNotifications.mock.calls[0][0];
    expect(
      updater([
        { id: 1, read: false },
        { id: 2, read: false },
      ]),
    ).toEqual([
      { id: 1, read: true },
      { id: 2, read: false },
    ]);
  });

  it("removes one", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(
      screen.getByRole("button", { name: "Delete this notification" }),
    );

    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith(1));
    const updater = updateNotifications.mock.calls[0][0];
    expect(updater([{ id: 1 }, { id: 2 }])).toEqual([{ id: 2 }]);
  });

  it("marks all as read", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: /Mark all as read/ }));

    await waitFor(() => expect(markAllNotificationsAsRead).toHaveBeenCalled());
    const updater = updateNotifications.mock.calls[0][0];
    expect(updater([{ id: 1, read: false }])).toEqual([{ id: 1, read: true }]);
  });

  it("clears all", async () => {
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: /Clear all/ }));

    await waitFor(() => expect(clearAllNotifications).toHaveBeenCalled());
    expect(updateNotifications.mock.calls[0][0]()).toEqual([]);
  });

  it.each([
    [
      "Mark as read",
      () => markNotificationAsRead,
      "Failed to mark notification as read:",
    ],
    [
      "Delete this notification",
      () => deleteNotification,
      "Failed to delete notification:",
    ],
  ])("logs a failure from %s", async (label, getMock, message) => {
    getMock().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: label }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(message, expect.any(Error)),
    );
    expect(updateNotifications).not.toHaveBeenCalled();
  });

  it("logs a failure from mark all", async () => {
    markAllNotificationsAsRead.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: /Mark all as read/ }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to mark all notifications as read:",
        expect.any(Error),
      ),
    );
  });

  it("logs a failure from clear all", async () => {
    clearAllNotifications.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: /Clear all/ }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to clear all notifications:",
        expect.any(Error),
      ),
    );
  });
});

describe("opening session history from a notification", () => {
  it("invokes the handler when a session is linked", async () => {
    notifications = [notification({ sessionHistoryId: 42, text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Linked"));

    expect(onNotificationClick).toHaveBeenCalledWith(
      expect.objectContaining({ sessionHistoryId: 42 }),
    );
  });

  it("closes the panel once the stream is on its way", async () => {
    notifications = [notification({ sessionHistoryId: 42, text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Linked"));

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("stays open while triaging, so several can be cleared at once", async () => {
    notifications = [notification({ id: 1, text: "First" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByTitle("Mark as read"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("does nothing when no session is linked", async () => {
    notifications = [
      notification({ sessionHistoryId: undefined, text: "Unlinked" }),
    ];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    await user.click(screen.getByText("Unlinked"));

    expect(onNotificationClick).not.toHaveBeenCalled();
  });

  it("explains in the tooltip which is which", async () => {
    notifications = [
      notification({ id: 1, sessionHistoryId: 42, text: "Linked" }),
      notification({ id: 2, sessionHistoryId: undefined, text: "Unlinked" }),
    ];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    await openMenu(user);

    expect(screen.getByText("Linked").closest("div")).toHaveAttribute(
      "title",
      "Open this stream in the user's history",
    );
    expect(screen.getByText("Unlinked").closest("div")).toHaveAttribute(
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
    expect(screen.queryByRole("menu")).toBeNull();
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
    notifications = [notification({ sessionHistoryId: 42, text: "Linked" })];
    const user = userEvent.setup();
    render(<NotificationMenu />);
    const dialog = await openSheet(user);

    await user.click(within(dialog).getByText("Linked"));

    expect(onNotificationClick).toHaveBeenCalled();
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
