import { useState } from "react";
import { config } from "@/lib/config";
import { UserTimeRule, CreateTimeRuleDto, UpdateTimeRuleDto } from "@/types";

// Global cache for all time rules. Persists until manually cleared
const globalTimeRuleCache = new Map<string, UserTimeRule[]>();
let isInitialFetchDone = false;

// Cache for hasTimeRules results
const hasRulesCache = new Map<
  string,
  { hasRules: boolean; timestamp: number }
>();
const CACHE_DURATION = 30000; // 30 seconds for has rules cache

export const useTimeRules = () => {
  const [loading, setLoading] = useState(false);

  const fetchAllTimeRules = async (userIds: string[]): Promise<void> => {
    try {
      setLoading(true);

      // Filter out already cached users
      const uncachedUserIds = userIds.filter(
        (userId) => !globalTimeRuleCache.has(userId)
      );

      if (uncachedUserIds.length === 0) {
        console.log("All time rules already cached");
        return;
      }

      // Make a single API call to fetch all time rules for multiple users
      const response = await fetch(`${config.api.baseUrl}/time-rules/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds: uncachedUserIds }),
      });

      if (response.ok) {
        const data: Record<string, UserTimeRule[]> = await response.json();

        // Cache the results for each user
        Object.entries(data).forEach(([userId, rules]) => {
          globalTimeRuleCache.set(userId, rules);
        });

        // Cache empty arrays for users not in the response
        uncachedUserIds.forEach((userId) => {
          if (!data[userId]) {
            globalTimeRuleCache.set(userId, []);
          }
        });

        console.log(
          `✓ Successfully fetched time rules for ${uncachedUserIds.length} users in batch`
        );
      } else {
        console.error("Failed to fetch time rules batch:", response.statusText);
        // Cache empty arrays on error to prevent repeated failures
        uncachedUserIds.forEach((userId) => {
          globalTimeRuleCache.set(userId, []);
        });
      }

      isInitialFetchDone = true;
    } catch (error) {
      console.error("Error fetching all time rules:", error);
      // Cache empty arrays on error to prevent repeated failures
      userIds.forEach((userId) => {
        if (!globalTimeRuleCache.has(userId)) {
          globalTimeRuleCache.set(userId, []);
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getTimeRules = async (
    userId: string,
    deviceIdentifier?: string
  ): Promise<UserTimeRule[]> => {
    // Check cache first
    const cached = globalTimeRuleCache.get(userId);
    if (cached) {
      // Filter by device if specified
      if (deviceIdentifier) {
        return cached.filter(
          (rule) => rule.deviceIdentifier === deviceIdentifier
        );
      }
      return cached.filter((rule) => !rule.deviceIdentifier); // User-wide rules
    }

    try {
      setLoading(true);
      const endpoint = deviceIdentifier
        ? `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/device/${encodeURIComponent(deviceIdentifier)}`
        : `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules`;

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();

        // If this was a user-wide request, cache all rules for the user
        if (!deviceIdentifier) {
          globalTimeRuleCache.set(userId, data);
        }

        return data;
      }
      throw new Error("Failed to fetch time rules");
    } catch (error) {
      console.error("Error fetching time rules:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getAllTimeRules = async (userId: string): Promise<UserTimeRule[]> => {
    // Check cache first
    const cached = globalTimeRuleCache.get(userId);
    if (cached) {
      return cached;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/all`
      );
      if (response.ok) {
        const data = await response.json();
        // Cache the result
        globalTimeRuleCache.set(userId, data);
        return data;
      }
      throw new Error("Failed to fetch all time rules");
    } catch (error) {
      console.error("Error fetching all time rules:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createTimeRule = async (
    userId: string,
    rule: CreateTimeRuleDto
  ): Promise<UserTimeRule> => {
    try {
      setLoading(true);

      // Validate time range
      if (!validateTimeRange(rule.startTime, rule.endTime)) {
        throw new Error("End time must be greater than start time");
      }

      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rule),
        }
      );

      if (response.ok) {
        const newRule = await response.json();

        // Update cache
        const cached = globalTimeRuleCache.get(userId) || [];
        globalTimeRuleCache.set(userId, [...cached, newRule]);

        // Clear hasRules cache to ensure "Scheduled" badge updates
        hasRulesCache.delete(userId);

        return newRule;
      }

      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(errorData.message || "Failed to create time rule");
    } catch (error) {
      console.error("Error creating time rule:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTimeRule = async (
    userId: string,
    ruleId: number,
    updates: UpdateTimeRuleDto
  ): Promise<UserTimeRule | null> => {
    try {
      setLoading(true);

      // Validate time range if times are being updated
      if (updates.startTime || updates.endTime) {
        const cached = globalTimeRuleCache.get(userId) || [];
        const existingRule = cached.find((r) => r.id === ruleId);
        if (existingRule) {
          const startTime = updates.startTime || existingRule.startTime;
          const endTime = updates.endTime || existingRule.endTime;
          if (!validateTimeRange(startTime, endTime)) {
            throw new Error("End time must be greater than start time");
          }
        }
      }

      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/${ruleId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      if (response.ok) {
        const updatedRule = await response.json();

        // Update cache
        const cached = globalTimeRuleCache.get(userId) || [];
        const updatedCache = cached.map((rule) =>
          rule.id === ruleId ? updatedRule : rule
        );
        globalTimeRuleCache.set(userId, updatedCache);

        // Clear hasRules cache to ensure "Scheduled" badge updates
        hasRulesCache.delete(userId);

        return updatedRule;
      }

      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(errorData.message || "Failed to update time rule");
    } catch (error) {
      console.error("Error updating time rule:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTimeRule = async (
    userId: string,
    ruleId: number
  ): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/${ruleId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Update cache
        const cached = globalTimeRuleCache.get(userId) || [];
        const updatedCache = cached.filter((rule) => rule.id !== ruleId);
        globalTimeRuleCache.set(userId, updatedCache);

        // Clear hasRules cache to ensure "Scheduled" badge updates
        hasRulesCache.delete(userId);
      } else {
        throw new Error("Failed to delete time rule");
      }
    } catch (error) {
      console.error("Error deleting time rule:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createPreset = async (
    userId: string,
    presetType: 'weekdays-only' | 'weekends-only',
    deviceIdentifier?: string
  ): Promise<UserTimeRule[]> => {
    try {
      setLoading(true);

      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/preset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            presetType,
            deviceIdentifier: deviceIdentifier || undefined,
          }),
        }
      );

      if (response.ok) {
        const newRules = await response.json();

        // Update cache with new rules (replace existing)
        globalTimeRuleCache.set(userId, newRules);

        // Clear hasRules cache to ensure "Scheduled" badge updates
        hasRulesCache.delete(userId);

        return newRules;
      }

      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(errorData.message || "Failed to create preset");
    } catch (error) {
      console.error("Error creating preset:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const toggleTimeRule = async (
    userId: string,
    ruleId: number
  ): Promise<UserTimeRule> => {
    try {
      setLoading(true);
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/${ruleId}/toggle`,
        {
          method: "PUT",
        }
      );

      if (response.ok) {
        const updatedRule = await response.json();

        // Update cache
        const cached = globalTimeRuleCache.get(userId) || [];
        const updatedCache = cached.map((rule) =>
          rule.id === ruleId ? updatedRule : rule
        );
        globalTimeRuleCache.set(userId, updatedCache);

        // Clear hasRules cache to ensure "Scheduled" badge updates
        hasRulesCache.delete(userId);

        return updatedRule;
      }
      throw new Error("Failed to toggle time rule");
    } catch (error) {
      console.error("Error toggling time rule:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkStreamingAllowed = async (
    userId: string,
    deviceIdentifier?: string
  ): Promise<{ allowed: boolean; reason: string }> => {
    try {
      setLoading(true);
      const queryParams = deviceIdentifier
        ? `?deviceIdentifier=${encodeURIComponent(deviceIdentifier)}`
        : "";
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules/check${queryParams}`
      );
      if (response.ok) {
        return await response.json();
      }
      throw new Error("Failed to check streaming status");
    } catch (error) {
      console.error("Error checking streaming status:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const hasTimeRules = async (userId: string): Promise<boolean> => {
    // Check cache first
    const cached = hasRulesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.hasRules;
    }

    try {
      // Check if we have the full data cached first
      const fullDataCached = globalTimeRuleCache.get(userId);
      if (fullDataCached) {
        const hasEnabledRules = fullDataCached.some((rule) => rule.enabled);
        hasRulesCache.set(userId, {
          hasRules: hasEnabledRules,
          timestamp: Date.now(),
        });
        return hasEnabledRules;
      }

      // Make a request to check if enabled rules exist
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/time-rules`
      );

      if (response.ok) {
        const data = await response.json();
        const hasEnabledRules =
          Array.isArray(data) && data.some((rule: any) => rule.enabled);
        // Cache the result
        hasRulesCache.set(userId, {
          hasRules: hasEnabledRules,
          timestamp: Date.now(),
        });
        return hasEnabledRules;
      }

      return false;
    } catch (error) {
      console.error("Error checking user time rules:", error);
      return false;
    }
  };

  const validateRuleArray = (
    rules: CreateTimeRuleDto[]
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      // Validate time range
      if (!validateTimeRange(rule.startTime, rule.endTime)) {
        errors.push(`Rule ${i + 1}: End time must be greater than start time`);
      }

      // Validate day of week
      if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
        errors.push(
          `Rule ${i + 1}: Day of week must be between 0 (Sunday) and 6 (Saturday)`
        );
      }

      // Check for overlaps with other rules in the array
      for (let j = i + 1; j < rules.length; j++) {
        const otherRule = rules[j];
        if (rulesOverlap(rule, otherRule)) {
          errors.push(
            `Rule ${i + 1} overlaps with rule ${j + 1} on the same day and time`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const clearCache = (userId?: string) => {
    if (userId) {
      globalTimeRuleCache.delete(userId);
      hasRulesCache.delete(userId);
    } else {
      globalTimeRuleCache.clear();
      hasRulesCache.clear();
      isInitialFetchDone = false;
    }
  };

  return {
    loading,
    getTimeRules,
    getAllTimeRules,
    createTimeRule,
    updateTimeRule,
    deleteTimeRule,
    createPreset,
    toggleTimeRule,
    checkStreamingAllowed,
    hasTimeRules,
    fetchAllTimeRules,
    validateRuleArray,
    clearCache,
  };
};

// Helper functions
function validateTimeRange(startTime: string, endTime: string): boolean {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return endMinutes > startMinutes;
}

function rulesOverlap(
  rule1: CreateTimeRuleDto,
  rule2: CreateTimeRuleDto
): boolean {
  // Different days don't overlap
  if (rule1.dayOfWeek !== rule2.dayOfWeek) {
    return false;
  }

  const [start1Hour, start1Minute] = rule1.startTime.split(":").map(Number);
  const [end1Hour, end1Minute] = rule1.endTime.split(":").map(Number);
  const [start2Hour, start2Minute] = rule2.startTime.split(":").map(Number);
  const [end2Hour, end2Minute] = rule2.endTime.split(":").map(Number);

  const start1 = start1Hour * 60 + start1Minute;
  const end1 = end1Hour * 60 + end1Minute;
  const start2 = start2Hour * 60 + start2Minute;
  const end2 = end2Hour * 60 + end2Minute;

  // Check for overlap: rule1 starts before rule2 ends AND rule1 ends after rule2 starts
  return start1 < end2 && end1 > start2;
}
