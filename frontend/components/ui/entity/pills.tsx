import * as React from "react";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import { type Tone, TONE_PILL, TONE_DOT, toneColorVar } from "./tones";

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
