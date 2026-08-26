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
import {
  EmptyState,
  Field,
  Panel,
  Section,
  StatusPill,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { ChevronDown, RefreshCw } from "lucide-react";
import { UserTimeRule, CreateTimeRuleDto } from "@/types";
import { useTimeRules } from "@/hooks/device-management/useTimeRules";
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

// Simple input component that maintains focus
const FocusInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, type = "text", placeholder, className }) => {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local value when prop changes (but not if input is focused)
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

type EditingRule = UserTimeRule & {
  isEditing: boolean;
  tempData?: Partial<UserTimeRule>;
};

// Extended CreateTimeRuleDto with enabled field for UI
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
    getTimeRules,
    createTimeRule,
    updateTimeRule,
    deleteTimeRule,
    createPreset,
    loading,
  } = useTimeRules();

  const [rules, setRules] = useState<EditingRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [updatingRuleId, setUpdatingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null); // Track which preset is being created
  const [deletingAllRules, setDeletingAllRules] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showPresetConfirm, setShowPresetConfirm] = useState<string | null>(
    null,
  );
  const [newRule, setNewRule] = useState<NewRuleForm>({
    deviceIdentifier: deviceIdentifier || undefined,
    ruleName: "",
    action: "block", // Always block
    dayOfWeek: 0,
    startTime: "10:00",
    endTime: "15:00",
    enabled: true,
  });

  // Helper function to sort rules by day of week and start time
  const sortRules = (rules: EditingRule[]): EditingRule[] => {
    return [...rules].sort((a, b) => {
      // First sort by day of week
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek;
      }
      // Then sort by start time
      const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
      };
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  };

  // Load rules when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen, userId, deviceIdentifier]);

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const userRules = await getTimeRules(userId, deviceIdentifier);
      const editingRules = userRules.map((rule: UserTimeRule) => ({
        ...rule,
        isEditing: false,
      }));
      setRules(sortRules(editingRules));
    } catch (error) {
      console.error("Failed to load rules:", error);
      toast({
        title: "Error",
        description: "Failed to load blocking rules",
        variant: "destructive",
      });
    } finally {
      setLoadingRules(false);
    }
  };

  // Helper functions
  const getDayLabel = (dayOfWeek: number): string => {
    const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
    return day?.label || "Unknown";
  };

  // Helper function to convert time string to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Check if two time rules overlap
  const doTimeRulesOverlap = (
    rule1: { startTime: string; endTime: string },
    rule2: { startTime: string; endTime: string },
  ): boolean => {
    const start1 = timeToMinutes(rule1.startTime);
    const end1 = timeToMinutes(rule1.endTime);
    const start2 = timeToMinutes(rule2.startTime);
    const end2 = timeToMinutes(rule2.endTime);

    // Standard overlap check: two time ranges overlap if one starts before the other ends
    return start1 < end2 && start2 < end1;
  };

  // Validate if a rule would overlap with existing rules
  const validateRuleOverlap = (
    newRule: { dayOfWeek: number; startTime: string; endTime: string },
    excludeRuleId?: number,
  ): { isValid: boolean; conflictingRule?: UserTimeRule } => {
    const conflictingRule = rules.find(
      (rule) =>
        rule.id !== excludeRuleId &&
        rule.dayOfWeek === newRule.dayOfWeek &&
        doTimeRulesOverlap(newRule, rule),
    );

    return {
      isValid: !conflictingRule,
      conflictingRule,
    };
  };

  const startEdit = (ruleId: number) => {
    setRules((prev) =>
      prev.map((rule) => ({
        ...rule,
        isEditing: rule.id === ruleId,
        tempData: rule.id === ruleId ? { ...rule } : undefined,
      })),
    );
  };

  const cancelEdit = (ruleId: number) => {
    setRules((prev) =>
      prev.map((rule) => ({
        ...rule,
        isEditing: false,
        tempData: undefined,
      })),
    );
  };

  const updateTempData = (ruleId: number, updates: Partial<UserTimeRule>) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId && rule.isEditing) {
          return {
            ...rule,
            tempData: { ...rule.tempData, ...updates },
          };
        }
        return rule;
      }),
    );
  };

  const saveEdit = async (ruleId: number) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule?.tempData) return;

    // Validate for overlaps (excluding the current rule being edited)
    const validation = validateRuleOverlap(
      {
        dayOfWeek: rule.tempData.dayOfWeek ?? rule.dayOfWeek,
        startTime: rule.tempData.startTime || rule.startTime,
        endTime: rule.tempData.endTime || rule.endTime,
      },
      ruleId,
    );

    if (!validation.isValid && validation.conflictingRule) {
      toast({
        title: "Time Conflict",
        description: `This rule would overlap with "${validation.conflictingRule.ruleName}" on ${getDayLabel(validation.conflictingRule.dayOfWeek)}`,
        variant: "destructive",
      });
      return;
    }

    setUpdatingRuleId(ruleId);
    try {
      await updateTimeRule(userId, ruleId, {
        ruleName: rule.tempData.ruleName || rule.ruleName,
        dayOfWeek: rule.tempData.dayOfWeek ?? rule.dayOfWeek,
        startTime: rule.tempData.startTime || rule.startTime,
        endTime: rule.tempData.endTime || rule.endTime,
        enabled: rule.tempData.enabled ?? rule.enabled,
      });

      // Update local state and maintain sort order
      setRules((prev) => {
        const updatedRules = prev.map((r) => {
          if (r.id === ruleId) {
            return {
              ...r,
              ...r.tempData,
              isEditing: false,
              tempData: undefined,
            };
          }
          return r;
        });
        return sortRules(updatedRules);
      });

      toast({
        title: "Rule Updated",
        description: "Blocking rule has been updated successfully",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update rule",
        variant: "destructive",
      });
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const deleteRule = async (ruleId: number) => {
    setDeletingRuleId(ruleId);
    try {
      await deleteTimeRule(userId, ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast({
        title: "Rule Deleted",
        description: "Blocking rule has been deleted successfully",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete rule",
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
        description: "Please enter a rule name",
        variant: "destructive",
      });
      return;
    }

    // Validate for overlaps
    const validation = validateRuleOverlap({
      dayOfWeek: newRule.dayOfWeek,
      startTime: newRule.startTime,
      endTime: newRule.endTime,
    });

    if (!validation.isValid && validation.conflictingRule) {
      toast({
        title: "Time Conflict",
        description: `This rule would overlap with "${validation.conflictingRule.ruleName}" on ${getDayLabel(validation.conflictingRule.dayOfWeek)}`,
        variant: "destructive",
      });
      return;
    }

    setCreatingRule(true);
    try {
      // Extract enabled field and create the DTO
      const { enabled, ...createDto } = newRule;
      const createdRule = await createTimeRule(userId, createDto);

      setRules((prev) =>
        sortRules([...prev, { ...createdRule, isEditing: false }]),
      );

      // Reset new rule form
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
        title: "Rule Created",
        description: "Blocking rule has been created successfully",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create rule",
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
      // Delete all rules
      await Promise.all(rules.map((rule) => deleteTimeRule(userId, rule.id)));

      setRules([]);
      toast({
        title: "All Rules Deleted",
        description: `Successfully deleted ${rules.length} blocking rules`,
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete all rules",
        variant: "destructive",
      });
    } finally {
      setDeletingAllRules(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const confirmCreatePreset = async (presetType: string) => {
    if (creatingPreset) {
      return;
    }

    setCreatingPreset(presetType);
    try {
      const createdRules = await createPreset(
        userId,
        presetType as "weekdays-only" | "weekends-only",
        deviceIdentifier,
      );

      const editingRules = createdRules.map((rule) => ({
        ...rule,
        isEditing: false,
      }));
      setRules(sortRules(editingRules));
      toast({
        title: "Preset Applied",
        description: `${presetType === "weekdays-only" ? "Weekdays" : "Weekends"} preset successfully applied`,
        variant: "success",
      });
    } catch (error: any) {
      console.error(`Error creating ${presetType} preset:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to create ${presetType} preset`,
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
          title="Manage Blocking Rules"
          description={
            <>
              Managing blocking rules for{" "}
              <span className="font-medium text-foreground">{username}</span>.
              Streaming is allowed by default — add rules to block access during
              specific times.
            </>
          }
        />

        <ModalBody className="space-y-0">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
            <Section
              className="order-1 lg:w-1/2"
              title="Active Blocking Rules"
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
                    {deletingAllRules ? "Deleting..." : "Delete All"}
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
                  title="No blocking rules configured."
                  description="Streaming is allowed by default. Add blocking rules to restrict access during specific time periods."
                />
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => {
                    const displayData =
                      rule.isEditing && rule.tempData
                        ? { ...rule, ...rule.tempData }
                        : rule;
                    const busy = updatingRuleId === rule.id;

                    return (
                      <div
                        key={rule.id}
                        className={`rounded-lg border p-4 ${
                          rule.enabled ? "bg-card" : "bg-muted/30"
                        }`}
                      >
                        {rule.isEditing ? (
                          <div className="space-y-4">
                            <Field label="Rule Name">
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

                            <Field label="Time Range">
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
                                onClick={() => saveEdit(rule.id)}
                                disabled={busy}
                                size="sm"
                                className="flex-1 sm:flex-none"
                              >
                                {busy ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => cancelEdit(rule.id)}
                                disabled={busy}
                                size="sm"
                                className="flex-1 sm:flex-none"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-sm font-semibold ${
                                    rule.enabled
                                      ? "text-foreground"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {rule.ruleName}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {getDayLabel(rule.dayOfWeek)} ·{" "}
                                  {rule.startTime} - {rule.endTime}
                                </p>
                              </div>
                              <StatusPill
                                tone={rule.enabled ? "danger" : "neutral"}
                              >
                                Block
                              </StatusPill>
                            </div>

                            <div className="flex items-center gap-2 border-t pt-3">
                              <Switch
                                checked={rule.enabled}
                                disabled={busy}
                                className="cursor-pointer"
                                onCheckedChange={async (checked) => {
                                  setUpdatingRuleId(rule.id);
                                  try {
                                    await updateTimeRule(userId, rule.id, {
                                      enabled: checked,
                                    });
                                    setRules((prev) =>
                                      prev.map((r) =>
                                        r.id === rule.id
                                          ? { ...r, enabled: checked }
                                          : r,
                                      ),
                                    );
                                  } catch (error: any) {
                                    toast({
                                      title: "Error",
                                      description:
                                        error.message ||
                                        "Failed to update rule",
                                      variant: "destructive",
                                    });
                                  } finally {
                                    setUpdatingRuleId(null);
                                  }
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(rule.id)}
                                disabled={busy || deletingRuleId === rule.id}
                                className="ml-auto"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteRule(rule.id)}
                                disabled={busy || deletingRuleId === rule.id}
                                className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                              >
                                {deletingRuleId === rule.id
                                  ? spinner
                                  : "Delete"}
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

            <Section className="order-2 lg:w-1/2" title="Add New Blocking Rule">
              <Field label="Quick Presets">
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
                      "Weekdays Only"
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
                      "Weekends Only"
                    )}
                  </Button>
                </div>
              </Field>

              <Panel className="space-y-4">
                <Field label="Block Rule Name" htmlFor="new-rule-name">
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

                <Field label="Block During Time Range">
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
                  onClick={createRule}
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
                    "Create Blocking Rule"
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
        onConfirm={confirmDeleteAllRules}
        title="Delete All Blocking Rules?"
        description="This action will permanently delete all existing blocking rules for this user. This cannot be undone."
        confirmText="Delete All"
        variant="destructive"
        loading={deletingAllRules}
      />

      <ConfirmationModal
        isOpen={!!showPresetConfirm}
        onClose={() => setShowPresetConfirm(null)}
        onConfirm={() => confirmCreatePreset(showPresetConfirm!)}
        title={`Apply ${showPresetConfirm} Preset?`}
        description={`This will delete all existing rules and create new blocking rules for ${showPresetConfirm?.toLowerCase()}. This action cannot be undone.`}
        confirmText="Apply Preset"
        variant="default"
        loading={creatingPreset === showPresetConfirm}
      />
    </>
  );
}
