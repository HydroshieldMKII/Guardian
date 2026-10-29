import {
  PALETTES,
  SYSTEM_DARK_QUERY,
  bootTheme,
  isPalette,
  isTheme,
  isThemeMode,
  themeBootScript,
} from "@/lib/theme";

const boot = bootTheme;
const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.className = "";
  root.removeAttribute("data-palette");
});

describe("theme guards", () => {
  it.each([
    ["light", true],
    ["dark", true],
    ["sepia", false],
    [null, false],
  ])("isTheme(%s) is %s", (value, expected) => {
    expect(isTheme(value)).toBe(expected);
  });

  it.each([
    ["system", true],
    ["light", true],
    ["auto", false],
  ])("isThemeMode(%s) is %s", (value, expected) => {
    expect(isThemeMode(value)).toBe(expected);
  });

  it("lists graphite first", () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual([
      "graphite",
      "warm",
      "slate",
    ]);
  });

  it("accepts every listed palette and nothing else", () => {
    for (const palette of PALETTES) expect(isPalette(palette.id)).toBe(true);
    expect(isPalette("neon")).toBe(false);
    expect(isPalette(undefined)).toBe(false);
  });
});

describe("bootTheme", () => {
  it("starts dark and graphite with nothing stored", () => {
    boot();

    expect(root.className).toBe("dark");
    expect(root.dataset.palette).toBe("graphite");
  });

  it("applies the stored mode and palette before React loads", () => {
    localStorage.setItem("guardian-ui-theme", "light");
    localStorage.setItem("guardian-ui-palette", "slate");

    boot();

    expect(root.className).toBe("light");
    expect(root.dataset.palette).toBe("slate");
  });

  it("ignores values it does not know", () => {
    localStorage.setItem("guardian-ui-theme", "sepia");
    localStorage.setItem("guardian-ui-palette", "neon");

    boot();

    expect(root.className).toBe("dark");
    expect(root.dataset.palette).toBe("graphite");
  });

  it("keeps other classes on the root element", () => {
    root.classList.add("keep", "light");

    boot();

    expect(root.classList.contains("keep")).toBe(true);
    expect(root.classList.contains("light")).toBe(false);
  });

  it.each([
    [true, "dark"],
    [false, "light"],
  ])(
    "follows the device in auto mode (prefers dark: %s)",
    (prefersDark, expected) => {
      localStorage.setItem("guardian-ui-theme", "system");
      const query = {
        ...window.matchMedia(SYSTEM_DARK_QUERY),
        matches: prefersDark,
      };
      const matchMedia = jest
        .spyOn(window, "matchMedia")
        .mockReturnValue(query);

      boot();

      expect(root.className).toBe(expected);
      matchMedia.mockRestore();
    },
  );

  it("still paints the defaults when storage is blocked", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    boot();

    expect(root.className).toBe("dark");
    expect(root.dataset.palette).toBe("graphite");
    getItem.mockRestore();
  });
});

describe("themeBootScript", () => {
  it("inlines the boot function with its settings", () => {
    expect(themeBootScript).toContain("guardian-ui-theme");
    expect(themeBootScript).toContain("guardian-ui-palette");
    expect(themeBootScript).toContain(SYSTEM_DARK_QUERY);
    expect(themeBootScript.startsWith("((")).toBe(true);
  });
});
