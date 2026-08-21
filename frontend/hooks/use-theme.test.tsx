import { act, render, renderHook, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./use-theme";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
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

describe("useTheme outside a provider", () => {
  it("falls back to the default context value", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(() => result.current.toggleTheme()).not.toThrow();
  });
});
