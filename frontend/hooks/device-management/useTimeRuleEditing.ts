import { useState } from "react";
import { findConflictingRule, mergeRuleEdit } from "@/lib/time-rules";
import type { UpdateTimeRuleDto, UserTimeRule } from "@/types";
import type { TimeRuleFeedback } from "./useTimeRuleFeedback";

interface RuleEdit {
  ruleId: number;
  draft: Partial<UserTimeRule>;
}

interface TimeRuleEditingOptions {
  rules: UserTimeRule[];
  updateTimeRule: (
    ruleId: number,
    updates: UpdateTimeRuleDto,
  ) => Promise<unknown>;
  deleteTimeRule: (ruleId: number) => Promise<unknown>;
  feedback: TimeRuleFeedback;
}

export function useTimeRuleEditing({
  rules,
  updateTimeRule,
  deleteTimeRule,
  feedback,
}: TimeRuleEditingOptions) {
  const [edit, setEdit] = useState<RuleEdit | null>(null);
  const [updatingRuleId, setUpdatingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);

  const findRule = (ruleId: number) => rules.find((rule) => rule.id === ruleId);

  const startEdit = (ruleId: number) => {
    const rule = findRule(ruleId);
    setEdit(rule ? { ruleId, draft: { ...rule } } : null);
  };

  const cancelEdit = () => setEdit(null);

  const changeDraft = (ruleId: number, updates: Partial<UserTimeRule>) =>
    setEdit((current) =>
      current?.ruleId === ruleId
        ? { ...current, draft: { ...current.draft, ...updates } }
        : current,
    );

  const update = async (
    ruleId: number,
    updates: UpdateTimeRuleDto,
    onSaved?: () => void,
  ) => {
    setUpdatingRuleId(ruleId);
    try {
      await updateTimeRule(ruleId, updates);
      onSaved?.();
    } catch (error) {
      feedback.fail(error, "Failed to update rule");
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const saveEdit = async (ruleId: number) => {
    const rule = findRule(ruleId);
    if (!rule || edit?.ruleId !== ruleId) return;

    const updates = mergeRuleEdit(rule, edit.draft);
    const conflictingRule = findConflictingRule(rules, updates, ruleId);
    if (conflictingRule) {
      feedback.conflict(conflictingRule);
      return;
    }

    await update(ruleId, updates, () => {
      setEdit(null);
      feedback.succeed("Rule updated", "The rule has been updated");
    });
  };

  const toggleEnabled = (ruleId: number, enabled: boolean) =>
    update(ruleId, { enabled });

  const deleteRule = async (ruleId: number) => {
    setDeletingRuleId(ruleId);
    try {
      await deleteTimeRule(ruleId);
      feedback.succeed(
        "Rule deleted",
        "The rule has been removed from this user's time schedule",
      );
    } catch (error) {
      feedback.fail(error, "Failed to delete rule");
    } finally {
      setDeletingRuleId(null);
    }
  };

  return {
    edit,
    updatingRuleId,
    deletingRuleId,
    startEdit,
    cancelEdit,
    changeDraft,
    saveEdit,
    toggleEnabled,
    deleteRule,
  };
}

export type TimeRuleEditing = ReturnType<typeof useTimeRuleEditing>;
