"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useRegisterUnsavedChanges } from "@/hooks/settings/useRegisterUnsavedChanges";
import { useBrowserLeaveGuard } from "@/hooks/settings/useBrowserLeaveGuard";
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
  const [leaveRequest, setLeaveRequest] = useState<"home" | "history" | null>(
    null,
  );
  useRegisterUnsavedChanges(
    form.hasUnsavedChanges,
    form.saveBeforeLeaving,
    form.discard,
    form.hasErrors,
  );

  const { leaveHistory } = useBrowserLeaveGuard(form.hasUnsavedChanges, () =>
    setLeaveRequest("history"),
  );

  const leave = () => {
    if (leaveRequest === "history") leaveHistory();
    else router.push("/");
  };

  const requestLeave = () => {
    if (form.hasUnsavedChanges) setLeaveRequest("home");
    else router.push("/");
  };

  const discardAndLeave = () => {
    leave();
    setLeaveRequest(null);
  };

  const saveAndLeave = () => {
    setLeaveRequest(null);
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
          saveBlocked={form.hasErrors}
          onCancel={form.discard}
          onSave={() => void form.save()}
        />
      )}

      <LeaveSettingsModal
        open={leaveRequest !== null}
        isSaving={form.isSaving}
        saveBlocked={form.hasErrors}
        onStay={() => setLeaveRequest(null)}
        onDiscard={discardAndLeave}
        onSave={saveAndLeave}
      />
    </div>
  );
}
