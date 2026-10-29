import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SessionHistoryEntry } from "@/lib/session-history";
import { sessionHistoryApi } from "@/lib/session-history-api";

export function useSessionDeletion(removeSession: (id: number) => void) {
  const { toast } = useToast();
  const [pending, setPending] = useState<SessionHistoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fail = (description: string) =>
    toast({ title: "Delete failed", description, variant: "destructive" });

  const confirm = async () => {
    if (!pending) return;

    setDeleting(true);
    try {
      if (await sessionHistoryApi.remove(pending.id)) {
        removeSession(pending.id);
        setPending(null);
        toast({
          title: "Session deleted",
          description: "That entry is gone from this user's stream history.",
          variant: "success",
        });
      } else {
        fail("Could not delete that entry. Try again.");
      }
    } catch {
      fail("Something went wrong while deleting that entry.");
    } finally {
      setDeleting(false);
    }
  };

  return {
    pending,
    deleting,
    request: setPending,
    cancel: () => setPending(null),
    confirm,
  };
}
