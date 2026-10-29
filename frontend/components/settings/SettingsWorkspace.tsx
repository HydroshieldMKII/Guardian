"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useRegisterUnsavedChanges } from "@/hooks/settings/useRegisterUnsavedChanges";
import { useSettingsForm } from "@/hooks/settings/useSettingsForm";
import { useSettingsTab } from "@/hooks/settings/useSettingsTab";
import type { SettingUpdate } from "@/hooks/useSettings";
import type { AppSetting } from "@/types";
import { SETTINGS_TABS } from "./settings-tabs";
import { LeaveSettingsModal } from "./workspace/LeaveSettingsModal";
import { SettingsHeader } from "./workspace/SettingsHeader";
import { SettingsTabNav } from "./workspace/SettingsTabNav";
import { SettingsTabPanel } from "./workspace/SettingsTabPanel";
import { UnsavedChangesBar } from "./workspace/UnsavedChangesBar";

interface SettingsWorkspaceProps {
  settings: AppSetting[];
  updateSettings: (updates: SettingUpdate[]) => void;
  onSettingsRefresh: () => void;
}

export function SettingsWorkspace({
  settings,
  updateSettings,
  onSettingsRefresh,
}: SettingsWorkspaceProps) {
  const router = useRouter();
  const { activeTab, selectTab } = useSettingsTab();
  const form = useSettingsForm(settings, updateSettings);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  useRegisterUnsavedChanges(
    form.hasUnsavedChanges,
    form.saveBeforeLeaving,
    form.discard,
  );

  const leave = () => router.push("/");

  const requestLeave = () => {
    if (form.hasUnsavedChanges) setConfirmingLeave(true);
    else leave();
  };

  const discardAndLeave = () => {
    setConfirmingLeave(false);
    leave();
  };

  const saveAndLeave = () => {
    setConfirmingLeave(false);
    void form.saveBeforeLeaving().then(leave, () => undefined);
  };

  return (
    <div
      className={`container mx-auto max-w-6xl animate-in fade-in px-4 py-6 duration-300 ease-out motion-reduce:animate-none ${
        form.hasUnsavedChanges ? "pb-32" : ""
      }`}
    >
      <SettingsHeader
        onShowSystem={() => selectTab("system")}
        onBack={requestLeave}
      />

      <Tabs value={activeTab} onValueChange={selectTab} className="w-full">
        <SettingsTabNav activeTab={activeTab} onSelect={selectTab} />
        <div className="mt-6">
          {SETTINGS_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-6">
              <SettingsTabPanel
                tab={tab.id}
                settings={settings}
                formData={form.formData}
                onFormDataChange={form.change}
                hasUnsavedChanges={form.hasUnsavedChanges}
                onSettingsRefresh={onSettingsRefresh}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {form.hasUnsavedChanges && (
        <UnsavedChangesBar
          isSaving={form.isSaving}
          onCancel={form.discard}
          onSave={() => void form.save()}
        />
      )}

      <LeaveSettingsModal
        open={confirmingLeave}
        isSaving={form.isSaving}
        onStay={() => setConfirmingLeave(false)}
        onDiscard={discardAndLeave}
        onSave={saveAndLeave}
      />
    </div>
  );
}
