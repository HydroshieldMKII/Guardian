import {
  isSettingsTab,
  SETTINGS_TABS,
  settingsTab,
} from "@/components/settings/settings-tabs";

describe("settings tabs", () => {
  it("recognises only known tab ids", () => {
    expect(isSettingsTab("smtp")).toBe(true);
    expect(isSettingsTab("billing")).toBe(false);
  });

  it("finds a tab by its id", () => {
    expect(settingsTab("admin").label).toBe("Maintenance");
  });

  it("falls back to the first tab for an unknown id", () => {
    expect(settingsTab("billing")).toBe(SETTINGS_TABS[0]);
  });
});
