import * as React from "react";
import { cn } from "@/lib/utils";
import { type Tone, TONE_SEGMENT } from "./tones";

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
