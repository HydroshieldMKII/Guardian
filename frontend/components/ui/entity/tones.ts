export type Tone =
  "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

const TONE_COLOR: Record<Exclude<Tone, "neutral">, string> = {
  positive: "allowed",
  warning: "waiting",
  danger: "blocked",
  info: "info",
  accent: "special",
};

export const TONE_PILL: Record<Tone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  positive: "border-transparent bg-allowed/12 text-allowed",
  warning: "border-transparent bg-waiting/14 text-waiting",
  danger: "border-transparent bg-blocked/12 text-blocked",
  info: "border-transparent bg-info/12 text-info",
  accent: "border-transparent bg-special/12 text-special",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  positive: "bg-allowed",
  warning: "bg-waiting",
  danger: "bg-blocked",
  info: "bg-info",
  accent: "bg-special",
};

export const TONE_PANEL: Record<Tone, string> = {
  neutral: "border-border bg-surface/60",
  positive: "border-allowed/20 bg-allowed/6",
  warning: "border-waiting/25 bg-waiting/7",
  danger: "border-blocked/20 bg-blocked/6",
  info: "border-info/20 bg-info/6",
  accent: "border-special/20 bg-special/6",
};

export const TONE_RAIL: Record<Tone, string> = {
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

export const TONE_SEGMENT: Record<Tone, { thumb: string; text: string }> = {
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
