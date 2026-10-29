import { useCallback, useEffect, useState } from "react";
import {
  changedSettings,
  formFromSettings,
  hasChangedSettings,
  mergeFormData,
} from "@/components/settings/settings-form";
import { invalidChangedSettings } from "@/components/settings/setting-validation";
import type { SettingsFormData } from "@/components/settings/settings-utils";
import { useToast } from "@/hooks/use-toast";
import type { SettingUpdate } from "@/hooks/useSettings";
import { ApiError, apiClient } from "@/lib/api";
import type { AppSetting } from "@/types";

export function useSettingsForm(
  settings: AppSetting[],
  updateSettings: (updates: SettingUpdate[]) => void,
) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SettingsFormData>(() =>
    formFromSettings(settings),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setFormData(formFromSettings(settings));
  }, [settings]);

  useEffect(() => {
    setHasUnsavedChanges(hasChangedSettings(settings, formData));
  }, [formData, settings]);

  const hasErrors =
    Object.keys(invalidChangedSettings(settings, formData)).length > 0;

  const change = (updates: Partial<SettingsFormData>) =>
    setFormData((current) => mergeFormData(current, updates));

  const discard = useCallback(() => {
    setFormData(formFromSettings(settings));
    setHasUnsavedChanges(false);
  }, [settings]);

  const commit = useCallback(async () => {
    if (hasErrors) throw new Error("Fix the highlighted settings first");
    const changes = changedSettings(settings, formData);
    setIsSaving(true);
    try {
      await apiClient.updateConfig(changes);
      updateSettings(changes.map(({ key, value }) => ({ key, value })));
      toast({
        title: "Settings saved",
        description: `${changes.length} ${changes.length === 1 ? "setting" : "settings"} updated.`,
        variant: "success",
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      if (!(error instanceof ApiError && error.status < 500)) {
        console.error("Error saving settings:", error);
      }
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [settings, formData, hasErrors, updateSettings, toast]);

  const saveBeforeLeaving = useCallback(async () => {
    if (hasUnsavedChanges) await commit();
  }, [hasUnsavedChanges, commit]);

  const save = async () => {
    const saved = hasUnsavedChanges ? await commit().catch(() => null) : 0;
    if (saved === 0) {
      toast({
        title: "No changes",
        description: "Nothing has been edited yet.",
      });
    }
  };

  return {
    formData,
    isSaving,
    hasUnsavedChanges,
    hasErrors,
    change,
    discard,
    save,
    saveBeforeLeaving,
  };
}
