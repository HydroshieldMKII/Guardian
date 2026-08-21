import { act, renderHook } from "@testing-library/react";
import { reducer, toast, useToast } from "./use-toast";

type State = Parameters<typeof reducer>[0];

const stateWith = (...ids: string[]): State => ({
  toasts: ids.map((id) => ({ id, open: true })),
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("reducer", () => {
  it("adds a toast to the front", () => {
    const next = reducer(stateWith(), {
      type: "ADD_TOAST",
      toast: { id: "1", open: true },
    });
    expect(next.toasts.map((t) => t.id)).toEqual(["1"]);
  });

  it("enforces the single-toast limit", () => {
    const next = reducer(stateWith("1"), {
      type: "ADD_TOAST",
      toast: { id: "2", open: true },
    });
    expect(next.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("updates only the matching toast", () => {
    const next = reducer(stateWith("1", "2"), {
      type: "UPDATE_TOAST",
      toast: { id: "1", title: "changed" },
    });
    expect(next.toasts[0].title).toBe("changed");
    expect(next.toasts[1].title).toBeUndefined();
  });

  it("ignores an update for an unknown id", () => {
    const next = reducer(stateWith("1"), {
      type: "UPDATE_TOAST",
      toast: { id: "nope", title: "changed" },
    });
    expect(next.toasts[0].title).toBeUndefined();
  });

  it("closes a single toast on dismiss", () => {
    const next = reducer(stateWith("1", "2"), {
      type: "DISMISS_TOAST",
      toastId: "1",
    });
    expect(next.toasts[0].open).toBe(false);
    expect(next.toasts[1].open).toBe(true);
  });

  it("closes every toast when no id is given", () => {
    const next = reducer(stateWith("1", "2"), { type: "DISMISS_TOAST" });
    expect(next.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("removes a single toast", () => {
    const next = reducer(stateWith("1", "2"), {
      type: "REMOVE_TOAST",
      toastId: "1",
    });
    expect(next.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("clears all toasts when no id is given", () => {
    const next = reducer(stateWith("1", "2"), { type: "REMOVE_TOAST" });
    expect(next.toasts).toEqual([]);
  });
});

describe("useToast", () => {
  it("exposes a toast pushed through the store", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "Saved" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Saved");
    expect(result.current.toasts[0].open).toBe(true);
  });

  it("auto-dismisses after the delay", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "Auto" });
    });
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it("keeps a zero-duration toast open", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "Sticky", duration: 0 });
    });
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.toasts[0].open).toBe(true);
  });

  it("removes the toast from state after the removal delay", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "Gone" });
    });
    act(() => {
      jest.advanceTimersByTime(4000 + 1000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismisses on demand via the returned handle", () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast> | undefined;

    act(() => {
      handle = result.current.toast({ title: "Manual" });
    });
    act(() => {
      handle?.dismiss();
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it("updates an existing toast via the returned handle", () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast> | undefined;

    act(() => {
      handle = result.current.toast({ title: "Before" });
    });
    act(() => {
      handle?.update({ id: handle.id, title: "After" });
    });

    expect(result.current.toasts[0].title).toBe("After");
  });

  it("closes the toast when onOpenChange reports a close", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "Radix" });
    });
    act(() => {
      result.current.toasts[0].onOpenChange?.(false);
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it("dismisses everything through the hook helper", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "One" });
    });
    act(() => {
      result.current.dismiss();
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it("hands out unique ids", () => {
    const { result } = renderHook(() => useToast());
    let first: string | undefined;
    let second: string | undefined;

    act(() => {
      first = result.current.toast({ title: "a" }).id;
      second = result.current.toast({ title: "b" }).id;
    });

    expect(first).not.toBe(second);
  });
});
