import * as React from "react";
import { cn } from "@/lib/utils";
import { type Tone, TONE_RAIL } from "./tones";

export function MetaGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Meta({
  label,
  children,
  wrap = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-sm font-medium text-foreground",
          wrap ? "[overflow-wrap:anywhere]" : "truncate",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px]", TONE_RAIL[tone])}
      />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
