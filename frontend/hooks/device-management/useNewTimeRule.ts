import { useState } from "react";
import { findConflictingRule } from "@/lib/time-rules";
import type { CreateTimeRuleDto, UserTimeRule } from "@/types";
import type { TimeRuleFeedback } from "./useTimeRuleFeedback";

const blankRule = (deviceIdentifier?: string): CreateTimeRuleDto => ({
  deviceIdentifier: deviceIdentifier || undefined,
  ruleName: "",
  action: "block",
  dayOfWeek: 0,
  startTime: "10:00",
  endTime: "15:00",
});

interface NewTimeRuleOptions {
  rules: UserTimeRule[];
  deviceIdentifier?: string;
  createTimeRule: (rule: CreateTimeRuleDto) => Promise<unknown>;
  feedback: TimeRuleFeedback;
}

export function useNewTimeRule({
  rules,
  deviceIdentifier,
  createTimeRule,
  feedback,
}: NewTimeRuleOptions) {
  const [rule, setRule] = useState(() => blankRule(deviceIdentifier));
  const [creating, setCreating] = useState(false);

  const change = (updates: Partial<CreateTimeRuleDto>) =>
    setRule((current) => ({ ...current, ...updates }));

  const create = async () => {
    if (!rule.ruleName.trim()) {
      feedback.warn("Enter a name for this rule");
      return;
    }

    const conflictingRule = findConflictingRule(rules, rule);
    if (conflictingRule) {
      feedback.conflict(conflictingRule);
      return;
    }

    setCreating(true);
    try {
      await createTimeRule(rule);
      setRule(blankRule(deviceIdentifier));
      feedback.succeed(
        "Rule created",
        "The rule has been added to this user's time schedule",
      );
    } catch (error) {
      feedback.fail(error, "Failed to create rule");
    } finally {
      setCreating(false);
    }
  };

  return { rule, creating, change, create };
}
