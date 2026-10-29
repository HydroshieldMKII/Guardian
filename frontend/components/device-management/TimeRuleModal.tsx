import React, { useState, useEffect } from "react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { RefreshCw } from "lucide-react";
import { UserTimeRule, CreateTimeRuleDto } from "@/types";
import { useTimeRules } from "@/hooks/device-management/useTimeRules";
import { dayLabel, findConflictingRule } from "@/lib/time-rules";
import type { TimeRulePreset } from "@/lib/time-rules-api";
import { useToast } from "@/hooks/use-toast";
import { NewTimeRuleForm } from "@/components/device-management/NewTimeRuleForm";
import { TimeRulePresets } from "@/components/device-management/TimeRulePresets";
import { TimeRuleRow } from "@/components/device-management/TimeRuleRow";

interface TimeRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  deviceIdentifier?: string;
}

interface RuleEdit {
  ruleId: number;
  tempData: Partial<UserTimeRule>;
}

const blankRule = (deviceIdentifier?: string): CreateTimeRuleDto => ({
  deviceIdentifier: deviceIdentifier || undefined,
  ruleName: "",
  action: "block",
  dayOfWeek: 0,
  startTime: "10:00",
  endTime: "15:00",
});

export function TimeRuleModal({
  isOpen,
  onClose,
  userId,
  username,
  deviceIdentifier,
}: TimeRuleModalProps) {
  const { toast } = useToast();
  const {
    rules,
    isLoading: loadingRules,
    isError: loadFailed,
    createTimeRule,
    updateTimeRule,
    deleteTimeRule,
    deleteTimeRules,
    applyPreset,
  } = useTimeRules(userId, deviceIdentifier, isOpen);

  const [edit, setEdit] = useState<RuleEdit | null>(null);
  const [updatingRuleId, setUpdatingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState<TimeRulePreset | null>(
    null,
  );
  const [deletingAllRules, setDeletingAllRules] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showPresetConfirm, setShowPresetConfirm] =
    useState<TimeRulePreset | null>(null);
  const [newRule, setNewRule] = useState(() => blankRule(deviceIdentifier));

  useEffect(() => {
    if (!loadFailed) return;
    toast({
      title: "Error",
      description: "Failed to load this user's time schedule",
      variant: "destructive",
    });
  }, [loadFailed, toast]);

  const reportFailure = (error: unknown, fallback: string) =>
    toast({
      title: "Error",
      description: (error instanceof Error && error.message) || fallback,
      variant: "destructive",
    });

  const reportConflict = (conflictingRule: UserTimeRule) =>
    toast({
      title: "Time conflict",
      description: `This rule overlaps with "${conflictingRule.ruleName}" on ${dayLabel(conflictingRule.dayOfWeek)}. Adjust the times so they do not cover the same hours.`,
      variant: "destructive",
    });

  const startEdit = (ruleId: number) => {
    const rule = rules.find((r) => r.id === ruleId);
    setEdit(rule ? { ruleId, tempData: { ...rule } } : null);
  };

  const cancelEdit = () => setEdit(null);

  const updateTempData = (ruleId: number, updates: Partial<UserTimeRule>) => {
    setEdit((current) =>
      current?.ruleId === ruleId
        ? { ...current, tempData: { ...current.tempData, ...updates } }
        : current,
    );
  };

  const saveEdit = async (ruleId: number) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || edit?.ruleId !== ruleId) return;
    const { tempData } = edit;

    const conflictingRule = findConflictingRule(
      rules,
      {
        dayOfWeek: tempData.dayOfWeek ?? rule.dayOfWeek,
        startTime: tempData.startTime || rule.startTime,
        endTime: tempData.endTime || rule.endTime,
      },
      ruleId,
    );

    if (conflictingRule) {
      reportConflict(conflictingRule);
      return;
    }

    setUpdatingRuleId(ruleId);
    try {
      await updateTimeRule(ruleId, {
        ruleName: tempData.ruleName || rule.ruleName,
        dayOfWeek: tempData.dayOfWeek ?? rule.dayOfWeek,
        startTime: tempData.startTime || rule.startTime,
        endTime: tempData.endTime || rule.endTime,
        enabled: tempData.enabled ?? rule.enabled,
      });

      setEdit(null);

      toast({
        title: "Rule updated",
        description: "The rule has been updated",
        variant: "success",
      });
    } catch (error) {
      reportFailure(error, "Failed to update rule");
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const toggleRuleEnabled = async (ruleId: number, checked: boolean) => {
    setUpdatingRuleId(ruleId);
    try {
      await updateTimeRule(ruleId, { enabled: checked });
    } catch (error) {
      reportFailure(error, "Failed to update rule");
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const deleteRule = async (ruleId: number) => {
    setDeletingRuleId(ruleId);
    try {
      await deleteTimeRule(ruleId);
      toast({
        title: "Rule deleted",
        description: "The rule has been removed from this user's time schedule",
        variant: "success",
      });
    } catch (error) {
      reportFailure(error, "Failed to delete rule");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const createRule = async () => {
    if (!newRule.ruleName.trim()) {
      toast({
        title: "Error",
        description: "Enter a name for this rule",
        variant: "destructive",
      });
      return;
    }

    const conflictingRule = findConflictingRule(rules, newRule);

    if (conflictingRule) {
      reportConflict(conflictingRule);
      return;
    }

    setCreatingRule(true);
    try {
      await createTimeRule(newRule);

      setNewRule(blankRule(deviceIdentifier));

      toast({
        title: "Rule created",
        description: "The rule has been added to this user's time schedule",
        variant: "success",
      });
    } catch (error) {
      reportFailure(error, "Failed to create rule");
    } finally {
      setCreatingRule(false);
    }
  };

  const deleteAllRules = () => {
    if (rules.length === 0) return;
    setShowDeleteAllConfirm(true);
  };

  const confirmDeleteAllRules = async () => {
    setDeletingAllRules(true);
    try {
      await deleteTimeRules(rules.map((rule) => rule.id));
      toast({
        title: "Time schedule cleared",
        description: `Deleted ${rules.length} ${rules.length === 1 ? "rule" : "rules"}. This user can now stream at any time.`,
        variant: "success",
      });
    } catch (error) {
      reportFailure(error, "Failed to delete all rules");
    } finally {
      setDeletingAllRules(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const confirmCreatePreset = async (presetType: TimeRulePreset) => {
    if (creatingPreset) {
      return;
    }

    setCreatingPreset(presetType);
    try {
      await applyPreset(presetType);
      toast({
        title: "Preset applied",
        description:
          presetType === "weekdays-only"
            ? "Streaming is now blocked all day on Saturday and Sunday"
            : "Streaming is now blocked all day from Monday to Friday",
        variant: "success",
      });
    } catch (error) {
      console.error(`Error creating ${presetType} preset:`, error);
      reportFailure(error, "Failed to apply the preset");
    } finally {
      setCreatingPreset(null);
      setShowPresetConfirm(null);
    }
  };

  const spinner = <RefreshCw className="size-3.5 animate-spin" />;

  return (
    <>
      <Modal open={isOpen} onOpenChange={onClose} size="xl">
        <ModalHeader
          title="Time schedule"
          description={
            <>
              <span className="font-medium text-foreground">{username}</span>{" "}
              can stream at any time unless a rule below says otherwise. Each
              rule blocks streaming on one day, between the two times you set.
            </>
          }
        />

        <ModalBody className="space-y-0">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
            <Section
              className="order-1 lg:w-1/2"
              title="Active rules"
              action={
                rules.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deleteAllRules}
                    disabled={deletingAllRules || loadingRules}
                    className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    {deletingAllRules && spinner}
                    {deletingAllRules ? "Deleting..." : "Delete all"}
                  </Button>
                ) : undefined
              }
            >
              {loadingRules ? (
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
                      draft={edit?.ruleId === rule.id ? edit.tempData : null}
                      busy={updatingRuleId === rule.id}
                      deleting={deletingRuleId === rule.id}
                      onStartEdit={() => startEdit(rule.id)}
                      onDraftChange={(updates) =>
                        updateTempData(rule.id, updates)
                      }
                      onSave={() => void saveEdit(rule.id)}
                      onCancel={cancelEdit}
                      onToggle={(checked) =>
                        void toggleRuleEnabled(rule.id, checked)
                      }
                      onDelete={() => void deleteRule(rule.id)}
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section
              className="order-2 lg:sticky lg:top-0 lg:w-1/2 lg:self-start"
              title="Add a rule"
            >
              <TimeRulePresets
                applying={creatingPreset}
                disabled={!!creatingPreset || creatingRule}
                onChoose={setShowPresetConfirm}
              />

              <NewTimeRuleForm
                value={newRule}
                creating={creatingRule}
                disabled={!!creatingPreset}
                onChange={(updates) =>
                  setNewRule((prev) => ({ ...prev, ...updates }))
                }
                onSubmit={() => void createRule()}
              />
            </Section>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={() => void confirmDeleteAllRules()}
        title="Delete every rule?"
        description="This permanently deletes every rule in this user's time schedule, so they will be able to stream at any time. This cannot be undone."
        confirmText="Delete all"
        variant="destructive"
        loading={deletingAllRules}
      />

      <ConfirmationModal
        isOpen={!!showPresetConfirm}
        onClose={() => setShowPresetConfirm(null)}
        onConfirm={() => void confirmCreatePreset(showPresetConfirm!)}
        title={
          showPresetConfirm === "weekdays-only"
            ? "Allow weekdays only?"
            : "Allow weekends only?"
        }
        description={
          showPresetConfirm === "weekdays-only"
            ? "This deletes every existing rule and blocks streaming all day on Saturday and Sunday. This cannot be undone."
            : "This deletes every existing rule and blocks streaming all day from Monday to Friday. This cannot be undone."
        }
        confirmText="Apply preset"
        variant="default"
        loading={creatingPreset === showPresetConfirm}
      />
    </>
  );
}
