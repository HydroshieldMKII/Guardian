export type Theme = "dark" | "light";
export type ThemeMode = Theme | "system";
export type Palette = "warm" | "graphite" | "slate";

export const THEME_STORAGE_KEY = "guardian-ui-theme";
export const PALETTE_STORAGE_KEY = "guardian-ui-palette";
export const DEFAULT_PALETTE: Palette = "graphite";

interface Swatch {
  background: string;
  card: string;
  ink: string;
}

export const PALETTES: {
  id: Palette;
  label: string;
  description: string;
  swatch: Record<Theme, Swatch>;
}[] = [
  {
    id: "graphite",
    label: "Graphite",
    description: "Neutral greys with no tint",
    swatch: {
      light: { background: "#f2f2f3", card: "#ffffff", ink: "#18181a" },
      dark: { background: "#111112", card: "#1a1a1c", ink: "#e9e9eb" },
    },
  },
  {
    id: "warm",
    label: "Warm",
    description: "Off-white paper and soft charcoal",
    swatch: {
      light: { background: "#f4f3ef", card: "#ffffff", ink: "#1b1a17" },
      dark: { background: "#131312", card: "#1c1c1a", ink: "#ecebe7" },
    },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Cool blue-grey, calm at night",
    swatch: {
      light: { background: "#eef1f5", card: "#fbfcfe", ink: "#141a24" },
      dark: { background: "#0f141b", card: "#171e28", ink: "#e6ebf2" },
    },
  },
];

export const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark";

export const isThemeMode = (value: unknown): value is ThemeMode =>
  isTheme(value) || value === "system";

export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export const systemTheme = (): Theme =>
  window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";

export const resolveTheme = (mode: ThemeMode): Theme =>
  mode === "system" ? systemTheme() : mode;

export const isPalette = (value: unknown): value is Palette =>
  PALETTES.some((palette) => palette.id === value);

export const applyStoredTheme = (
  themeKey: string,
  paletteKey: string,
  palettes: string[],
  fallbackPalette: string,
  darkQuery: string,
) => {
  const read = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const storedTheme = read(themeKey);
  const storedPalette = read(paletteKey);
  let theme = "dark";
  if (storedTheme === "light" || storedTheme === "dark") theme = storedTheme;
  if (storedTheme === "system") {
    theme = window.matchMedia(darkQuery).matches ? "dark" : "light";
  }
  const palette =
    storedPalette && palettes.includes(storedPalette)
      ? storedPalette
      : fallbackPalette;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.setAttribute("data-palette", palette);
};

const bootArgs = [
  THEME_STORAGE_KEY,
  PALETTE_STORAGE_KEY,
  PALETTES.map((palette) => palette.id),
  DEFAULT_PALETTE,
  SYSTEM_DARK_QUERY,
] as const;

export const bootTheme = () => applyStoredTheme(...bootArgs);

export const themeBootScript = `(${applyStoredTheme.toString()})(${bootArgs
  .map((arg) => JSON.stringify(arg))
  .join(",")});`;
