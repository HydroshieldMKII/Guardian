import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type Tone } from "./tones";
import { Panel } from "./layout";

export function Field({
  label,
  htmlFor,
  hint,
  action,
  error,
  inline = false,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  error?: React.ReactNode;
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

  const problem = error ? (
    <p role="alert" className="text-xs leading-relaxed text-blocked">
      {error}
    </p>
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
          {problem}
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
        {problem}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {header}
      {children}
      {description}
      {problem}
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
