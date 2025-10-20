import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Save, X, Plus, ChevronDown } from "lucide-react";
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
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, onBlur, type = "text", placeholder, className }) => {
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

  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  return (
    <Input
      ref={inputRef}
      type={type}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
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
    null
  );
  const [newRule, setNewRule] = useState<NewRuleForm>({
    deviceIdentifier: deviceIdentifier || undefined,
    ruleName: "",
    action: "block",
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
        description: "Failed to load time rules",
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
    rule2: { startTime: string; endTime: string }
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
    excludeRuleId?: number
  ): { isValid: boolean; conflictingRule?: UserTimeRule } => {
    const conflictingRule = rules.find(
      (rule) =>
        rule.id !== excludeRuleId &&
        rule.dayOfWeek === newRule.dayOfWeek &&
        doTimeRulesOverlap(newRule, rule)
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
      }))
    );
  };

  const cancelEdit = (ruleId: number) => {
    setRules((prev) =>
      prev.map((rule) => ({
        ...rule,
        isEditing: false,
        tempData: undefined,
      }))
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
      })
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
      ruleId
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
        action: rule.tempData.action || rule.action,
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
        description: "Time rule has been updated successfully",
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
        description: "Time rule has been deleted successfully",
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
        sortRules([...prev, { ...createdRule, isEditing: false }])
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
        description: "Time rule has been created successfully",
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
        description: `Successfully deleted ${rules.length} time rules`,
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
      console.log("Already creating preset, ignoring duplicate request");
      return;
    }

    setCreatingPreset(presetType);
    try {
      console.log(`Creating ${presetType} preset for user:`, userId);
      const createdRules = await createPreset(
        userId,
        presetType as "weekdays-only" | "weekends-only",
        deviceIdentifier
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-[1100px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Manage Time Rules
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Managing time rules for <strong>{username}</strong>
            </p>
          </DialogHeader>

          <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden min-h-0">
            {/* Right Column - New Rules (Show first on mobile) */}
            <div className="lg:w-1/2 flex flex-col min-h-0 space-y-4 flex-1 lg:flex-initial order-1 lg:order-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Add New Time Rule</Label>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Quick Presets
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createWeekdaysOnlyPreset}
                    disabled={!!creatingPreset || creatingRule}
                    className="text-xs"
                  >
                    {creatingPreset === "weekdays-only" ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-1" />
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
                    className="text-xs"
                  >
                    {creatingPreset === "weekends-only" ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-1" />
                        Applying...
                      </>
                    ) : (
                      "Weekends Only"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Delete your current rules and apply a preset
                </p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                <Card>
                  <CardContent className="px-4 py-3 space-y-4">
                    {/* Rule Name */}
                    <div>
                      <Label className="text-sm font-medium">Rule Name</Label>
                      <Input
                        value={newRule.ruleName}
                        onChange={(e) =>
                          setNewRule((prev) => ({
                            ...prev,
                            ruleName: e.target.value,
                          }))
                        }
                        placeholder="e.g., Night restriction"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Action */}
                      <div>
                        <Label className="text-sm font-medium">Action</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between text-sm"
                            >
                              {newRule.action === "block"
                                ? "Block Access"
                                : "Allow Access"}
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-[200px]"
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                setNewRule((prev) => ({
                                  ...prev,
                                  action: "block",
                                }))
                              }
                            >
                              Block Access
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setNewRule((prev) => ({
                                  ...prev,
                                  action: "allow",
                                }))
                              }
                            >
                              Allow Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Day */}
                      <div>
                        <Label className="text-sm font-medium">Day</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between text-sm"
                            >
                              {getDayLabel(newRule.dayOfWeek)}
                              <ChevronDown className="w-4 h-4" />
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
                      </div>
                    </div>

                    {/* Time Range */}
                    <div>
                      <Label className="text-sm font-medium">Time Range</Label>
                      <div className="flex gap-2 items-center">
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
                        <span className="text-sm text-muted-foreground">
                          to
                        </span>
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
                    </div>

                    {/* Create Button */}
                    <Button
                      onClick={createRule}
                      disabled={
                        creatingRule ||
                        !!creatingPreset ||
                        !newRule.ruleName.trim()
                      }
                      className="w-full flex items-center gap-2"
                    >
                      {creatingRule ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Rule
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Left Column - Existing Rules (Show second on mobile) */}
            <div className="lg:w-1/2 flex flex-col min-h-0 h-[35vh] lg:h-auto order-2 lg:order-1">
              <div className="flex items-center justify-between mb-3 pr-2">
                <Label className="text-sm font-medium">
                  Existing Time Rules
                </Label>
                {rules.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deleteAllRules}
                    disabled={deletingAllRules || loadingRules}
                    className="flex items-center gap-1 border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                  >
                    {deletingAllRules ? (
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    {deletingAllRules ? "Deleting..." : "Delete All"}
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                {loadingRules ? (
                  <div className="text-center py-4">Loading rules...</div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p className="text-sm">No time rules configured yet.</p>
                      <p className="text-xs mt-1">
                        Create your first rule using the form on the right.
                      </p>
                    </div>
                  </div>
                ) : (
                  rules.map((rule) => {
                    const displayData =
                      rule.isEditing && rule.tempData
                        ? { ...rule, ...rule.tempData }
                        : rule;

                    return (
                      <Card
                        key={rule.id}
                        className={!rule.enabled ? "bg-muted/30" : ""}
                      >
                        <CardContent className="px-4 py-3">
                          {rule.isEditing ? (
                            <div className="space-y-4">
                              {/* Rule Name */}
                              <div>
                                <Label className="text-sm font-medium">
                                  Rule Name
                                </Label>
                                <FocusInput
                                  value={displayData.ruleName}
                                  onChange={(value) =>
                                    updateTempData(rule.id, {
                                      ruleName: value,
                                    })
                                  }
                                  placeholder="Rule name"
                                  className="w-full"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                {/* Action */}
                                <div>
                                  <Label className="text-sm font-medium">
                                    Action
                                  </Label>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="w-full justify-between text-sm"
                                      >
                                        {displayData.action === "block"
                                          ? "Block Access"
                                          : "Allow Access"}
                                        <ChevronDown className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="start"
                                      className="w-[200px]"
                                    >
                                      <DropdownMenuItem
                                        onClick={() =>
                                          updateTempData(rule.id, {
                                            action: "block",
                                          })
                                        }
                                      >
                                        Block Access
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          updateTempData(rule.id, {
                                            action: "allow",
                                          })
                                        }
                                      >
                                        Allow Access
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {/* Day */}
                                <div>
                                  <Label className="text-sm font-medium">
                                    Day
                                  </Label>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="w-full justify-between text-sm"
                                      >
                                        {getDayLabel(displayData.dayOfWeek)}
                                        <ChevronDown className="w-4 h-4" />
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
                                </div>
                              </div>

                              {/* Time Range */}
                              <div>
                                <Label className="text-sm font-medium">
                                  Time Range
                                </Label>
                                <div className="flex gap-2 items-center">
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
                                      updateTempData(rule.id, {
                                        endTime: value,
                                      })
                                    }
                                    className="flex-1"
                                  />
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => saveEdit(rule.id)}
                                  disabled={updatingRuleId === rule.id}
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  {updatingRuleId === rule.id
                                    ? "Saving..."
                                    : "Save"}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => cancelEdit(rule.id)}
                                  disabled={updatingRuleId === rule.id}
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span
                                    className={`font-medium truncate ${!rule.enabled ? "text-muted-foreground" : ""}`}
                                  >
                                    {rule.ruleName}
                                  </span>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Badge
                                      variant={
                                        rule.action === "block"
                                          ? "default"
                                          : "default"
                                      }
                                      className={`text-xs text-white ${
                                        !rule.enabled
                                          ? "bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700 border-gray-400"
                                          : rule.action === "allow"
                                            ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 border-green-600"
                                            : "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 border-red-600"
                                      }`}
                                    >
                                      {rule.action}
                                    </Badge>
                                  </div>
                                </div>
                                <p
                                  className={`text-sm ${!rule.enabled ? "text-muted-foreground/60" : "text-muted-foreground"}`}
                                >
                                  {getDayLabel(rule.dayOfWeek)} •{" "}
                                  {rule.startTime} - {rule.endTime}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Switch
                                  checked={rule.enabled}
                                  disabled={updatingRuleId === rule.id}
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
                                            : r
                                        )
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
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEdit(rule.id)}
                                  disabled={
                                    updatingRuleId === rule.id ||
                                    deletingRuleId === rule.id
                                  }
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteRule(rule.id)}
                                  disabled={
                                    updatingRuleId === rule.id ||
                                    deletingRuleId === rule.id
                                  }
                                >
                                  {deletingRuleId === rule.id ? (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <ConfirmationModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={confirmDeleteAllRules}
        title="Delete All Time Rules?"
        description="This action will permanently delete all existing time rules for this user. This cannot be undone."
        confirmText="Delete All"
        variant="destructive"
        loading={deletingAllRules}
      />

      {/* Preset Confirmation Dialog */}
      <ConfirmationModal
        isOpen={!!showPresetConfirm}
        onClose={() => setShowPresetConfirm(null)}
        onConfirm={() => confirmCreatePreset(showPresetConfirm!)}
        title={`Apply ${showPresetConfirm} Preset?`}
        description={`This will delete all existing time rules and create new ones for ${showPresetConfirm?.toLowerCase()}. This action cannot be undone.`}
        confirmText="Apply Preset"
        variant="default"
        loading={creatingPreset === showPresetConfirm}
      />
    </>
  );
}
