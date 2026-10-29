import React from "react";
import { act, renderHook } from "@testing-library/react";
import {
  DashboardNavProvider,
  dashboardHref,
  useDashboardNav,
} from "@/contexts/dashboard-nav-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DashboardNavProvider>{children}</DashboardNavProvider>
);

describe("dashboard nav context", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useDashboardNav(), { wrapper });

    expect(result.current).toMatchObject({
      view: null,
      pendingDevices: 0,
      activeStreams: 0,
    });
  });

  it("publishes the dashboard state", () => {
    const { result } = renderHook(() => useDashboardNav(), { wrapper });

    act(() =>
      result.current.publish({
        view: "users",
        pendingDevices: 2,
        activeStreams: 1,
      }),
    );

    expect(result.current).toMatchObject({
      view: "users",
      pendingDevices: 2,
      activeStreams: 1,
    });
  });

  it("keeps the same value when nothing changed", () => {
    const { result } = renderHook(() => useDashboardNav(), { wrapper });
    const state = {
      view: "streams" as const,
      pendingDevices: 1,
      activeStreams: 3,
    };

    act(() => result.current.publish(state));
    const first = result.current;
    act(() => result.current.publish({ ...state }));

    expect(result.current).toBe(first);
  });

  it.each([
    [{ view: "users" as const, pendingDevices: 1, activeStreams: 3 }],
    [{ view: "streams" as const, pendingDevices: 2, activeStreams: 3 }],
    [{ view: "streams" as const, pendingDevices: 1, activeStreams: 4 }],
  ])("updates when any field changes %#", (next) => {
    const { result } = renderHook(() => useDashboardNav(), { wrapper });

    act(() =>
      result.current.publish({
        view: "streams",
        pendingDevices: 1,
        activeStreams: 3,
      }),
    );
    const first = result.current;
    act(() => result.current.publish(next));

    expect(result.current).not.toBe(first);
    expect(result.current).toMatchObject(next);
  });

  it("does nothing outside a provider", () => {
    const { result } = renderHook(() => useDashboardNav());

    act(() =>
      result.current.publish({
        view: "users",
        pendingDevices: 5,
        activeStreams: 5,
      }),
    );

    expect(result.current).toMatchObject({
      view: null,
      pendingDevices: 0,
      activeStreams: 0,
    });
  });

  it.each([
    ["streams", "/?view=streams"],
    ["users", "/?view=users"],
  ] as const)("links to the %s view", (view, href) => {
    expect(dashboardHref(view)).toBe(href);
  });
});
