import { act, renderHook } from "@testing-library/react";
import { Notification } from "@/types";
import {
  NotificationProvider,
  useNotificationContext,
} from "./notification-context";

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

const setup = (initialData?: {
  data: Notification[];
  unreadCount: number;
}) =>
  renderHook(() => useNotificationContext(), {
    wrapper: ({ children }) => (
      <NotificationProvider initialData={initialData}>
        {children}
      </NotificationProvider>
    ),
  });

describe("useNotificationContext", () => {
  it("throws when used outside its provider", () => {
    const silence = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useNotificationContext())).toThrow(
      "useNotificationContext must be used within a NotificationProvider",
    );
    silence.mockRestore();
  });

  it("starts empty without initial data", () => {
    const { result } = setup();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("seeds from initial data", () => {
    const { result } = setup({ data: [notification(1)], unreadCount: 1 });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });
});

describe("setNotifications", () => {
  it("replaces the list and the unread count", () => {
    const { result } = setup();

    act(() => {
      result.current.setNotifications({
        data: [notification(1), notification(2, true)],
        unreadCount: 1,
      });
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it("normalizes createdAt to a Date", () => {
    const { result } = setup();

    act(() => {
      result.current.setNotifications({
        data: [notification(1)],
        unreadCount: 1,
      });
    });

    expect(result.current.notifications[0].createdAt).toBeInstanceOf(Date);
  });
});

describe("updateNotifications", () => {
  it("recomputes the unread count from the updated list", () => {
    const { result } = setup({
      data: [notification(1), notification(2)],
      unreadCount: 2,
    });

    act(() => {
      result.current.updateNotifications((prev) =>
        prev.map((n) => (n.id === 1 ? { ...n, read: true } : n)),
      );
    });

    expect(result.current.unreadCount).toBe(1);
  });

  it("handles removal", () => {
    const { result } = setup({
      data: [notification(1), notification(2)],
      unreadCount: 2,
    });

    act(() => {
      result.current.updateNotifications((prev) =>
        prev.filter((n) => n.id !== 1),
      );
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  it("drops the count to zero when everything is read", () => {
    const { result } = setup({
      data: [notification(1), notification(2)],
      unreadCount: 2,
    });

    act(() => {
      result.current.updateNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true })),
      );
    });

    expect(result.current.unreadCount).toBe(0);
  });
});

describe("click handling", () => {
  it("routes clicks to the registered handler", () => {
    const { result } = setup();
    const handler = jest.fn();

    act(() => result.current.setNotificationClickHandler(handler));
    act(() => result.current.onNotificationClick?.(notification(1)));

    expect(handler).toHaveBeenCalledWith(notification(1));
  });

  it("warns when no handler has been registered", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = setup();

    act(() => result.current.onNotificationClick?.(notification(1)));

    expect(warn).toHaveBeenCalledWith("No notification click handler set");
    warn.mockRestore();
  });

  it("uses the most recently registered handler", () => {
    const { result } = setup();
    const first = jest.fn();
    const second = jest.fn();

    act(() => result.current.setNotificationClickHandler(first));
    act(() => result.current.setNotificationClickHandler(second));
    act(() => result.current.onNotificationClick?.(notification(1)));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
