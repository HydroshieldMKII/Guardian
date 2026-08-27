import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

const TONE_PANEL: Record<Tone, string> = {
  neutral: "border-border/70 bg-muted/30",
  positive: "border-emerald-500/25 bg-emerald-500/5",
  warning: "border-amber-500/25 bg-amber-500/5",
  danger: "border-rose-500/25 bg-rose-500/5",
  info: "border-sky-500/25 bg-sky-500/5",
  accent: "border-violet-500/25 bg-violet-500/5",
};

const TONE_RAIL: Record<Tone, string> = {
  neutral: "bg-border",
  positive: "bg-emerald-500/70",
  warning: "bg-amber-500/70",
  danger: "bg-rose-500/70",
  info: "bg-sky-500/70",
  accent: "bg-violet-500/70",
};

const TONE_SOLID: Record<Tone, string> = {
  neutral: "bg-foreground text-background hover:bg-foreground/90",
  positive:
    "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500",
  warning:
    "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500",
  info: "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500",
  accent:
    "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500",
};

const TONE_OUTLINE: Record<Tone, string> = {
  neutral: "",
  positive:
    "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400",
  warning:
    "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
  danger:
    "border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400",
  info: "border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400",
  accent:
    "border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-400",
};

const TONE_MENU: Record<Tone, string> = {
  neutral: "",
  positive:
    "text-emerald-700 focus:bg-emerald-500/10 focus:text-emerald-700 dark:text-emerald-400 dark:focus:text-emerald-300",
  warning:
    "text-amber-700 focus:bg-amber-500/10 focus:text-amber-700 dark:text-amber-400 dark:focus:text-amber-300",
  danger:
    "text-rose-600 focus:bg-rose-500/10 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300",
  info: "text-sky-700 focus:bg-sky-500/10 focus:text-sky-700 dark:text-sky-400 dark:focus:text-sky-300",
  accent:
    "text-violet-700 focus:bg-violet-500/10 focus:text-violet-700 dark:text-violet-400 dark:focus:text-violet-300",
};

export function toneButton(
  tone: Tone,
  variant: "solid" | "outline" = "outline",
) {
  return variant === "solid" ? TONE_SOLID[tone] : TONE_OUTLINE[tone];
}

export function toneMenuItem(tone: Tone) {
  return TONE_MENU[tone];
}

export function EntityCard({
  tone = "neutral",
  rail = true,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tone?: Tone; rail?: boolean }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card",
        className,
      )}
      {...props}
    >
      {rail && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-[3px] transition-opacity duration-200",
            TONE_RAIL[tone],
          )}
        />
      )}
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

const PILL_SIZE = {
  default: "gap-1.5 px-2.5 py-0.5 text-[11px] leading-5 sm:text-xs",
  sm: "gap-1 px-2 py-0.5 text-[10px] leading-4",
};

export function StatusPill({
  tone = "neutral",
  size = "default",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  size?: keyof typeof PILL_SIZE;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border font-medium",
        PILL_SIZE[size],
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
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm font-medium text-foreground",
          wrap ? "break-all" : "truncate",
        )}
      >
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

export function CollapsibleSection({
  title,
  open,
  onOpenChange,
  status,
  className,
  children,
}: {
  title: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={className}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 transition-colors duration-200 hover:bg-muted/50">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {status}
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function Panel({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-4", TONE_PANEL[tone], className)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  action,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </Label>
        {action}
      </div>
      {children}
      {hint && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border bg-card p-4",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label
          htmlFor={id}
          className="text-sm font-medium leading-none text-foreground"
        >
          {label}
        </Label>
        {hint && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5 shrink-0 cursor-pointer"
      />
    </div>
  );
}

export function OptionGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-3", className)}>
      {children}
    </div>
  );
}

export function OptionCard({
  selected,
  title,
  description,
  onSelect,
  disabled,
  className,
}: {
  selected: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border p-4 text-left",
        "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/40",
        className,
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium leading-none text-foreground">
          {title}
        </span>
        <span
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 rounded-full border-2 transition-colors duration-200",
            selected
              ? "border-primary bg-primary"
              : "border-muted-foreground/40",
          )}
        />
      </span>
      {description && (
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      )}
    </button>
  );
}

export function SelectRow({
  selected,
  title,
  subtitle,
  onToggle,
  className,
}: {
  selected: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left",
        "transition-colors duration-200",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded transition-colors duration-200",
          selected
            ? "bg-primary text-primary-foreground"
            : "border-2 border-muted-foreground/40",
        )}
      >
        {selected && (
          <svg
            viewBox="0 0 12 12"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6.5l2.5 2.5 4.5-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg border bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  tone = "neutral",
  onRemove,
  removeLabel,
  className,
  children,
}: {
  tone?: Tone;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
        "font-mono text-xs leading-4",
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="cursor-pointer rounded-sm text-current opacity-60 transition-opacity hover:opacity-100"
        >
          <svg
            viewBox="0 0 12 12"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
