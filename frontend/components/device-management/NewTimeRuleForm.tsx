import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Panel } from "@/components/ui/entity";
import { DayPicker } from "@/components/device-management/DayPicker";
import type { CreateTimeRuleDto } from "@/types";

export function NewTimeRuleForm({
  value,
  creating,
  disabled,
  onChange,
  onSubmit,
}: {
  value: CreateTimeRuleDto;
  creating: boolean;
  disabled: boolean;
  onChange: (updates: Partial<CreateTimeRuleDto>) => void;
  onSubmit: () => void;
}) {
  return (
    <Panel className="space-y-4">
      <Field label="Rule name" htmlFor="new-rule-name">
        <Input
          id="new-rule-name"
          value={value.ruleName}
          onChange={(e) => onChange({ ruleName: e.target.value })}
          placeholder="e.g. School hours, Sleep time, Work hours"
        />
      </Field>

      <Field label="Day">
        <DayPicker
          value={value.dayOfWeek}
          onChange={(dayOfWeek) => onChange({ dayOfWeek })}
        />
      </Field>

      <Field
        label="Block streaming between"
        hint="The end time must be later than the start time. To block across midnight, add one rule for each day."
      >
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={value.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            className="flex-1"
          />
        </div>
      </Field>

      <Button
        onClick={onSubmit}
        disabled={creating || disabled || !value.ruleName.trim()}
        className="w-full"
      >
        {creating ? (
          <>
            <RefreshCw className="size-3.5 animate-spin" />
            Creating...
          </>
        ) : (
          "Create rule"
        )}
      </Button>
    </Panel>
  );
}
