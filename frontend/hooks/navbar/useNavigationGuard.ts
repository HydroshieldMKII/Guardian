import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { useToast } from "@/hooks/use-toast";

const SETTINGS_PATH = "/settings";

export function useNavigationGuard(pathname: string) {
  const [isSaving, setIsSaving] = useState(false);
  const {
    hasUnsavedChanges,
    showUnsavedWarning,
    saveBlocked,
    setShowUnsavedWarning,
    pendingNavigation,
    setPendingNavigation,
    onSaveAndLeave,
    onDiscardChanges,
  } = useUnsavedChanges();
  const router = useRouter();
  const { toast } = useToast();

  const leave = () => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setPendingNavigation(null);
  };

  const guard = (event: MouseEvent, href: string) => {
    if (
      pathname === SETTINGS_PATH &&
      hasUnsavedChanges &&
      href !== SETTINGS_PATH
    ) {
      event.preventDefault();
      setPendingNavigation(href);
      setShowUnsavedWarning(true);
    }
  };

  const stay = () => {
    setShowUnsavedWarning(false);
    setPendingNavigation(null);
  };

  const discard = () => {
    setShowUnsavedWarning(false);
    onDiscardChanges?.();
    leave();
  };

  const saveAndLeave = async () => {
    if (!onSaveAndLeave) return;
    setIsSaving(true);
    try {
      await onSaveAndLeave();
      setShowUnsavedWarning(false);
      leave();
    } catch {
      toast({
        title: "Error",
        description: "Failed to save your changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    guard,
    warningOpen: showUnsavedWarning,
    isSaving,
    saveBlocked,
    stay,
    discard,
    saveAndLeave,
  };
}
