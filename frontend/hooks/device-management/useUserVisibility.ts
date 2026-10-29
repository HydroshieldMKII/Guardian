import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { UserPreference } from "@/types";

const NO_USERS: UserPreference[] = [];

interface HideCandidate {
  userId: string;
  username: string;
}

interface UserVisibilityOptions {
  users?: UserPreference[];
  refresh: () => Promise<void>;
  onHidden: (userId: string) => void;
}

export const useUserVisibility = ({
  users,
  refresh,
  onHidden,
}: UserVisibilityOptions) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hiddenUsersOpen, setHiddenUsersOpen] = useState(false);
  const [hideCandidate, setHideCandidate] = useState<HideCandidate | null>(
    null,
  );
  const { data: hiddenUsers = NO_USERS, isLoading: loadingHiddenUsers } =
    useQuery({
      queryKey: queryKeys.hiddenUsers,
      queryFn: () => apiClient.getHiddenUsers<UserPreference[]>(),
      enabled: hiddenUsersOpen,
    });

  const refreshAfterChange = async () => {
    void refresh();
    await queryClient.invalidateQueries({ queryKey: queryKeys.hiddenUsers });
  };

  const toggleVisibility = async (userId: string) => {
    const user =
      users?.find((u) => u.userId === userId) ||
      hiddenUsers.find((u) => u.userId === userId);
    const username = user?.username || userId;

    if (!user?.hidden) {
      setHideCandidate({ userId, username });
      return;
    }

    try {
      await apiClient.toggleUserVisibility(userId);
      toast({
        title: "User shown",
        description: `${username} is back in the main user list`,
        variant: "success",
      });
      await refreshAfterChange();
    } catch (error) {
      console.error("Failed to toggle user visibility:", error);
      toast({
        title: "Error",
        description: "Failed to update user visibility",
        variant: "destructive",
      });
    }
  };

  const confirmHide = async () => {
    if (!hideCandidate) return;
    const { userId, username } = hideCandidate;

    try {
      await apiClient.toggleUserVisibility(userId);
      onHidden(userId);
      toast({
        title: "User hidden",
        description: `${username} is now under "Hidden users" at the bottom of the user list. Their policies still apply.`,
        variant: "success",
      });
      await refreshAfterChange();
    } catch (error) {
      console.error("Failed to hide user:", error);
      toast({
        title: "Error",
        description: "Failed to hide user",
        variant: "destructive",
      });
    } finally {
      setHideCandidate(null);
    }
  };

  return {
    hiddenUsers,
    loadingHiddenUsers,
    hiddenUsersOpen,
    setHiddenUsersOpen,
    hideCandidate,
    toggleVisibility,
    confirmHide,
    cancelHide: () => setHideCandidate(null),
  };
};
