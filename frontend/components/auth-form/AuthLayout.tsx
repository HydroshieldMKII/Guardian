"use client";

import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function AuthLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-16">
      <div
        data-testid="auth-backdrop"
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <div className="auth-dots absolute inset-0" />
        <div className="auth-glow absolute inset-0" />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-10 size-9 p-0 hover:bg-accent/50"
      >
        <ThemeIcon className="size-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      <div className="relative flex w-full justify-center">{children}</div>
    </main>
  );
}
