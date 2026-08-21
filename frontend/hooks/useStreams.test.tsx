import { act, renderHook, waitFor } from "@testing-library/react";
import { PlexSession, StreamsResponse } from "@/types";
import { useStreamActions, useStreamsData } from "./useStreams";

const toast = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const stream = (overrides: Partial<PlexSession> = {}): PlexSession =>
  ({
    sessionKey: "sk-1",
    User: { id: "u1", title: "vincent" },
    Player: { machineIdentifier: "dev-1", title: "Living Room TV" },
    ...overrides,
  }) as PlexSession;

const payload = (...sessions: PlexSession[]): StreamsResponse =>
  ({
    MediaContainer: { size: sessions.length, Metadata: sessions },
  }) as StreamsResponse;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;
  fetchMock.mockImplementation(async () => jsonResponse(payload(stream())));
});

describe("useStreamsData", () => {
  it("starts empty and idle", () => {
    const { result } = renderHook(() => useStreamsData());

    expect(result.current.streams).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads the active sessions", async () => {
    const { result } = renderHook(() => useStreamsData());

    await act(async () => {
      await result.current.fetchStreamsData();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/pg/sessions/active");
    expect(result.current.streams).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it("treats an empty container as no streams", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}));
    const { result } = renderHook(() => useStreamsData());

    await act(async () => {
      await result.current.fetchStreamsData();
    });

    expect(result.current.streams).toEqual([]);
  });

  it("reports a server error", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({}, { status: 500 }),
    );
    const { result } = renderHook(() => useStreamsData());

    await act(async () => {
      await result.current.fetchStreamsData();
    });

    expect(result.current.error).toBe("Failed to fetch streams data");
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useStreamsData());

    await act(async () => {
      await result.current.fetchStreamsData();
    });

    expect(result.current.error).toBe(
      "Network error. Please check your connection.",
    );
  });

  it("clears a previous error on a successful reload", async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({}, { status: 500 }),
    );
    const { result } = renderHook(() => useStreamsData());

    await act(async () => {
      await result.current.fetchStreamsData();
    });
    await act(async () => {
      await result.current.fetchStreamsData();
    });

    expect(result.current.error).toBeNull();
  });

  it("accepts streams pushed in from a parent", () => {
    const { result } = renderHook(() => useStreamsData());

    act(() => {
      result.current.updateStreamsFromProps(payload(stream(), stream()));
    });

    expect(result.current.streams).toHaveLength(2);
  });

  it("ignores an undefined push", async () => {
    const { result } = renderHook(() => useStreamsData());

    act(() => {
      result.current.updateStreamsFromProps(payload(stream()));
    });
    act(() => {
      result.current.updateStreamsFromProps(undefined);
    });

    expect(result.current.streams).toHaveLength(1);
  });

  it("clears the error when a parent pushes fresh data", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({}, { status: 500 }),
    );
    const { result } = renderHook(() => useStreamsData());

    await act(async () => {
      await result.current.fetchStreamsData();
    });
    act(() => {
      result.current.updateStreamsFromProps(payload(stream()));
    });

    expect(result.current.error).toBeNull();
  });

  it("exposes setters for direct control", () => {
    const { result } = renderHook(() => useStreamsData());

    act(() => {
      result.current.setStreams([stream()]);
      result.current.setError("manual");
    });

    expect(result.current.streams).toHaveLength(1);
    expect(result.current.error).toBe("manual");
  });
});

describe("useStreamActions", () => {
  it("starts with nothing being revoked", () => {
    const { result } = renderHook(() => useStreamActions());
    expect(result.current.revokingAuth).toBeNull();
  });

  it("revokes access for the stream's user and device", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ message: "ok" }));
    const { result } = renderHook(() => useStreamActions());

    let revoked: boolean | undefined;
    await act(async () => {
      revoked = await result.current.revokeDeviceAuthorization(stream());
    });

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pg/devices/revoke/u1/dev-1",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("url-encodes ids that need it", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ message: "ok" }));
    const { result } = renderHook(() => useStreamActions());

    await act(async () => {
      await result.current.revokeDeviceAuthorization(
        stream({
          User: { id: "u/1", title: "vincent" },
          Player: { machineIdentifier: "dev 1", title: "TV" },
        } as Partial<PlexSession>),
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pg/devices/revoke/u%2F1/dev%201",
      expect.anything(),
    );
  });

  it("confirms the revocation to the user", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ message: "ok" }));
    const { result } = renderHook(() => useStreamActions());

    await act(async () => {
      await result.current.revokeDeviceAuthorization(stream());
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Access Revoked",
        variant: "success",
      }),
    );
  });

  it("clears the in-flight marker when it finishes", async () => {
    const { result } = renderHook(() => useStreamActions());

    await act(async () => {
      await result.current.revokeDeviceAuthorization(stream());
    });

    await waitFor(() => expect(result.current.revokingAuth).toBeNull());
  });

  it("refuses a stream with no user id", async () => {
    const { result } = renderHook(() => useStreamActions());

    let revoked: boolean | undefined;
    await act(async () => {
      revoked = await result.current.revokeDeviceAuthorization(
        stream({ User: undefined }),
      );
    });

    expect(revoked).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("refuses a stream with no device identifier", async () => {
    const { result } = renderHook(() => useStreamActions());

    let revoked: boolean | undefined;
    await act(async () => {
      revoked = await result.current.revokeDeviceAuthorization(
        stream({ Player: undefined }),
      );
    });

    expect(revoked).toBe(false);
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ message: "device is busy" }, { status: 400 }),
    );
    const { result } = renderHook(() => useStreamActions());

    let revoked: boolean | undefined;
    await act(async () => {
      revoked = await result.current.revokeDeviceAuthorization(stream());
    });

    expect(revoked).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Revocation Failed",
        description: "device is busy",
      }),
    );
  });

  it("falls back to the status code when the error body is unreadable", async () => {
    fetchMock.mockImplementation(
      async () => new Response("not json", { status: 502 }),
    );
    const { result } = renderHook(() => useStreamActions());

    await act(async () => {
      await result.current.revokeDeviceAuthorization(stream());
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Failed to revoke device access. Server returned 502.",
      }),
    );
  });

  it("falls back to a generic message when the error body has none", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, { status: 400 }));
    const { result } = renderHook(() => useStreamActions());

    await act(async () => {
      await result.current.revokeDeviceAuthorization(stream());
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Failed to revoke device access.",
      }),
    );
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useStreamActions());

    let revoked: boolean | undefined;
    await act(async () => {
      revoked = await result.current.revokeDeviceAuthorization(stream());
    });

    expect(revoked).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Network Error" }),
    );
  });
});
