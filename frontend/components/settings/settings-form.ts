import type { AppSetting } from "@/types";
import type { SettingsFormData } from "./settings-utils";

export const formFromSettings = (settings: AppSetting[]): SettingsFormData =>
  Object.fromEntries(settings.map(({ key, value }) => [key, value]));

export const hasChangedSettings = (
  settings: AppSetting[],
  formData: SettingsFormData,
) =>
  settings.some(
    ({ key, value }) =>
      formData[key] !== undefined && String(formData[key]) !== value,
  );

export const changedSettings = (
  settings: AppSetting[],
  formData: SettingsFormData,
) =>
  settings
    .filter(
      ({ key, value }) =>
        formData[key] !== undefined && formData[key] !== value,
    )
    .map(({ key, type }) => ({ key, value: String(formData[key]), type }));

export const mergeFormData = (
  formData: SettingsFormData,
  updates: Partial<SettingsFormData>,
): SettingsFormData => {
  const merged = { ...formData };
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) merged[key] = value;
  });
  return merged;
};
