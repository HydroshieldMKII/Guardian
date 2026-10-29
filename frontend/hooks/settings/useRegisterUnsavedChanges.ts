import { useEffect } from "react";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";

export function useRegisterUnsavedChanges(
  hasUnsavedChanges: boolean,
  saveAndLeave: () => Promise<void>,
  discard: () => void,
  saveBlocked = false,
) {
  const {
    setHasUnsavedChanges,
    setSaveBlocked,
    setOnSaveAndLeave,
    setOnDiscardChanges,
  } = useUnsavedChanges();

  useEffect(() => {
    setSaveBlocked(saveBlocked);
    return () => setSaveBlocked(false);
  }, [saveBlocked, setSaveBlocked]);

  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
    return () => setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => {
    setOnSaveAndLeave(saveAndLeave);
    setOnDiscardChanges(discard);
    return () => {
      setOnSaveAndLeave(null);
      setOnDiscardChanges(null);
    };
  }, [saveAndLeave, discard, setOnSaveAndLeave, setOnDiscardChanges]);
}
