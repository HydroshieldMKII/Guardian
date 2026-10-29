import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { dayLabel } from "@/lib/time-rules";
import type { UserTimeRule } from "@/types";

export function useTimeRuleFeedback(loadFailed: boolean) {
  const { toast } = useToast();

  useEffect(() => {
    if (!loadFailed) return;
    toast({
      title: "Error",
      description: "Failed to load this user's time schedule",
      variant: "destructive",
    });
  }, [loadFailed, toast]);

  const warn = (description: string) =>
    toast({ title: "Error", description, variant: "destructive" });

  return {
    succeed: (title: string, description: string) =>
      toast({ title, description, variant: "success" }),
    warn,
    fail: (error: unknown, fallback: string) =>
      warn((error instanceof Error && error.message) || fallback),
    conflict: (rule: UserTimeRule) =>
      toast({
        title: "Time conflict",
        description: `This rule overlaps with "${rule.ruleName}" on ${dayLabel(rule.dayOfWeek)}. Adjust the times so they do not cover the same hours.`,
        variant: "destructive",
      }),
  };
}

export type TimeRuleFeedback = ReturnType<typeof useTimeRuleFeedback>;
