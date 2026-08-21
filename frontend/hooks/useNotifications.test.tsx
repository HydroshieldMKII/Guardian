import { act, renderHook, waitFor } from "@testing-library/react";
import { Notification } from "@/types";
import { apiClient } from "@/lib/api";
import { useNotifications } from "./useNotifications";

jest.mock("@/lib/api", () => ({
  apiClient: {
    getAllNotifications: jest.fn(),
    markNotificationAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
    clearAllNotifications: jest.fn(),
  },
}));

const api = jest.mocked(apiClient);

const notification = (id: number, read = false): Notification => ({
  id,
  read,
  userId: "u1",
  username: "alice",
  deviceName: "Living Room TV",
  text: "Stream blocked",
  type: "block",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  api.getAllNotifications.mockResolvedValue([notification(1), notification(2, true)]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("initial load", () => {
  it("fetches notifications when no initial data is supplied", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getAllNotifications).toHaveBeenCalledTimes(1);
    expect(result.current.notifications).toHaveLength(2);
  });

  it("parses createdAt into a Date", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications[0].createdAt).toBeInstanceOf(Date);
  });

  it("derives the unread count", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.unreadCount).toBe(1);
  });

  it("skips the fetch when initial data is supplied", async () => {
    const { result } = renderHook(() =>
      useNotifications({
        initialData: { data: [notification(9)], unreadCount: 1 },
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getAllNotifications).not.toHaveBeenCalled();
    expect(result.current.notifications).toHaveLength(1);
  });

  it("surfaces an error and empties the list when the fetch fails", async () => {
    api.getAllNotifications.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Failed to load notifications");
    expect(result.current.notifications).toEqual([]);
  });
});

describe("mutations", () => {
  const setup = async () => {
    const hook = renderHook(() => useNotifications());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    return hook;
  };

  it("marks a single notification as read", async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.markAsRead(1);
    });

    expect(api.markNotificationAsRead).toHaveBeenCalledWith(1);
    expect(result.current.notifications.find((n) => n.id === 1)?.read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("leaves state untouched when marking as read fails", async () => {
    api.markNotificationAsRead.mockRejectedValue(new Error("boom"));
    const { result } = await setup();

    await act(async () => {
      await result.current.markAsRead(1);
    });

    expect(result.current.notifications.find((n) => n.id === 1)?.read).toBe(false);
  });

  it("removes a notification", async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.removeNotification(1);
    });

    expect(api.deleteNotification).toHaveBeenCalledWith(1);
    expect(result.current.notifications.map((n) => n.id)).toEqual([2]);
  });

  it("keeps the notification when deletion fails", async () => {
    api.deleteNotification.mockRejectedValue(new Error("boom"));
    const { result } = await setup();

    await act(async () => {
      await result.current.removeNotification(1);
    });

    expect(result.current.notifications).toHaveLength(2);
  });

  it("marks every notification as read", async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
    expect(result.current.unreadCount).toBe(0);
  });

  it("keeps unread state when marking all fails", async () => {
    api.markAllNotificationsAsRead.mockRejectedValue(new Error("boom"));
    const { result } = await setup();

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(1);
  });

  it("clears every notification", async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.clearAll();
    });

    expect(api.clearAllNotifications).toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
  });

  it("keeps notifications when clearing fails", async () => {
    api.clearAllNotifications.mockRejectedValue(new Error("boom"));
    const { result } = await setup();

    await act(async () => {
      await result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(2);
  });

  it("refetches on refresh", async () => {
    const { result } = await setup();

    await act(async () => {
      result.current.refreshNotifications();
    });

    expect(api.getAllNotifications).toHaveBeenCalledTimes(2);
  });
});
