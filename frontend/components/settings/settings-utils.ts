import { AppSetting } from "@/types";
import { SETTING_COPY } from "./setting-copy";

export interface SettingsFormData {
  [key: string]: string | boolean | number;
}

export interface SettingInfo {
  label: string;
  description: string;
  optional?: boolean;
}

export interface ConnectionStatus {
  success: boolean;
  message: string;
}

export interface VersionMismatchInfo {
  currentVersion: string;
  importVersion: string;
}

export interface SecretInputDisplay {
  value: string;
  placeholder: string;
}

export const getSecretInputDisplay = (
  setting: AppSetting,
  value: string,
  fallbackPlaceholder: string,
): SecretInputDisplay => {
  if (setting.private && value !== "" && value === setting.value) {
    return { value: "", placeholder: "•••••••• (saved)" };
  }
  return { value, placeholder: fallbackPlaceholder };
};

export const getSettingInfo = (setting: AppSetting): SettingInfo => {
  const info = SETTING_COPY[setting.key];
  const label =
    info?.label ||
    setting.key
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  const description = info?.description || "";

  return info?.optional
    ? { label, description, optional: true }
    : { label, description };
};
