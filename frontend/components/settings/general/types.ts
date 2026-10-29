import type { AppSetting } from "@/types";
import type { SettingsFormData } from "../settings-utils";

export type SettingChange = (key: string, value: string | boolean) => void;

export interface SettingFieldProps {
  setting: AppSetting;
  formData: SettingsFormData;
  onChange: SettingChange;
  disabled: boolean;
}

export const settingText = (setting: AppSetting, formData: SettingsFormData) =>
  String(formData[setting.key] ?? setting.value);
