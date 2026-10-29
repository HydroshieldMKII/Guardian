import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS_TAB,
  isSettingsTab,
  type SettingsTabId,
} from "@/components/settings/settings-tabs";

const tabFromHash = () => {
  const hash = window.location.hash.slice(1);
  return isSettingsTab(hash) ? hash : null;
};

export function useSettingsTab() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    () => tabFromHash() ?? DEFAULT_SETTINGS_TAB,
  );

  useEffect(() => {
    window.history.replaceState(null, "", `#${activeTab}`);
  }, [activeTab]);

  useEffect(() => {
    const followHash = () => {
      const tab = tabFromHash();
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  const selectTab = (value: string) => {
    if (isSettingsTab(value)) setActiveTab(value);
  };

  return { activeTab, selectTab };
}
