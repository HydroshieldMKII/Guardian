import { useState } from "react";
import { useUserPreferences } from "@/hooks/device-management/useUserPreferences";
import { useToast } from "@/hooks/use-toast";
import type { UserPreference } from "@/types";

const DEFAULT_POLICY_FAILED = {
  title: "Update failed",
  description: "Failed to update the New devices rule",
  variant: "destructive",
} as const;

export const useUserPolicyUpdates = (refresh: () => Promise<void>) => {
  const { toast } = useToast();
  const { updateUserPreference, updateUserIPPolicy } = useUserPreferences();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const updateDefaultPolicy = async (
    userId: string,
    defaultBlock: boolean | null,
  ) => {
    setUpdatingUserId(userId);
    try {
      if (await updateUserPreference(userId, defaultBlock)) {
        await refresh();
        toast({
          title: "Default device policy updated",
          description:
            "New devices from this user will follow the policy you picked",
          variant: "success",
        });
      } else {
        toast(DEFAULT_POLICY_FAILED);
      }
    } catch (error) {
      console.error("Error updating user preference:", error);
      toast(DEFAULT_POLICY_FAILED);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateIPPolicy = async (
    userId: string,
    updates: Partial<UserPreference>,
  ) => {
    if (await updateUserIPPolicy(userId, updates)) {
      void refresh();
      toast({
        title: "IP access updated",
        description:
          "The new network and IP rules apply to every device this user owns",
        variant: "success",
      });
    } else {
      toast({
        title: "Update failed",
        description: "Failed to update the IP access policies",
        variant: "destructive",
      });
    }
  };

  return { updatingUserId, updateDefaultPolicy, updateIPPolicy };
};
