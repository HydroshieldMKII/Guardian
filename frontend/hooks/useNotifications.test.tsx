import { act, waitFor } from "@testing-library/react";
import {
  NOTIFICATION_POLL_MS,
  useNotifications,
} from "@/hooks/useNotifications";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { renderHookWithQuery } from "@/test-utils/query";
import type { Notification } from "@/types";

type WireNotification = Omit<Notification, "createdAt"> & {
  createdAt: string;
};

const getAllNotifications = jest.fn<Promise<WireNotification[]>, []>();
const markNotificationAsRead = jest.fn<Promise<void>, [number]>();
const deleteNotification = jest.fn<Promise<void>, [number]>();
const markAllNotificationsAsRead = jest.fn<Promise<void>, []>();
const clearAllNotifications = jest.fn<Promise<void>, []>();
const markNotificationAsReadAuto = jest.fn<Promise<void>, [number]>();

jest.mock("@/lib/api", () => ({
  apiClient: {
    getAllNotifications: () => getAllNotifications(),
    markNotificationAsRead: (id: number) => markNotificationAsRead(id),
    deleteNotification: (id: number) => deleteNotification(id),
    markAllNotificationsAsRead: () => markAllNotificationsAsRead(),
    clearAllNotifications: () => clearAllNotifications(),
    markNotificationAsReadAuto: (id: number) => markNotificationAsReadAuto(id),
  },
}));

let connected = false;
const useLiveEvent = jest.fn<
  { connected: boolean },
  [string, (payload: WireNotification[]) => void, boolean]
>(() => ({ connected }));
jest.mock("@/hooks/useLiveDashboard", () => ({
  NOTIFICATIONS_EVENT: "notifications",
  useLiveEvent: (
    eventName: string,
    onUpdate: (payload: WireNotification[]) => void,
    enabled: boolean,
  ) => useLiveEvent(eventName, onUpdate, enabled),
}));

const CREATED_AT = "2026-01-01T00:00:00.000Z";

const wire = (id: number, read = false): WireNotification => ({
  id,
  read,
  userId: "u-1",
  username: "testuser",
  deviceName: "Living Room TV",
  text: `Notification ${id}`,
  type: "info",
  createdAt: CREATED_AT,
});

const readStates = (notifications: Notification[]) =>
  notifications.map(({ id, read }) => ({ id, read }));

const pushLive = (payload: WireNotification[]) => {
  const onUpdate = useLiveEvent.mock.calls.at(-1)?.[1];
  act(() => onUpdate?.(payload));
};

const renderLoaded = async () => {
  const rendered = renderHookWithQuery(() => useNotifications(true));
  await waitFor(() =>
    expect(rendered.result.current.notifications).toHaveLength(2),
  );
  return rendered;
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  connected = false;
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  getAllNotifications.mockResolvedValue([wire(1), wire(2, true)]);
  markNotificationAsRead.mockResolvedValue(undefined);
  deleteNotification.mockResolvedValue(undefined);
  markAllNotificationsAsRead.mockResolvedValue(undefined);
  clearAllNotifications.mockResolvedValue(undefined);
  markNotificationAsReadAuto.mockResolvedValue(undefined);
});

afterEach(() => {
  consoleError.mockRestore();
  jest.useRealTimers();
});

describe("loading", () => {
  it("loads the notifications with real dates and counts the unread ones", async () => {
    const { result } = await renderLoaded();

    expect(result.current.notifications[0].createdAt).toEqual(
      new Date(CREATED_AT),
    );
    expect(result.current.unreadCount).toBe(1);
  });

  it("fetches and listens to nothing while disabled", () => {
    const { result } = renderHookWithQuery(() => useNotifications(false));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(getAllNotifications).not.toHaveBeenCalled();
    expect(useLiveEvent).toHaveBeenLastCalledWith(
      "notifications",
      expect.any(Function),
      false,
    );
  });

  it("logs a failed fetch and shows nothing", async () => {
    getAllNotifications.mockRejectedValue(new Error("down"));
    const { result } = renderHookWithQuery(() => useNotifications(true));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Request failed:",
        queryKeys.notifications,
        expect.any(Error),
      ),
    );
    expect(result.current.notifications).toEqual([]);
  });
});

describe("staying current", () => {
  it("polls while the live stream is down", async () => {
    jest.useFakeTimers();
    renderHookWithQuery(() => useNotifications(true));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(getAllNotifications).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    });

    expect(getAllNotifications).toHaveBeenCalledTimes(2);
  });

  it("stops polling once the live stream is up", async () => {
    connected = true;
    jest.useFakeTimers();
    renderHookWithQuery(() => useNotifications(true));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS * 3);
    });

    expect(getAllNotifications).toHaveBeenCalledTimes(1);
  });

  it("replaces the list with what the server pushes", async () => {
    const { result, client } = await renderLoaded();

    pushLive([wire(3), wire(4), wire(5, true)]);

    await waitFor(() =>
      expect(readStates(result.current.notifications)).toEqual([
        { id: 3, read: false },
        { id: 4, read: false },
        { id: 5, read: true },
      ]),
    );
    expect(result.current.notifications[0].createdAt).toEqual(
      new Date(CREATED_AT),
    );
    expect(result.current.unreadCount).toBe(2);
    expect(client.getQueryData(queryKeys.notifications)).toHaveLength(3);
  });
});

describe("actions", () => {
  it("marks one as read", async () => {
    const { result } = await renderLoaded();

    await act(() => result.current.markAsRead(1));

    expect(markNotificationAsRead).toHaveBeenCalledWith(1);
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it("removes one", async () => {
    const { result } = await renderLoaded();

    await act(() => result.current.remove(1));

    expect(deleteNotification).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(readStates(result.current.notifications)).toEqual([
        { id: 2, read: true },
      ]),
    );
  });

  it("marks every one as read", async () => {
    getAllNotifications.mockResolvedValue([wire(1), wire(2)]);
    const { result } = await renderLoaded();

    await act(() => result.current.markAllAsRead());

    expect(markAllNotificationsAsRead).toHaveBeenCalled();
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it("clears every one", async () => {
    const { result } = await renderLoaded();

    await act(() => result.current.clearAll());

    expect(clearAllNotifications).toHaveBeenCalled();
    await waitFor(() => expect(result.current.notifications).toEqual([]));
  });

  it.each([
    [
      "marking one as read",
      () => markNotificationAsRead,
      (hook: ReturnType<typeof useNotifications>) => hook.markAsRead(1),
      "Failed to mark notification as read:",
    ],
    [
      "removing one",
      () => deleteNotification,
      (hook: ReturnType<typeof useNotifications>) => hook.remove(1),
      "Failed to delete notification:",
    ],
    [
      "marking all as read",
      () => markAllNotificationsAsRead,
      (hook: ReturnType<typeof useNotifications>) => hook.markAllAsRead(),
      "Failed to mark all notifications as read:",
    ],
    [
      "clearing all",
      () => clearAllNotifications,
      (hook: ReturnType<typeof useNotifications>) => hook.clearAll(),
      "Failed to clear all notifications:",
    ],
  ])(
    "logs a failure when %s and keeps the list",
    async (_label, getMock, run, message) => {
      getMock().mockRejectedValue(new Error("nope"));
      const { result } = await renderLoaded();

      await act(() => run(result.current));

      expect(consoleError).toHaveBeenCalledWith(message, expect.any(Error));
      expect(readStates(result.current.notifications)).toEqual([
        { id: 1, read: false },
        { id: 2, read: true },
      ]);
    },
  );

  it("leaves an empty cache alone", async () => {
    const client = createQueryClient();
    const { result } = renderHookWithQuery(
      () => useNotifications(false),
      client,
    );

    await act(() => result.current.markAsRead(1));

    expect(client.getQueryData(queryKeys.notifications)).toBeUndefined();
  });
});

describe("marking read automatically", () => {
  it("marks it read before the server answers", async () => {
    let answer: () => void = () => {};
    markNotificationAsReadAuto.mockReturnValue(
      new Promise<void>((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = await renderLoaded();

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.markReadAutomatically(1);
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(markNotificationAsReadAuto).toHaveBeenCalledWith(1);
    await act(async () => {
      answer();
      await pending;
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it("puts it back to unread when the server refuses", async () => {
    markNotificationAsReadAuto.mockRejectedValue(new Error("nope"));
    const { result } = await renderLoaded();

    await act(() => result.current.markReadAutomatically(1));

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to mark notification as read:",
      expect.any(Error),
    );
    expect(readStates(result.current.notifications)).toEqual([
      { id: 1, read: false },
      { id: 2, read: true },
    ]);
  });
});
