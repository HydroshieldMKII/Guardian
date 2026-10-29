import { renderHook } from "@testing-library/react";
import { useBrowserLeaveGuard } from "@/hooks/settings/useBrowserLeaveGuard";

let pushState: jest.SpyInstance;
let go: jest.SpyInstance;
let back: jest.SpyInstance;

beforeEach(() => {
  window.history.replaceState(null, "", window.location.href);
  pushState = jest.spyOn(window.history, "pushState");
  go = jest.spyOn(window.history, "go").mockImplementation(() => undefined);
  back = jest.spyOn(window.history, "back").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const unload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe("useBrowserLeaveGuard", () => {
  it("does nothing while there is nothing to lose", () => {
    const onBack = jest.fn();
    renderHook(() => useBrowserLeaveGuard(false, onBack));

    expect(unload().defaultPrevented).toBe(false);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBack).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("asks the browser to confirm closing or reloading", () => {
    renderHook(() => useBrowserLeaveGuard(true, jest.fn()));

    expect(unload().defaultPrevented).toBe(true);
  });

  it("holds the page in place and reports a Back press", () => {
    const onBack = jest.fn();
    renderHook(() => useBrowserLeaveGuard(true, onBack));
    pushState.mockClear();

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("stops guarding once the changes are gone", () => {
    const onBack = jest.fn();
    const { rerender } = renderHook(
      ({ active }) => useBrowserLeaveGuard(active, onBack),
      { initialProps: { active: true } },
    );

    rerender({ active: false });

    expect(unload().defaultPrevented).toBe(false);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBack).not.toHaveBeenCalled();
  });

  it("keeps the page state on the entry it holds", () => {
    window.history.replaceState({ page: "settings" }, "", window.location.href);
    renderHook(() => useBrowserLeaveGuard(true, jest.fn()));

    expect(window.history.state).toMatchObject({ page: "settings" });
  });

  it("removes the entry it held once the changes are gone", () => {
    const { rerender } = renderHook(
      ({ active }) => useBrowserLeaveGuard(active, jest.fn()),
      { initialProps: { active: true } },
    );

    rerender({ active: false });

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("leaves history alone when another page took over the entry", () => {
    const { rerender } = renderHook(
      ({ active }) => useBrowserLeaveGuard(active, jest.fn()),
      { initialProps: { active: true } },
    );
    window.history.replaceState({ page: "other" }, "", window.location.href);

    rerender({ active: false });

    expect(back).not.toHaveBeenCalled();
  });

  it("leaves history alone when it never held an entry", () => {
    const { rerender } = renderHook(
      ({ active }) => useBrowserLeaveGuard(active, jest.fn()),
      { initialProps: { active: false } },
    );

    rerender({ active: false });

    expect(back).not.toHaveBeenCalled();
  });

  it("leaves history alone on unmount", () => {
    const { unmount } = renderHook(() => useBrowserLeaveGuard(true, jest.fn()));

    unmount();

    expect(back).not.toHaveBeenCalled();
  });

  it("does not stack another history entry when the callback changes", () => {
    const { rerender } = renderHook(
      ({ onBack }: { onBack: () => void }) =>
        useBrowserLeaveGuard(true, onBack),
      { initialProps: { onBack: () => undefined } },
    );

    rerender({ onBack: () => undefined });

    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("leaves the page without being intercepted again", () => {
    const onBack = jest.fn();
    const { result } = renderHook(() => useBrowserLeaveGuard(true, onBack));

    result.current.leaveHistory();

    expect(go).toHaveBeenCalledWith(-2);
    expect(unload().defaultPrevented).toBe(false);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBack).not.toHaveBeenCalled();
  });

  it("does not remove the held entry twice after leaving", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useBrowserLeaveGuard(active, jest.fn()),
      { initialProps: { active: true } },
    );

    result.current.leaveHistory();
    rerender({ active: false });

    expect(go).toHaveBeenCalledWith(-2);
    expect(back).not.toHaveBeenCalled();
  });

  it("takes one step when the held entry is already gone", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useBrowserLeaveGuard(active, jest.fn()),
      { initialProps: { active: true } },
    );

    rerender({ active: false });
    result.current.leaveHistory();

    expect(back).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(-1);
  });
});
