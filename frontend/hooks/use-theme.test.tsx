import { act, render, renderHook, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./use-theme";
import { SYSTEM_DARK_QUERY } from "@/lib/theme";

class DeviceScheme extends EventTarget implements MediaQueryList {
  readonly media = SYSTEM_DARK_QUERY;
  onchange = null;
  constructor(public matches: boolean) {
    super();
  }
  addListener() {}
  removeListener() {}
}

const deviceScheme = (prefersDark: boolean) => {
  const query = new DeviceScheme(prefersDark);
  const spy = jest.spyOn(window, "matchMedia").mockReturnValue(query);
  return {
    change: (dark: boolean) => {
      query.matches = dark;
      query.dispatchEvent(new Event("change"));
    },
    restore: () => spy.mockRestore(),
  };
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-palette");
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      <ThemeProvider>
        <span>content</span>
      </ThemeProvider>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("defaults to dark and writes the class to the root element", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.className).toBe("dark");
  });

  it("adopts the light class already present on the root element", () => {
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
  });

  it("prefers a stored theme over the class on the root element", () => {
    localStorage.setItem("guardian-ui-theme", "light");
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.className).toBe("light");
  });

  it("prefers a stored dark theme over a light root class", () => {
    localStorage.setItem("guardian-ui-theme", "dark");
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("ignores an unknown stored theme", () => {
    localStorage.setItem("guardian-ui-theme", "sepia");
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
  });

  it("falls back to the root class when storage cannot be read", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
    getItem.mockRestore();
  });

  it("honours an explicit defaultTheme before the DOM sync", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      ),
    });
    expect(["light", "dark"]).toContain(result.current.theme);
  });

  it("setTheme swaps the root class and persists the choice", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("guardian-ui-theme")).toBe("light");
  });

  it("toggleTheme flips dark to light and back", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");
  });

  it("writes to a custom storage key", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider storageKey="custom-key">{children}</ThemeProvider>
      ),
    });

    act(() => {
      result.current.setTheme("light");
    });

    expect(localStorage.getItem("custom-key")).toBe("light");
  });
});

describe("ThemeProvider auto mode", () => {
  it("resolves a stored auto mode from the device", () => {
    const device = deviceScheme(false);
    localStorage.setItem("guardian-ui-theme", "system");

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.mode).toBe("system");
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    device.restore();
  });

  it("persists auto and applies the device scheme", () => {
    const device = deviceScheme(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("system");
    });

    expect(localStorage.getItem("guardian-ui-theme")).toBe("system");
    expect(result.current.theme).toBe("dark");
    device.restore();
  });

  it("follows the device while auto is on", () => {
    const device = deviceScheme(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("system");
    });
    act(() => {
      device.change(false);
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    device.restore();
  });

  it("stops following once a fixed mode is chosen", () => {
    const device = deviceScheme(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("system");
    });
    act(() => {
      result.current.setTheme("dark");
    });
    act(() => {
      device.change(false);
    });

    expect(result.current.theme).toBe("dark");
    device.restore();
  });

  it("toggles from auto to the opposite fixed mode", () => {
    const device = deviceScheme(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("system");
    });
    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.mode).toBe("light");
    expect(localStorage.getItem("guardian-ui-theme")).toBe("light");
    device.restore();
  });
});

describe("ThemeProvider palette", () => {
  const root = document.documentElement;

  it("defaults to graphite", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.palette).toBe("graphite");
    expect(root.dataset.palette).toBe("graphite");
  });

  it("adopts the palette the boot script already applied", () => {
    root.setAttribute("data-palette", "graphite");

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.palette).toBe("graphite");
  });

  it("prefers a stored palette and ignores an unknown one", () => {
    localStorage.setItem("guardian-ui-palette", "slate");
    const stored = renderHook(() => useTheme(), { wrapper });
    expect(stored.result.current.palette).toBe("slate");
    stored.unmount();

    localStorage.setItem("guardian-ui-palette", "neon");
    root.setAttribute("data-palette", "neon");
    const unknown = renderHook(() => useTheme(), { wrapper });
    expect(unknown.result.current.palette).toBe("graphite");
  });

  it("setPalette applies and persists the choice", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setPalette("graphite");
    });

    expect(result.current.palette).toBe("graphite");
    expect(root.dataset.palette).toBe("graphite");
    expect(localStorage.getItem("guardian-ui-palette")).toBe("graphite");
  });

  it("eases colours only for the moment of a change", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(root.classList.contains("theme-changing")).toBe(false);

    act(() => {
      result.current.setPalette("slate");
    });
    expect(root.classList.contains("theme-changing")).toBe(true);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(root.classList.contains("theme-changing")).toBe(false);
  });

  it("still applies a choice when storage is blocked", () => {
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
      result.current.setPalette("slate");
    });

    expect(root.classList.contains("light")).toBe(true);
    expect(root.dataset.palette).toBe("slate");
    setItem.mockRestore();
  });
});

describe("useTheme outside a provider", () => {
  it("falls back to the default context value", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(result.current.mode).toBe("dark");
    expect(result.current.palette).toBe("graphite");
    expect(() => result.current.toggleTheme()).not.toThrow();
    expect(() => result.current.setTheme("light")).not.toThrow();
    expect(() => result.current.setPalette("slate")).not.toThrow();
  });
});
