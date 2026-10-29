import React, { useState, useEffect, useRef } from "react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, Field, Panel, Section } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { ChevronDown, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { UserTimeRule, CreateTimeRuleDto } from "@/types";
import { cn } from "@/lib/utils";
import { useTimeRules } from "@/hooks/device-management/useTimeRules";
import { windowsOverlap } from "@/lib/time-rules";
import type { TimeRulePreset } from "@/lib/time-rules-api";
import { useToast } from "@/hooks/use-toast";

interface TimeRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  deviceIdentifier?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const FocusInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, type = "text", placeholder, className }) => {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <Input
      ref={inputRef}
      type={type}
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

interface RuleEdit {
  ruleId: number;
  tempData: Partial<UserTimeRule>;
}

type NewRuleForm = CreateTimeRuleDto & {
  enabled: boolean;
};

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
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null);
  const [deletingAllRules, setDeletingAllRules] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showPresetConfirm, setShowPresetConfirm] =
    useState<TimeRulePreset | null>(null);
  const [newRule, setNewRule] = useState<NewRuleForm>({
    deviceIdentifier: deviceIdentifier || undefined,
    ruleName: "",
    action: "block",
    dayOfWeek: 0,
    startTime: "10:00",
    endTime: "15:00",
    enabled: true,
  });

  useEffect(() => {
    if (!loadFailed) return;
    toast({
      title: "Error",
      description: "Failed to load this user's time schedule",
      variant: "destructive",
    });
  }, [loadFailed, toast]);

  const getDayLabel = (dayOfWeek: number): string => {
    const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
    return day?.label || "Unknown";
  };

  const validateRuleOverlap = (
    newRule: { dayOfWeek: number; startTime: string; endTime: string },
    excludeRuleId?: number,
  ): { isValid: boolean; conflictingRule?: UserTimeRule } => {
    const conflictingRule = rules.find(
      (rule) =>
        rule.id !== excludeRuleId &&
        rule.dayOfWeek === newRule.dayOfWeek &&
        windowsOverlap(newRule, rule),
    );

    return {
      isValid: !conflictingRule,
      conflictingRule,
    };
  };

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

    const validation = validateRuleOverlap(
      {
        dayOfWeek: tempData.dayOfWeek ?? rule.dayOfWeek,
        startTime: tempData.startTime || rule.startTime,
        endTime: tempData.endTime || rule.endTime,
      },
      ruleId,
    );

    if (!validation.isValid && validation.conflictingRule) {
      toast({
        title: "Time conflict",
        description: `This rule overlaps with "${validation.conflictingRule.ruleName}" on ${getDayLabel(validation.conflictingRule.dayOfWeek)}. Adjust the times so they do not cover the same hours.`,
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) || "Failed to update rule",
        variant: "destructive",
      });
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const toggleRuleEnabled = async (ruleId: number, checked: boolean) => {
    setUpdatingRuleId(ruleId);
    try {
      await updateTimeRule(ruleId, { enabled: checked });
    } catch (error) {
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) || "Failed to update rule",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) || "Failed to delete rule",
        variant: "destructive",
      });
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

    const validation = validateRuleOverlap({
      dayOfWeek: newRule.dayOfWeek,
      startTime: newRule.startTime,
      endTime: newRule.endTime,
    });

    if (!validation.isValid && validation.conflictingRule) {
      toast({
        title: "Time conflict",
        description: `This rule overlaps with "${validation.conflictingRule.ruleName}" on ${getDayLabel(validation.conflictingRule.dayOfWeek)}. Adjust the times so they do not cover the same hours.`,
        variant: "destructive",
      });
      return;
    }

    setCreatingRule(true);
    try {
      const { enabled: _enabled, ...createDto } = newRule;
      await createTimeRule(createDto);

      setNewRule({
        deviceIdentifier: deviceIdentifier || undefined,
        ruleName: "",
        action: "block",
        dayOfWeek: 0,
        startTime: "10:00",
        endTime: "15:00",
        enabled: true,
      });

      toast({
        title: "Rule created",
        description: "The rule has been added to this user's time schedule",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) || "Failed to create rule",
        variant: "destructive",
      });
    } finally {
      setCreatingRule(false);
    }
  };

  const createWeekdaysOnlyPreset = () => {
    setShowPresetConfirm("weekdays-only");
  };

  const createWeekendsOnlyPreset = () => {
    setShowPresetConfirm("weekends-only");
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
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) ||
          "Failed to delete all rules",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) ||
          "Failed to apply the preset",
        variant: "destructive",
      });
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
                  {rules.map((rule) => {
                    const isEditing = edit?.ruleId === rule.id;
                    const displayData = isEditing
                      ? { ...rule, ...edit.tempData }
                      : rule;
                    const busy = updatingRuleId === rule.id;

                    return (
                      <div
                        key={rule.id}
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
                                onChange={(value) =>
                                  updateTempData(rule.id, { ruleName: value })
                                }
                                placeholder="Rule name"
                                className="w-full"
                              />
                            </Field>

                            <Field label="Day">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-between font-normal"
                                  >
                                    {getDayLabel(displayData.dayOfWeek)}
                                    <ChevronDown className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-[160px]"
                                >
                                  {DAYS_OF_WEEK.map((day) => (
                                    <DropdownMenuItem
                                      key={day.value}
                                      onClick={() =>
                                        updateTempData(rule.id, {
                                          dayOfWeek: day.value,
                                        })
                                      }
                                    >
                                      {day.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </Field>

                            <Field label="Time range">
                              <div className="flex items-center gap-2">
                                <FocusInput
                                  type="time"
                                  value={displayData.startTime}
                                  onChange={(value) =>
                                    updateTempData(rule.id, {
                                      startTime: value,
                                    })
                                  }
                                  className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground">
                                  to
                                </span>
                                <FocusInput
                                  type="time"
                                  value={displayData.endTime}
                                  onChange={(value) =>
                                    updateTempData(rule.id, { endTime: value })
                                  }
                                  className="flex-1"
                                />
                              </div>
                            </Field>

                            <div className="flex gap-2 border-t pt-4">
                              <Button
                                onClick={() => void saveEdit(rule.id)}
                                disabled={busy}
                                size="sm"
                                className="flex-1 sm:flex-none"
                              >
                                {busy ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={cancelEdit}
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
                              onCheckedChange={(checked) =>
                                void toggleRuleEnabled(rule.id, checked)
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm font-semibold",
                                  rule.enabled
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                                )}
                              >
                                {rule.ruleName}
                              </p>
                              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                {getDayLabel(rule.dayOfWeek)} · {rule.startTime}{" "}
                                – {rule.endTime}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEdit(rule.id)}
                                disabled={busy || deletingRuleId === rule.id}
                                aria-label="Edit"
                                title="Edit this rule"
                                className="size-8 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void deleteRule(rule.id)}
                                disabled={busy || deletingRuleId === rule.id}
                                aria-label="Delete"
                                title="Delete this rule"
                                className="size-8 text-muted-foreground hover:bg-blocked/10 hover:text-blocked"
                              >
                                {deletingRuleId === rule.id ? (
                                  spinner
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section
              className="order-2 lg:sticky lg:top-0 lg:w-1/2 lg:self-start"
              title="Add a rule"
            >
              <Field
                label="Presets"
                hint="Each preset replaces every existing rule with a schedule that blocks the other days entirely."
              >
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createWeekdaysOnlyPreset}
                    disabled={!!creatingPreset || creatingRule}
                  >
                    {creatingPreset === "weekdays-only" ? (
                      <>
                        {spinner}
                        Applying...
                      </>
                    ) : (
                      "Allow weekdays only"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createWeekendsOnlyPreset}
                    disabled={!!creatingPreset || creatingRule}
                  >
                    {creatingPreset === "weekends-only" ? (
                      <>
                        {spinner}
                        Applying...
                      </>
                    ) : (
                      "Allow weekends only"
                    )}
                  </Button>
                </div>
              </Field>

              <Panel className="space-y-4">
                <Field label="Rule name" htmlFor="new-rule-name">
                  <Input
                    id="new-rule-name"
                    value={newRule.ruleName}
                    onChange={(e) =>
                      setNewRule((prev) => ({
                        ...prev,
                        ruleName: e.target.value,
                      }))
                    }
                    placeholder="e.g. School hours, Sleep time, Work hours"
                  />
                </Field>

                <Field label="Day">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                      >
                        {getDayLabel(newRule.dayOfWeek)}
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[160px]">
                      {DAYS_OF_WEEK.map((day) => (
                        <DropdownMenuItem
                          key={day.value}
                          onClick={() =>
                            setNewRule((prev) => ({
                              ...prev,
                              dayOfWeek: day.value,
                            }))
                          }
                        >
                          {day.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>

                <Field
                  label="Block streaming between"
                  hint="The end time must be later than the start time. To block across midnight, add one rule for each day."
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={newRule.startTime}
                      onChange={(e) =>
                        setNewRule((prev) => ({
                          ...prev,
                          startTime: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={newRule.endTime}
                      onChange={(e) =>
                        setNewRule((prev) => ({
                          ...prev,
                          endTime: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                  </div>
                </Field>

                <Button
                  onClick={() => void createRule()}
                  disabled={
                    creatingRule || !!creatingPreset || !newRule.ruleName.trim()
                  }
                  className="w-full"
                >
                  {creatingRule ? (
                    <>
                      {spinner}
                      Creating...
                    </>
                  ) : (
                    "Create rule"
                  )}
                </Button>
              </Panel>
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
