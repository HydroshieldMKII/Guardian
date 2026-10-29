"use client";

import { cn } from "@/lib/utils";

const DOT_DELAYS_MS = [0, 160, 320];

export function ThreeDotLoader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex items-center justify-center gap-1.5 animate-in fade-in fill-mode-both delay-200 duration-500 motion-reduce:animate-none",
        className,
      )}
    >
      {DOT_DELAYS_MS.map((delay) => (
        <span
          key={delay}
          className="size-2 rounded-full bg-muted-foreground/70 animate-loader-dot motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center">
      <ThreeDotLoader />
    </div>
  );
}
