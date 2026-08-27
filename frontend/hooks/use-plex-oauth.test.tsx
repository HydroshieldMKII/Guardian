import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { usePlexOAuth, type PlexOAuthCopy } from "@/hooks/use-plex-oauth";

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

const copy: PlexOAuthCopy = {
  success: { title: "Linked", description: "all set" },
  failed: { title: "Failed", description: "generic failure" },
  expired: { title: "Expired", description: "timed out" },
  cancelled: { title: "Cancelled", description: "window closed" },
};

const Harness = ({
  onAuthenticated,
  redirectWhenPopupIsUnavailable,
}: {
  onAuthenticated: (token: string) => Promise<void>;
  redirectWhenPopupIsUnavailable?: boolean;
}) => {
  const plex = usePlexOAuth({
    copy,
    onAuthenticated,
    redirectWhenPopupIsUnavailable,
  });

  return (
    <div>
      <button onClick={() => void plex.start()}>start</button>
      <button onClick={() => plex.cancel()}>cancel</button>
      <span data-testid="loading">{String(plex.loading)}</span>
      <span data-testid="waiting">{String(plex.waiting)}</span>
    </div>
  );
};

const fetchMock = jest.fn();
const onAuthenticated = jest.fn();

let consoleError: jest.SpyInstance;
let popup: Window;
let close: jest.Mock;

const setClosed = (target: Window, closed: boolean) =>
  Object.defineProperty(target, "closed", {
    value: closed,
    writable: true,
    configurable: true,
  });

const makePopup = (): Window => {
  const created: Window = Object.create(window);
  setClosed(created, false);
  close = jest.fn();
  created.close = close;
  return created;
};

const expiry = () => new Date(Date.now() + 600_000).toISOString();

const pinResponse = (statusBody: unknown, expiresAt = expiry()) => {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/api/pg/auth/plex/pin" && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 1,
          code: "ABCD",
          clientId: "c-1",
          expiresAt,
        }),
      });
    }
    if (statusBody instanceof Error) return Promise.reject(statusBody);
    return Promise.resolve(statusBody);
  });
};

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const renderHarness = (props: Partial<ComponentProps<typeof Harness>> = {}) =>
  render(<Harness onAuthenticated={onAuthenticated} {...props} />);

const startFlow = async (
  props: Partial<ComponentProps<typeof Harness>> = {},
) => {
  const view = renderHarness(props);
  fireEvent.click(screen.getByText("start"));
  await flush();
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
  onAuthenticated.mockResolvedValue(undefined);
  popup = makePopup();
  jest.spyOn(window, "open").mockReturnValue(popup);
  sessionStorage.clear();
  pinResponse({ ok: true, json: async () => ({}) });
});

afterEach(() => {
  jest.useRealTimers();
  consoleError.mockRestore();
});

describe("starting the flow", () => {
  it("creates a PIN and opens the Plex window", async () => {
    await startFlow();

    expect(fetchMock).toHaveBeenCalledWith("/api/pg/auth/plex/pin", {
      method: "POST",
    });
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://app.plex.tv/auth#?clientID=c-1"),
      "PlexAuth",
      expect.stringContaining("width=600"),
    );
    expect(screen.getByTestId("waiting")).toHaveTextContent("true");
  });

  it("reports a PIN the server refuses to create", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await startFlow();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed",
        description: "Guardian could not reach Plex. Try again in a moment.",
        variant: "destructive",
      }),
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("falls back to the generic message when the failure carries none", async () => {
    fetchMock.mockRejectedValue("boom");
    await startFlow();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "generic failure" }),
    );
  });

  it("asks the user to allow pop-ups when the window is blocked", async () => {
    jest.spyOn(window, "open").mockReturnValue(null);
    await startFlow();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("Allow pop-ups"),
      }),
    );
    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
  });
});

describe("finishing the flow", () => {
  it("closes the Plex window the moment the token arrives", async () => {
    pinResponse({ ok: true, json: async () => ({ authToken: "tok" }) });
    await startFlow();

    expect(close).toHaveBeenCalled();
    expect(onAuthenticated).toHaveBeenCalledWith("tok");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Linked", variant: "success" }),
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("leaves an already closed window alone", async () => {
    pinResponse({ ok: true, json: async () => ({ authToken: "tok" }) });
    setClosed(popup, true);
    await startFlow();

    expect(close).not.toHaveBeenCalled();
    expect(onAuthenticated).toHaveBeenCalledWith("tok");
  });

  it("reports a sign-in the server refuses", async () => {
    onAuthenticated.mockRejectedValue(new Error("already linked"));
    pinResponse({ ok: true, json: async () => ({ authToken: "tok" }) });
    await startFlow();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed",
        description: "already linked",
        variant: "destructive",
      }),
    );
  });

  it("falls back to the generic message for a non-Error rejection", async () => {
    onAuthenticated.mockRejectedValue("nope");
    pinResponse({ ok: true, json: async () => ({ authToken: "tok" }) });
    await startFlow();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "generic failure" }),
    );
  });

  it("keeps polling while Plex has no token yet", async () => {
    await startFlow();
    await tick(2000);

    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(screen.getByTestId("waiting")).toHaveTextContent("true");
  });

  it("keeps waiting when the PIN lookup is refused", async () => {
    pinResponse({ ok: false });
    await startFlow();
    await tick(2000);

    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("logs a PIN lookup that throws", async () => {
    pinResponse(new Error("offline"));
    await startFlow();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to check Plex PIN:",
      expect.any(Error),
    );
  });

  it("gives up when the PIN expires", async () => {
    await startFlow();
    await tick(600_000);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Expired", variant: "destructive" }),
    );
    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
    expect(close).toHaveBeenCalled();
  });
});

describe("cancelling", () => {
  it("stops the flow and tells the server to drop the PIN", async () => {
    await startFlow();
    fireEvent.click(screen.getByText("cancel"));
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/pg/auth/plex/pin/c-1", {
      method: "DELETE",
    });
    expect(close).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cancelled" }),
    );
    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
  });

  it("stays quiet when there is nothing to cancel", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("cancel"));
    await flush();

    expect(toast).not.toHaveBeenCalled();
  });

  it("survives a server that refuses the cancellation", async () => {
    await startFlow();
    fetchMock.mockRejectedValue(new Error("gone"));

    fireEvent.click(screen.getByText("cancel"));
    await flush();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cancelled" }),
    );
  });

  it("cancels once the user closes the Plex window", async () => {
    await startFlow();

    setClosed(popup, true);
    await tick(500);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cancelled" }),
    );
    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
  });

  it("takes one last look before treating a closed window as cancelled", async () => {
    await startFlow();
    pinResponse({ ok: true, json: async () => ({ authToken: "tok" }) });

    setClosed(popup, true);
    await tick(500);

    expect(onAuthenticated).toHaveBeenCalledWith("tok");
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cancelled" }),
    );
  });

  it("stops polling once the flow is cancelled", async () => {
    await startFlow();
    fireEvent.click(screen.getByText("cancel"));
    await flush();

    const callsBefore = fetchMock.mock.calls.length;
    await tick(10_000);

    expect(fetchMock.mock.calls).toHaveLength(callsBefore);
  });
});

describe("the mobile redirect", () => {
  const asMobile = () =>
    Object.defineProperty(window.navigator, "userAgent", {
      value: "iPhone",
      configurable: true,
    });

  it("stores the PIN and leaves for Plex", async () => {
    asMobile();
    await startFlow({ redirectWhenPopupIsUnavailable: true });

    expect(window.open).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem("plexPin") ?? "null")).toEqual(
      expect.objectContaining({ clientId: "c-1" }),
    );
  });

  it("redirects when the pop-up is blocked instead of failing", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0",
      configurable: true,
    });
    jest.spyOn(window, "open").mockReturnValue(null);

    await startFlow({ redirectWhenPopupIsUnavailable: true });

    expect(sessionStorage.getItem("plexPin")).not.toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it("resumes a stored PIN when the user comes back", async () => {
    sessionStorage.setItem(
      "plexPin",
      JSON.stringify({
        id: 1,
        code: "ABCD",
        clientId: "c-1",
        expiresAt: expiry(),
      }),
    );
    pinResponse({ ok: true, json: async () => ({ authToken: "tok" }) });

    renderHarness({ redirectWhenPopupIsUnavailable: true });
    await flush();

    expect(onAuthenticated).toHaveBeenCalledWith("tok");
    expect(sessionStorage.getItem("plexPin")).toBeNull();
  });

  it("ignores a stored PIN that has already expired", async () => {
    sessionStorage.setItem(
      "plexPin",
      JSON.stringify({
        id: 1,
        code: "ABCD",
        clientId: "c-1",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );

    renderHarness({ redirectWhenPopupIsUnavailable: true });
    await flush();

    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
  });

  it("ignores unreadable stored PIN data", async () => {
    sessionStorage.setItem("plexPin", "not json");

    renderHarness({ redirectWhenPopupIsUnavailable: true });
    await flush();

    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
  });

  it("never looks for a stored PIN when redirects are off", async () => {
    sessionStorage.setItem(
      "plexPin",
      JSON.stringify({
        id: 1,
        code: "ABCD",
        clientId: "c-1",
        expiresAt: expiry(),
      }),
    );

    renderHarness();
    await flush();

    expect(screen.getByTestId("waiting")).toHaveTextContent("false");
    expect(sessionStorage.getItem("plexPin")).not.toBeNull();
  });
});
