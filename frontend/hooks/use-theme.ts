"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  toggleTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "guardian-ui-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      
      // Get theme from localStorage or use default
      const storedTheme = localStorage.getItem(storageKey) as Theme;
      const initialTheme = storedTheme || defaultTheme;
      
      setTheme(initialTheme);
      
      // Apply theme class to document
      root.classList.remove("light", "dark");
      root.classList.add(initialTheme);
    }
  }, [storageKey, defaultTheme]);

  const updateTheme = (newTheme: Theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, newTheme);
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(newTheme);
    }
    setTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    updateTheme(newTheme);
  };

  const value = {
    theme,
    setTheme: updateTheme,
    toggleTheme,
  };

  return React.createElement(
    ThemeProviderContext.Provider,
    { value },
    children
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};