import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Notification } from "@/types";
import { GlobalNotificationHandler } from "@/components/global-notification-handler";

const setNotificationClickHandler = jest.fn();
const updateNotifications = jest.fn();
const setNotifications = jest.fn();

jest.mock("@/contexts/notification-context", () => ({
  useNotificationContext: () => ({
    setNotificationClickHandler,
    updateNotifications,
    notifications: [],
    setNotifications,
  }),
}));

let settings: { key: string; value: string }[] = [];
jest.mock("@/contexts/settings-context", () => ({
  useSettings: () => ({ settings }),
}));

let auth = {
  setupRequired: false,
  isAuthenticated: true,
  user: { id: "admin-1" } as Record<string, unknown> | null,
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => auth,
  isAdminUser: (user: Record<string, unknown> | null) =>
    Boolean(user && "id" in user),
}));

const getAllNotifications = jest.fn();
const markNotificationAsReadAuto = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    getAllNotifications: (...args: unknown[]) => getAllNotifications(...args),
    markNotificationAsReadAuto: (...args: unknown[]) =>
      markNotificationAsReadAuto(...args),
  },
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
      <span>{`modal:${isOpen}:${userId}:${username ?? "-"}:${scrollToSessionId}`}</span>
      <button onClick={onClose}>close history</button>
    </div>
  ),
}));

const notification = (overrides: Partial<Notification> = {}) =>
  ({
    id: 7,
    userId: "u-1",
    username: "testuser",
    sessionHistoryId: 42,
    read: false,
    ...overrides,
  }) as Notification;

const clickHandler = () =>
  setNotificationClickHandler.mock.calls.at(-1)?.[0] as (
    n: Notification,
  ) => void;

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  settings = [{ key: "AUTO_MARK_NOTIFICATION_READ", value: "false" }];
  auth = {
    setupRequired: false,
    isAuthenticated: true,
    user: { id: "admin-1" },
  };
  getAllNotifications.mockResolvedValue([]);
  markNotificationAsReadAuto.mockResolvedValue(undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("GlobalNotificationHandler", () => {
  describe("fetching", () => {
    it("loads notifications and counts the unread ones", async () => {
      getAllNotifications.mockResolvedValue([
        { id: 1, read: false },
        { id: 2, read: true },
        { id: 3, read: false },
      ]);

      render(<GlobalNotificationHandler />);

      await waitFor(() =>
        expect(setNotifications).toHaveBeenCalledWith({
          data: [
            { id: 1, read: false },
            { id: 2, read: true },
            { id: 3, read: false },
          ],
          unreadCount: 2,
        }),
      );
    });

    it.each([
      ["during setup", { setupRequired: true }],
      ["when signed out", { isAuthenticated: false }],
      ["for a Plex user", { user: { plexUserId: "p-1" } }],
      ["with no user at all", { user: null }],
    ])("fetches nothing %s", (_label, overrides) => {
      auth = { ...auth, ...overrides };
      render(<GlobalNotificationHandler />);

      expect(getAllNotifications).not.toHaveBeenCalled();
    });

    it("polls every ten seconds and stops on unmount", async () => {
      jest.useFakeTimers();
      const { unmount } = render(<GlobalNotificationHandler />);
      await act(async () => {});
      expect(getAllNotifications).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(getAllNotifications).toHaveBeenCalledTimes(2);

      unmount();
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });
      expect(getAllNotifications).toHaveBeenCalledTimes(2);
    });

    it("logs a fetch failure without crashing", async () => {
      getAllNotifications.mockRejectedValue(new Error("nope"));
      render(<GlobalNotificationHandler />);

      await waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          "Failed to fetch notifications:",
          expect.any(Error),
        ),
      );
      expect(setNotifications).not.toHaveBeenCalled();
    });
  });

  describe("the click handler", () => {
    it("starts with the modal closed", () => {
      render(<GlobalNotificationHandler />);
      expect(screen.getByText("modal:false:null:-:null")).toBeInTheDocument();
    });

    it("opens the history at the right session", async () => {
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification());
      });

      expect(
        screen.getByText("modal:true:u-1:testuser:42"),
      ).toBeInTheDocument();
    });

    it.each([
      ["no session history id", { sessionHistoryId: undefined }],
      ["no user id", { userId: undefined }],
    ])("ignores a notification with %s", async (_label, overrides) => {
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification(overrides));
      });

      expect(screen.getByText("modal:false:null:-:null")).toBeInTheDocument();
    });

    it("resets everything when the modal closes", async () => {
      const user = userEvent.setup();
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification());
      });
      await user.click(screen.getByRole("button", { name: "close history" }));

      expect(screen.getByText("modal:false:null:-:null")).toBeInTheDocument();
    });
  });

  describe("auto marking as read", () => {
    it("does nothing while the setting is off", async () => {
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification());
      });

      expect(markNotificationAsReadAuto).not.toHaveBeenCalled();
      expect(updateNotifications).not.toHaveBeenCalled();
    });

    it("does nothing when the setting is missing", async () => {
      settings = [];
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification());
      });

      expect(markNotificationAsReadAuto).not.toHaveBeenCalled();
    });

    it("skips a notification that is already read", async () => {
      settings = [{ key: "AUTO_MARK_NOTIFICATION_READ", value: "true" }];
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification({ read: true }));
      });

      expect(markNotificationAsReadAuto).not.toHaveBeenCalled();
    });

    it("marks it read optimistically and calls the API", async () => {
      settings = [{ key: "AUTO_MARK_NOTIFICATION_READ", value: "true" }];
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification());
      });

      expect(markNotificationAsReadAuto).toHaveBeenCalledWith(7);
      const optimistic = updateNotifications.mock.calls[0][0];
      expect(
        optimistic([
          { id: 7, read: false },
          { id: 8, read: false },
        ]),
      ).toEqual([
        { id: 7, read: true },
        { id: 8, read: false },
      ]);
    });

    it("reverts the optimistic update when the API fails", async () => {
      settings = [{ key: "AUTO_MARK_NOTIFICATION_READ", value: "true" }];
      markNotificationAsReadAuto.mockRejectedValue(new Error("nope"));
      render(<GlobalNotificationHandler />);

      await act(async () => {
        clickHandler()(notification());
      });

      await waitFor(() => expect(updateNotifications).toHaveBeenCalledTimes(2));
      const revert = updateNotifications.mock.calls[1][0];
      expect(
        revert([
          { id: 7, read: true },
          { id: 8, read: true },
        ]),
      ).toEqual([
        { id: 7, read: false },
        { id: 8, read: true },
      ]);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to mark notification as read:",
        expect.any(Error),
      );
    });
  });
});
