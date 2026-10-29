export const SETTINGS_TABS = [
  {
    id: "plex",
    label: "Plex",
    description: "How to reach your Plex Media Server",
  },
  {
    id: "guardian",
    label: "Guardian",
    description: "How devices, users and streams are treated",
  },
  {
    id: "customization",
    label: "Customization",
    description: "What you see, and what your users are told",
  },
  {
    id: "smtp",
    label: "Email",
    description: "Send notifications by email through your own SMTP server",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Which events you are told about, and where",
  },
  {
    id: "admin",
    label: "Maintenance",
    description: "Back up your settings, clean up data, or start over",
  },
  {
    id: "system",
    label: "System",
    description: "Which version you are running, and whether one is newer",
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const DEFAULT_SETTINGS_TAB: SettingsTabId = "plex";

export const isSettingsTab = (value: string): value is SettingsTabId =>
  SETTINGS_TABS.some((tab) => tab.id === value);

export const settingsTab = (id: string) =>
  SETTINGS_TABS.find((tab) => tab.id === id) ?? SETTINGS_TABS[0];
