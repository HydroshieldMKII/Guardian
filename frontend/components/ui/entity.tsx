import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type Tone =
  "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

const TONE_COLOR: Record<Exclude<Tone, "neutral">, string> = {
  positive: "allowed",
  warning: "waiting",
  danger: "blocked",
  info: "info",
  accent: "special",
};

const TONE_PILL: Record<Tone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  positive: "border-transparent bg-allowed/12 text-allowed",
  warning: "border-transparent bg-waiting/14 text-waiting",
  danger: "border-transparent bg-blocked/12 text-blocked",
  info: "border-transparent bg-info/12 text-info",
  accent: "border-transparent bg-special/12 text-special",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  positive: "bg-allowed",
  warning: "bg-waiting",
  danger: "bg-blocked",
  info: "bg-info",
  accent: "bg-special",
};

const TONE_PANEL: Record<Tone, string> = {
  neutral: "border-border bg-surface/60",
  positive: "border-allowed/20 bg-allowed/6",
  warning: "border-waiting/25 bg-waiting/7",
  danger: "border-blocked/20 bg-blocked/6",
  info: "border-info/20 bg-info/6",
  accent: "border-special/20 bg-special/6",
};

const TONE_RAIL: Record<Tone, string> = {
  neutral: "bg-border",
  positive: "bg-allowed",
  warning: "bg-waiting",
  danger: "bg-blocked",
  info: "bg-info",
  accent: "bg-special",
};

const INK_SOLID = "bg-primary text-primary-foreground hover:bg-primary/88";

const TONE_SOLID: Record<Tone, string> = {
  neutral: INK_SOLID,
  positive: INK_SOLID,
  warning: INK_SOLID,
  danger: "bg-blocked text-white hover:bg-blocked/90 dark:text-background",
  info: INK_SOLID,
  accent: INK_SOLID,
};

const TONE_OUTLINE: Record<Tone, string> = {
  neutral: "",
  positive: "",
  warning: "",
  danger:
    "border-blocked/35 text-blocked hover:border-blocked/60 hover:bg-blocked/8",
  info: "",
  accent: "",
};

const TONE_SEGMENT: Record<Tone, { thumb: string; text: string }> = {
  neutral: {
    thumb:
      "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.1)] ring-1 ring-black/5 dark:bg-foreground/12 dark:ring-white/10",
    text: "text-foreground",
  },
  positive: {
    thumb: "bg-allowed shadow-sm",
    text: "text-white dark:text-background",
  },
  warning: {
    thumb: "bg-waiting shadow-sm",
    text: "text-white dark:text-background",
  },
  danger: {
    thumb: "bg-blocked shadow-sm",
    text: "text-white dark:text-background",
  },
  info: { thumb: "bg-info shadow-sm", text: "text-white dark:text-background" },
  accent: {
    thumb: "bg-special shadow-sm",
    text: "text-white dark:text-background",
  },
};

const TONE_MENU: Record<Tone, string> = {
  neutral: "",
  positive: "text-allowed focus:bg-allowed/10 focus:text-allowed",
  warning: "text-waiting focus:bg-waiting/10 focus:text-waiting",
  danger: "text-blocked focus:bg-blocked/10 focus:text-blocked",
  info: "text-info focus:bg-info/10 focus:text-info",
  accent: "text-special focus:bg-special/10 focus:text-special",
};

export function toneColorVar(tone: Tone) {
  return tone === "neutral"
    ? "var(--muted-foreground)"
    : `var(--${TONE_COLOR[tone]})`;
}

export function toneButton(
  tone: Tone,
  variant: "solid" | "outline" = "outline",
) {
  return variant === "solid" ? TONE_SOLID[tone] : TONE_OUTLINE[tone];
}

export function toneMenuItem(tone: Tone) {
  return TONE_MENU[tone];
}

export function toneTint(tone: Tone) {
  return TONE_PILL[tone];
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
  hint,
  className,
  children,
}: {
  tone?: Tone;
  size?: keyof typeof PILL_SIZE;
  dot?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pill = (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border font-medium",
        PILL_SIZE[size],
        TONE_PILL[tone],
        hint && "cursor-help",
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
        />
      )}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );

  if (!hint) return pill;

  return (
    <HintTooltip hint={hint} triggerClassName="max-w-full">
      {pill}
    </HintTooltip>
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
      <p className="text-sm text-muted-foreground">{label}</p>
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
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors duration-200 hover:bg-accent">
        <span className="text-sm font-semibold text-foreground">{title}</span>
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
    <div className={cn("rounded-xl border p-4", TONE_PANEL[tone], className)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  action,
  inline = false,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {action}
    </div>
  );

  const description = hint ? (
    <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
  ) : null;

  if (inline) {
    return (
      <div
        data-slot="field-row"
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8",
          className,
        )}
      >
        <div className="min-w-0 space-y-1">
          {header}
          {description}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    );
  }

  if (!children) {
    return (
      <div className={cn("space-y-1", className)}>
        {header}
        {description}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {header}
      {children}
      {description}
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
  plain = false,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  plain?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 transition-opacity duration-200",
        !plain && "rounded-lg border bg-card p-4",
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
      onClick={() => onSelect()}
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
      onClick={() => onToggle()}
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

export function SegmentedControl<T extends string | number | boolean | null>({
  options,
  value,
  onChange,
  busy = false,
  size = "sm",
  className,
}: {
  options: { value: T; label: React.ReactNode; tone?: Tone }[];
  value: T;
  onChange: (value: T) => void;
  busy?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const activeIndex = options.findIndex((option) =>
    Object.is(option.value, value),
  );
  const active = TONE_SEGMENT[options[activeIndex]?.tone ?? "neutral"];

  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        "relative grid w-fit shrink-0 rounded-lg border bg-muted/40 p-1",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {activeIndex >= 0 && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 left-1 rounded-md",
            "transition-[transform,background-color] duration-300 ease-out",
            "motion-reduce:transition-none",
            active.thumb,
          )}
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />
      )}
      {options.map((option, index) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={index === activeIndex}
          disabled={busy}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative cursor-pointer rounded-md text-xs font-medium",
            "transition-colors duration-300 ease-out motion-reduce:transition-none",
            "disabled:cursor-progress",
            size === "md" ? "px-2 py-2 sm:px-3" : "px-2 py-1.5 sm:px-3",
            index === activeIndex
              ? active.text
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
          onClick={() => onRemove()}
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

export function StatusMark({
  tone = "neutral",
  className,
  label,
}: {
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 12 14"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-3 shrink-0", className)}
      style={{ color: toneColorVar(tone) }}
    >
      <path
        d="M6 .6a1 1 0 0 1 .5.13l4.6 2.66a1 1 0 0 1 .5.87v5.48a1 1 0 0 1-.5.87L6.5 13.27a1 1 0 0 1-1 0L.9 10.61a1 1 0 0 1-.5-.87V4.26a1 1 0 0 1 .5-.87L5.5.73A1 1 0 0 1 6 .6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ActionRow({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <Panel
      tone={tone}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
    </Panel>
  );
}
