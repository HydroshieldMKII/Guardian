"use client";

import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export type AuthLayoutAlign = "center" | "top";

const ALIGN_CLASSES: Record<AuthLayoutAlign, string> = {
  center: "items-center py-16",
  top: "items-start pt-[max(4rem,calc(50dvh_-_12rem))] pb-16",
};

export function AuthLayout({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: AuthLayoutAlign;
}) {
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <main
      className={cn(
        "relative flex min-h-dvh justify-center overflow-hidden bg-background px-4",
        ALIGN_CLASSES[align],
      )}
    >
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
