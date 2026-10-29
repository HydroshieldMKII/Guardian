import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/entity";
import { DayPicker } from "@/components/device-management/DayPicker";
import { FocusInput } from "@/components/device-management/FocusInput";
import { dayLabel } from "@/lib/time-rules";
import { cn } from "@/lib/utils";
import type { UserTimeRule } from "@/types";

interface TimeRuleRowProps {
  rule: UserTimeRule;
  draft: Partial<UserTimeRule> | null;
  busy: boolean;
  deleting: boolean;
  onStartEdit: () => void;
  onDraftChange: (updates: Partial<UserTimeRule>) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}

export function TimeRuleRow({
  rule,
  draft,
  busy,
  deleting,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
  onToggle,
  onDelete,
}: TimeRuleRowProps) {
  const isEditing = draft !== null;
  const displayData = { ...rule, ...draft };

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors duration-200",
        isEditing ? "p-4" : "px-3 py-2.5",
        rule.enabled ? "bg-card" : "bg-muted/30",
      )}
    >
      {isEditing ? (
        <div className="space-y-4">
          <Field label="Rule name">
            <FocusInput
              value={displayData.ruleName}
              onChange={(value) => onDraftChange({ ruleName: value })}
              placeholder="Rule name"
              className="w-full"
            />
          </Field>

          <Field label="Day">
            <DayPicker
              value={displayData.dayOfWeek}
              onChange={(dayOfWeek) => onDraftChange({ dayOfWeek })}
            />
          </Field>

          <Field label="Time range">
            <div className="flex items-center gap-2">
              <FocusInput
                type="time"
                ariaLabel="Rule start time"
                value={displayData.startTime}
                onChange={(value) => onDraftChange({ startTime: value })}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <FocusInput
                type="time"
                ariaLabel="Rule end time"
                value={displayData.endTime}
                onChange={(value) => onDraftChange({ endTime: value })}
                className="flex-1"
              />
            </div>
          </Field>

          <div className="flex gap-2 border-t pt-4">
            <Button
              onClick={onSave}
              disabled={busy}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              {busy ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Switch
            checked={rule.enabled}
            disabled={busy}
            aria-label={`${rule.ruleName} enabled`}
            className="cursor-pointer"
            onCheckedChange={onToggle}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-semibold",
                rule.enabled ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {rule.ruleName}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {dayLabel(rule.dayOfWeek)} · {rule.startTime} – {rule.endTime}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onStartEdit}
              disabled={busy || deleting}
              aria-label="Edit"
              title="Edit this rule"
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={busy || deleting}
              aria-label="Delete"
              title="Delete this rule"
              className="size-8 text-muted-foreground hover:bg-blocked/10 hover:text-blocked"
            >
              {deleting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
