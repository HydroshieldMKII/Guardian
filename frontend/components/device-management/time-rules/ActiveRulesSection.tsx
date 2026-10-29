import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/ui/entity";
import { TimeRuleRow } from "@/components/device-management/TimeRuleRow";
import type { TimeRuleEditing } from "@/hooks/device-management/useTimeRuleEditing";
import type { UserTimeRule } from "@/types";

const spinner = <RefreshCw className="size-3.5 animate-spin" />;

interface ActiveRulesSectionProps {
  rules: UserTimeRule[];
  loading: boolean;
  deletingAll: boolean;
  onDeleteAll: () => void;
  editing: TimeRuleEditing;
}

export function ActiveRulesSection({
  rules,
  loading,
  deletingAll,
  onDeleteAll,
  editing,
}: ActiveRulesSectionProps) {
  const { edit } = editing;

  return (
    <Section
      className="order-1 lg:w-1/2"
      title="Active rules"
      action={
        rules.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteAll}
            disabled={deletingAll || loading}
            className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          >
            {deletingAll && spinner}
            {deletingAll ? "Deleting..." : "Delete all"}
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          {spinner}
          <span>Loading rules...</span>
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          description="This user can stream at any time. Add a rule to block streaming during a set part of the day."
        />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <TimeRuleRow
              key={rule.id}
              rule={rule}
              draft={edit?.ruleId === rule.id ? edit.draft : null}
              busy={editing.updatingRuleId === rule.id}
              deleting={editing.deletingRuleId === rule.id}
              onStartEdit={() => editing.startEdit(rule.id)}
              onDraftChange={(updates) => editing.changeDraft(rule.id, updates)}
              onSave={() => void editing.saveEdit(rule.id)}
              onCancel={editing.cancelEdit}
              onToggle={(checked) =>
                void editing.toggleEnabled(rule.id, checked)
              }
              onDelete={() => void editing.deleteRule(rule.id)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
