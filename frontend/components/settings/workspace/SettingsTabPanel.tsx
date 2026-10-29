import { AdminTools } from "@/components/settings/AdminTools";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { AppriseSettings } from "@/components/settings/AppriseSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { PlexSettings } from "@/components/settings/PlexSettings";
import { SMTPSettings } from "@/components/settings/SMTPSettings";
import { SystemInfo } from "@/components/settings/SystemInfo";
import type { SettingsTabId } from "@/components/settings/settings-tabs";
import type { SettingsFormData } from "@/components/settings/settings-utils";
import type { AppSetting } from "@/types";

interface SettingsTabPanelProps {
  tab: SettingsTabId;
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  hasUnsavedChanges: boolean;
  onSettingsRefresh: () => void;
}

export function SettingsTabPanel({
  tab,
  hasUnsavedChanges,
  onSettingsRefresh,
  ...form
}: SettingsTabPanelProps) {
  switch (tab) {
    case "plex":
      return <PlexSettings {...form} hasUnsavedChanges={hasUnsavedChanges} />;
    case "guardian":
      return <GeneralSettings {...form} sectionId={tab} />;
    case "customization":
      return (
        <>
          <AppearanceSettings />
          <GeneralSettings {...form} sectionId={tab} />
        </>
      );
    case "smtp":
      return <SMTPSettings {...form} hasUnsavedChanges={hasUnsavedChanges} />;
    case "notifications":
      return (
        <div className="space-y-6">
          <GeneralSettings {...form} sectionId={tab} />
          <AppriseSettings {...form} hasUnsavedChanges={hasUnsavedChanges} />
        </div>
      );
    case "admin":
      return <AdminTools onSettingsRefresh={onSettingsRefresh} />;
    case "system":
      return <SystemInfo {...form} />;
  }
}
