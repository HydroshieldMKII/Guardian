import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone =
  "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

const TONE_PILL: Record<Tone, string> = {
  neutral: "border-border/70 bg-muted/60 text-muted-foreground",
  positive:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  accent:
    "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  accent: "bg-violet-500",
};

const TONE_RAIL: Record<Tone, string> = {
  neutral: "bg-border",
  positive: "bg-emerald-500/70",
  warning: "bg-amber-500/70",
  danger: "bg-rose-500/70",
  info: "bg-sky-500/70",
  accent: "bg-violet-500/70",
};

export function EntityCard({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tone?: Tone }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] transition-opacity duration-200",
          TONE_RAIL[tone],
        )}
      />
      {children}
    </div>
  );
}

export function EntityHeader({
  title,
  subtitle,
  status,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
          {title}
        </h4>
        {subtitle && (
          <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {status && <div className="flex shrink-0 items-center">{status}</div>}
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5",
        "text-[11px] font-medium leading-5 sm:text-xs",
        TONE_PILL[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
        />
      )}
      {children}
    </span>
  );
}

export function PillRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

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
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

export function ActionBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
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
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

export function ModalShell({
  title,
  description,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4", className)}>
      {children}
    </div>
  );
}
