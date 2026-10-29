"use client";

import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { PageLoader } from "@/components/three-dot-loader";
import { EmptyState } from "@/components/ui/entity";
import { useSettings } from "@/hooks/useSettings";

export default function SettingsPage() {
  const { settings, loading, refreshSettings, updateSettings } = useSettings();

  if (loading) {
    return <PageLoader />;
  }

  if (settings.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          title="Settings unavailable"
          description="Settings could not be loaded. Refresh the page to try again."
        />
      </div>
    );
  }

  return (
    <SettingsWorkspace
      settings={settings}
      updateSettings={updateSettings}
      onSettingsRefresh={() => void refreshSettings()}
    />
  );
}
