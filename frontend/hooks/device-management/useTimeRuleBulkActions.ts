import { useState } from "react";
import type { TimeRulePreset } from "@/lib/time-rules-api";
import type { UserTimeRule } from "@/types";
import type { TimeRuleFeedback } from "./useTimeRuleFeedback";

const PRESET_APPLIED: Record<TimeRulePreset, string> = {
  "weekdays-only": "Streaming is now blocked all day on Saturday and Sunday",
  "weekends-only": "Streaming is now blocked all day from Monday to Friday",
};

interface TimeRuleBulkActionsOptions {
  rules: UserTimeRule[];
  deleteTimeRules: (ruleIds: number[]) => Promise<unknown>;
  applyPreset: (preset: TimeRulePreset) => Promise<unknown>;
  feedback: TimeRuleFeedback;
}

export function useTimeRuleBulkActions({
  rules,
  deleteTimeRules,
  applyPreset,
  feedback,
}: TimeRuleBulkActionsOptions) {
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [presetToConfirm, setPresetToConfirm] = useState<TimeRulePreset | null>(
    null,
  );
  const [applyingPreset, setApplyingPreset] = useState<TimeRulePreset | null>(
    null,
  );

  const requestDeleteAll = () => {
    if (rules.length > 0) setConfirmingDeleteAll(true);
  };

  const deleteAll = async () => {
    setDeletingAll(true);
    try {
      await deleteTimeRules(rules.map((rule) => rule.id));
      feedback.succeed(
        "Time schedule cleared",
        `Deleted ${rules.length} ${rules.length === 1 ? "rule" : "rules"}. This user can now stream at any time.`,
      );
    } catch (error) {
      feedback.fail(error, "Failed to delete all rules");
    } finally {
      setDeletingAll(false);
      setConfirmingDeleteAll(false);
    }
  };

  const confirmPreset = async () => {
    const preset = presetToConfirm;
    if (!preset || applyingPreset) return;

    setApplyingPreset(preset);
    try {
      await applyPreset(preset);
      feedback.succeed("Preset applied", PRESET_APPLIED[preset]);
    } catch (error) {
      console.error(`Error creating ${preset} preset:`, error);
      feedback.fail(error, "Failed to apply the preset");
    } finally {
      setApplyingPreset(null);
      setPresetToConfirm(null);
    }
  };

  return {
    confirmingDeleteAll,
    deletingAll,
    requestDeleteAll,
    cancelDeleteAll: () => setConfirmingDeleteAll(false),
    deleteAll,
    presetToConfirm,
    applyingPreset,
    choosePreset: setPresetToConfirm,
    cancelPreset: () => setPresetToConfirm(null),
    confirmPreset,
  };
}

export type TimeRuleBulkActions = ReturnType<typeof useTimeRuleBulkActions>;
