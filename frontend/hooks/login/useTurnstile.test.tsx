import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { TURNSTILE_SCRIPT_ID, type TurnstileApi } from "@/lib/turnstile";
import { useTurnstile } from "./useTurnstile";

const fetchMock = jest.fn();
const turnstile = {
  render: jest.fn<string, Parameters<TurnstileApi["render"]>>(),
  reset: jest.fn<void, [string]>(),
  remove: jest.fn<void, [string]>(),
  getResponse: jest.fn<string, [string]>(),
};

let captcha: ReturnType<typeof useTurnstile>;
const keep = (hook: ReturnType<typeof useTurnstile>) => {
  captcha = hook;
};

function Harness({ theme, mount = true }: { theme: string; mount?: boolean }) {
  const hook = useTurnstile(theme);
  useEffect(() => keep(hook));
  const { siteKey, containerRef } = hook;
  return siteKey && mount ? (
    <div data-testid="captcha" ref={containerRef} />
  ) : null;
}

const respond = (data: unknown, ok = true) =>
  fetchMock.mockResolvedValue({ ok, json: async () => data });

const script = () => document.getElementById(TURNSTILE_SCRIPT_ID);

const renderWithKey = async (theme = "light", mount = true) => {
  respond({ siteKey: "site-key" });
  const view = render(<Harness theme={theme} mount={mount} />);
  await waitFor(() => expect(captcha.siteKey).toBe("site-key"));
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  turnstile.render.mockReturnValue("widget-1");
  turnstile.getResponse.mockReturnValue("token");
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
  window.turnstile = turnstile;
});

afterEach(() => {
  script()?.remove();
  delete window.turnstile;
});

describe("useTurnstile", () => {
  it("renders the widget with the site key and theme", async () => {
    await renderWithKey("dark");

    expect(fetchMock).toHaveBeenCalledWith("/api/pg/auth/turnstile-key");
    expect(turnstile.render).toHaveBeenCalledWith(
      screen.getByTestId("captcha"),
      { sitekey: "site-key", theme: "dark" },
    );
    expect(script()).not.toBeNull();
  });

  it("uses the light theme otherwise", async () => {
    await renderWithKey("system");

    expect(turnstile.render).toHaveBeenCalledWith(expect.anything(), {
      sitekey: "site-key",
      theme: "light",
    });
  });

  it("reads and resets the widget's token", async () => {
    await renderWithKey();

    expect(captcha.token()).toBe("token");
    captcha.reset();
    expect(turnstile.getResponse).toHaveBeenCalledWith("widget-1");
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
  });

  it("removes the widget when it goes away", async () => {
    const { rerender } = await renderWithKey();

    rerender(<Harness theme="dark" />);

    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
    expect(turnstile.render).toHaveBeenCalledTimes(2);
  });

  it("waits for the script to load before rendering", async () => {
    delete window.turnstile;
    const { unmount } = await renderWithKey();
    expect(turnstile.render).not.toHaveBeenCalled();

    act(() => {
      script()?.dispatchEvent(new Event("load"));
    });
    expect(turnstile.render).not.toHaveBeenCalled();

    window.turnstile = turnstile;
    act(() => {
      script()?.dispatchEvent(new Event("load"));
      script()?.dispatchEvent(new Event("load"));
    });
    expect(turnstile.render).toHaveBeenCalledTimes(1);

    delete window.turnstile;
    unmount();
    expect(turnstile.remove).not.toHaveBeenCalled();
  });

  it("does nothing without a place to render", async () => {
    await renderWithKey("light", false);

    expect(script()).toBeNull();
    expect(captcha.token()).toBeUndefined();
  });

  it("stays off without a site key", async () => {
    respond({});
    render(<Harness theme="light" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(captcha.siteKey).toBe("");
    expect(captcha.token()).toBeUndefined();
    expect(captcha.reset()).toBeUndefined();
  });

  it("stays off when the key request is refused", async () => {
    respond({ siteKey: "site-key" }, false);
    render(<Harness theme="light" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(captcha.siteKey).toBe("");
  });

  it("logs a failed key request", async () => {
    const error = new Error("offline");
    fetchMock.mockRejectedValue(error);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness theme="light" />);

    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        "Failed to fetch Turnstile site key:",
        error,
      ),
    );
    log.mockRestore();
  });
});
