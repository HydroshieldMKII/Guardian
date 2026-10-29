import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/entity";
import type { TimeRulePreset } from "@/lib/time-rules-api";

const PRESETS: { type: TimeRulePreset; label: string }[] = [
  { type: "weekdays-only", label: "Allow weekdays only" },
  { type: "weekends-only", label: "Allow weekends only" },
];

export function TimeRulePresets({
  applying,
  disabled,
  onChoose,
}: {
  applying: TimeRulePreset | null;
  disabled: boolean;
  onChoose: (preset: TimeRulePreset) => void;
}) {
  return (
    <Field
      label="Presets"
      hint="Each preset replaces every existing rule with a schedule that blocks the other days entirely."
    >
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.type}
            variant="outline"
            size="sm"
            onClick={() => onChoose(preset.type)}
            disabled={disabled}
          >
            {applying === preset.type ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                Applying...
              </>
            ) : (
              preset.label
            )}
          </Button>
        ))}
      </div>
    </Field>
  );
}
