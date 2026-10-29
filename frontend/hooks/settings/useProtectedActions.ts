import { useState } from "react";
import type { ProtectedAction } from "@/components/settings/admin-tools/protected-actions";
import { useToast } from "@/hooks/use-toast";

export const RELOAD_DELAY_MS = 2000;

export function useProtectedActions(onSettingsRefresh?: () => void) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<ProtectedAction | null>(null);
  const [authorizing, setAuthorizing] = useState<ProtectedAction | null>(null);
  const [busy, setBusy] = useState<ProtectedAction | null>(null);

  const askPassword = () => {
    setAuthorizing(confirming);
    setConfirming(null);
  };

  const run = async (password: string) => {
    if (!authorizing) return;
    const action = authorizing;
    try {
      setBusy(action);
      await action.run(password);
      toast({ ...action.success, variant: "success" });
      if (action.refreshesSettings) onSettingsRefresh?.();
      setAuthorizing(null);
      if (action.reloads) {
        setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : action.failure,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return {
    confirming,
    authorizing,
    busy,
    confirm: setConfirming,
    cancelConfirm: () => setConfirming(null),
    askPassword,
    cancelPassword: () => setAuthorizing(null),
    run,
  };
}
