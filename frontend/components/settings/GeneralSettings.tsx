"use client";

import { AppSetting } from "@/types";
import { GeneralSettingField } from "./general/GeneralSettingField";
import { CHILD_GROUPS, SECTIONS, type SettingGroup } from "./general/sections";
import { SettingsCard } from "./settings-ui";
import { SettingsFormData } from "./settings-utils";

interface GeneralSettingsProps {
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  sectionId: string;
}

export function GeneralSettings({
  settings,
  formData,
  onFormDataChange,
  sectionId,
}: GeneralSettingsProps) {
  const findSetting = (key: string) =>
    settings.find((setting) => setting?.key === key);

  const existing = (keys: string[]) =>
    keys
      .map(findSetting)
      .filter((setting): setting is AppSetting => Boolean(setting));

  const groupSettings = (group: SettingGroup) => {
    const extras = group.extra
      ? settings.filter(
          (setting) =>
            setting?.key &&
            group.extra?.(setting.key) &&
            !group.keys.includes(setting.key),
        )
      : [];
    return [...existing(group.keys), ...extras];
  };

  const field = (setting: AppSetting, disabled = false) => (
    <GeneralSettingField
      key={setting.key}
      setting={setting}
      settings={settings}
      formData={formData}
      onChange={(key, value) => onFormDataChange({ [key]: value })}
      disabled={disabled}
    />
  );

  const entry = (setting: AppSetting) => {
    const childGroup = CHILD_GROUPS.find(
      (candidate) => candidate.parent === setting.key,
    );
    if (!childGroup) return field(setting);

    const children = existing(childGroup.children);
    const disabled = childGroup.isDisabled(
      formData[setting.key] ?? setting.value,
    );
    return (
      <div className="space-y-4" key={setting.key}>
        {field(setting)}
        {children.length > 0 && (
          <div className="space-y-4 border-l-2 pl-4 sm:ml-1">
            {children.map((child) => field(child, disabled))}
          </div>
        )}
      </div>
    );
  };

  const cards = (SECTIONS[sectionId] ?? [])
    .map((group) => ({ group, entries: groupSettings(group) }))
    .filter(({ entries }) => entries.length > 0);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {cards.map(({ group, entries }) => (
        <SettingsCard
          key={group.title}
          title={group.title}
          description={group.description}
          divided
        >
          {entries.map(entry)}
        </SettingsCard>
      ))}
    </div>
  );
}
