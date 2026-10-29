"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  SYSTEM_DARK_QUERY,
  THEME_STORAGE_KEY,
  isPalette,
  isThemeMode,
  resolveTheme,
  type Palette,
  type Theme,
  type ThemeMode,
} from "@/lib/theme";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  paletteStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  mode: "dark",
  setTheme: () => null,
  toggleTheme: () => null,
  palette: DEFAULT_PALETTE,
  setPalette: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const THEME_CHANGE_MS = 350;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

const easeThemeChange = () => {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  clearTimeout(settleTimer);
  settleTimer = setTimeout(
    () => root.classList.remove("theme-changing"),
    THEME_CHANGE_MS,
  );
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
};

const applyPalette = (palette: Palette) => {
  document.documentElement.setAttribute("data-palette", palette);
};

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = THEME_STORAGE_KEY,
  paletteStorageKey = PALETTE_STORAGE_KEY,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(defaultTheme);
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    const root = document.documentElement;
    const stored = readStored(storageKey);
    const fromDom = root.classList.contains("light") ? "light" : "dark";
    const nextMode = isThemeMode(stored) ? stored : fromDom;
    const nextTheme = resolveTheme(nextMode);
    applyTheme(nextTheme);
    setModeState(nextMode);
    setThemeState(nextTheme);

    const storedPalette = readStored(paletteStorageKey);
    const domPalette = root.getAttribute("data-palette");
    const nextPalette = isPalette(storedPalette)
      ? storedPalette
      : isPalette(domPalette)
        ? domPalette
        : DEFAULT_PALETTE;
    applyPalette(nextPalette);
    setPaletteState(nextPalette);
  }, [storageKey, paletteStorageKey]);

  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const follow = () => {
      const next = resolveTheme("system");
      easeThemeChange();
      applyTheme(next);
      setThemeState(next);
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [mode]);

  const setTheme = (next: ThemeMode) => {
    const resolved = resolveTheme(next);
    writeStored(storageKey, next);
    easeThemeChange();
    applyTheme(resolved);
    setModeState(next);
    setThemeState(resolved);
  };

  const setPalette = (next: Palette) => {
    writeStored(paletteStorageKey, next);
    easeThemeChange();
    applyPalette(next);
    setPaletteState(next);
  };

  const value: ThemeProviderState = {
    theme,
    mode,
    setTheme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    palette,
    setPalette,
  };

  return React.createElement(
    ThemeProviderContext.Provider,
    { value },
    children,
  );
}

export const useTheme = () => useContext(ThemeProviderContext);
