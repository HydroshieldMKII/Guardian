import { useEffect } from "react";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";

export function useRegisterUnsavedChanges(
  hasUnsavedChanges: boolean,
  saveAndLeave: () => Promise<void>,
  discard: () => void,
) {
  const { setHasUnsavedChanges, setOnSaveAndLeave, setOnDiscardChanges } =
    useUnsavedChanges();

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
