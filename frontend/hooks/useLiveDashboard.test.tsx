import { act, renderHook, waitFor } from "@testing-library/react";
import {
  DASHBOARD_EVENT,
  NOTIFICATIONS_EVENT,
  LIVE_URL,
  useLiveDashboard,
  useLiveEvent,
} from "./useLiveDashboard";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static shouldThrow = false;

  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
  private listeners = new Map<string, (event: MessageEvent<string>) => void>();

  constructor(
    public url: string,
    public init?: EventSourceInit,
  ) {
    if (FakeEventSource.shouldThrow) {
      throw new Error("blocked");
    }
    FakeEventSource.instances.push(this);
  }

  addEventListener(
    event: string,
    handler: (event: MessageEvent<string>) => void,
  ) {
    this.listeners.set(event, handler);
  }

  emit(event: string, data: string) {
    act(() => {
      this.listeners.get(event)?.({ data } as MessageEvent<string>);
    });
  }

  open() {
    act(() => this.onopen?.());
  }

  fail() {
    act(() => this.onerror?.());
  }
}

const latest = () =>
  FakeEventSource.instances[FakeEventSource.instances.length - 1];

beforeEach(() => {
  FakeEventSource.instances = [];
  FakeEventSource.shouldThrow = false;
  global.EventSource = FakeEventSource as unknown as typeof EventSource;
});

describe("connection", () => {
  it("subscribes to the live endpoint with credentials", () => {
    renderHook(() => useLiveDashboard(jest.fn()));

    expect(latest().url).toBe(LIVE_URL);
    expect(latest().init).toEqual({ withCredentials: true });
  });

  it("starts disconnected until the stream opens", () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    expect(result.current.connected).toBe(false);
  });

  it("reports a live stream once it opens", async () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    latest().open();

    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it("reports the drop when the stream errors", async () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    latest().open();
    await waitFor(() => expect(result.current.connected).toBe(true));

    latest().fail();
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  it("treats an arriving event as proof the stream is live", async () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    latest().emit(DASHBOARD_EVENT, JSON.stringify({ stats: {} }));

    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it("opens nothing while disabled", () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn(), false));

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.connected).toBe(false);
  });

  it("subscribes once it becomes enabled", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useLiveDashboard(jest.fn(), enabled),
      { initialProps: { enabled: false } },
    );

    expect(FakeEventSource.instances).toHaveLength(0);

    rerender({ enabled: true });
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("survives a stream the browser refuses to open", () => {
    FakeEventSource.shouldThrow = true;

    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    expect(result.current.connected).toBe(false);
  });

  it("stays offline where EventSource is unavailable", () => {
    const original = global.EventSource;
    // @ts-expect-error - exercising a runtime without EventSource
    delete global.EventSource;

    const { result } = renderHook(() => useLiveDashboard(jest.fn()));
    expect(result.current.connected).toBe(false);

    global.EventSource = original;
  });
});

describe("updates", () => {
  it("hands each pushed payload to the caller", () => {
    const onUpdate = jest.fn();
    renderHook(() => useLiveDashboard(onUpdate));

    latest().emit(DASHBOARD_EVENT, JSON.stringify({ stats: { total: 3 } }));

    expect(onUpdate).toHaveBeenCalledWith({ stats: { total: 3 } });
  });

  it("exposes the most recent payload", async () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    latest().emit(DASHBOARD_EVENT, JSON.stringify({ n: 1 }));
    latest().emit(DASHBOARD_EVENT, JSON.stringify({ n: 2 }));

    await waitFor(() => expect(result.current.lastUpdate).toEqual({ n: 2 }));
  });

  it("holds nothing before the first push", () => {
    const { result } = renderHook(() => useLiveDashboard(jest.fn()));

    expect(result.current.lastUpdate).toBeNull();
  });

  it("ignores a frame it cannot parse", () => {
    const onUpdate = jest.fn();
    const { result } = renderHook(() => useLiveDashboard(onUpdate));

    latest().emit(DASHBOARD_EVENT, "not json");

    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.current.lastUpdate).toBeNull();
  });

  it("calls the latest handler without resubscribing", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ handler }) => useLiveDashboard(handler),
      { initialProps: { handler: first } },
    );

    rerender({ handler: second });
    latest().emit(DASHBOARD_EVENT, JSON.stringify({ ok: true }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});

describe("event names", () => {
  it("delivers only the subscribed event to the caller", () => {
    const onUpdate = jest.fn();
    renderHook(() => useLiveEvent(NOTIFICATIONS_EVENT, onUpdate));

    latest().emit(DASHBOARD_EVENT, JSON.stringify({ stats: {} }));
    latest().emit(NOTIFICATIONS_EVENT, JSON.stringify([{ id: 1 }]));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it("keeps the dashboard hook on the dashboard event", () => {
    const onUpdate = jest.fn();
    renderHook(() => useLiveDashboard(onUpdate));

    latest().emit(NOTIFICATIONS_EVENT, JSON.stringify([{ id: 1 }]));

    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("teardown", () => {
  it("closes the stream on unmount", () => {
    const { unmount } = renderHook(() => useLiveDashboard(jest.fn()));
    const source = latest();

    unmount();

    expect(source.close).toHaveBeenCalled();
  });

  it("closes the stream when it becomes disabled", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useLiveDashboard(jest.fn(), enabled),
      { initialProps: { enabled: true } },
    );
    const source = latest();

    rerender({ enabled: false });

    expect(source.close).toHaveBeenCalled();
  });
});
