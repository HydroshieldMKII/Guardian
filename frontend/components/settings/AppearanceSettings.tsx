"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { SettingsCard } from "@/components/settings/settings-ui";
import { OptionGroup, SegmentedControl } from "@/components/ui/entity";
import { useTheme } from "@/hooks/use-theme";
import { PALETTES, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODES: { value: ThemeMode; label: React.ReactNode }[] = [
  {
    value: "light",
    label: (
      <span className="flex items-center gap-1.5">
        <Sun className="size-3.5" />
        Light
      </span>
    ),
  },
  {
    value: "dark",
    label: (
      <span className="flex items-center gap-1.5">
        <Moon className="size-3.5" />
        Dark
      </span>
    ),
  },
  {
    value: "system",
    label: (
      <span className="flex items-center gap-1.5">
        <Monitor className="size-3.5" />
        Auto
      </span>
    ),
  },
];

export function AppearanceSettings() {
  const { theme, mode, setTheme, palette, setPalette } = useTheme();

  return (
    <SettingsCard
      title="Appearance"
      description="Saved in this browser and applied right away."
      divided
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Mode</p>
          <p className="text-xs text-muted-foreground">
            Auto follows your device setting.
          </p>
        </div>
        <SegmentedControl
          options={MODES}
          value={mode}
          onChange={setTheme}
          size="md"
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Palette</p>
        <OptionGroup className="sm:grid-cols-3">
          {PALETTES.map((option) => {
            const selected = option.id === palette;
            const swatch = option.swatch[theme];
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                onClick={() => setPalette(option.id)}
                className={cn(
                  "group flex cursor-pointer flex-col gap-3 rounded-lg border p-3 text-left",
                  "transition-[border-color,background-color,box-shadow] duration-200",
                  selected
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <span
                  aria-hidden
                  data-testid={`palette-preview-${option.id}`}
                  className="relative block h-16 overflow-hidden rounded-md border border-black/5"
                  style={{ backgroundColor: swatch.background }}
                >
                  <span
                    className="absolute bottom-0 left-3 right-6 top-3 rounded-t-md shadow-sm"
                    style={{ backgroundColor: swatch.card }}
                  >
                    <span
                      className="absolute left-2.5 top-2.5 h-1.5 w-12 rounded-full"
                      style={{ backgroundColor: swatch.ink }}
                    />
                    <span
                      className="absolute left-2.5 top-5.5 h-1.5 w-20 rounded-full opacity-30"
                      style={{ backgroundColor: swatch.ink }}
                    />
                  </span>
                </span>
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0 rounded-full border-2 transition-colors duration-200",
                      selected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40",
                    )}
                  />
                </span>
              </button>
            );
          })}
        </OptionGroup>
      </div>
    </SettingsCard>
  );
}
