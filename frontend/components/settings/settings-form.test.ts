import {
  changedSettings,
  formFromSettings,
  hasChangedSettings,
  mergeFormData,
} from "@/components/settings/settings-form";
import { appSetting } from "@/test-utils/dashboard";

const settings = [
  appSetting("PLEX_SERVER_IP", "10.0.0.2"),
  { ...appSetting("AUTO_CHECK_UPDATES", "true"), type: "boolean" as const },
];

describe("formFromSettings", () => {
  it("keys every stored value by its setting", () => {
    expect(formFromSettings(settings)).toEqual({
      PLEX_SERVER_IP: "10.0.0.2",
      AUTO_CHECK_UPDATES: "true",
    });
  });
});

describe("hasChangedSettings", () => {
  it("ignores fields the form never touched", () => {
    expect(hasChangedSettings(settings, {})).toBe(false);
  });

  it("treats a boolean that matches the stored text as unchanged", () => {
    expect(hasChangedSettings(settings, { AUTO_CHECK_UPDATES: true })).toBe(
      false,
    );
  });

  it("spots a value that differs from what is stored", () => {
    expect(hasChangedSettings(settings, { PLEX_SERVER_IP: "10.0.0.3" })).toBe(
      true,
    );
  });
});

describe("changedSettings", () => {
  it("lists only the edited settings, as text, with their type", () => {
    expect(
      changedSettings(settings, {
        PLEX_SERVER_IP: "10.0.0.2",
        AUTO_CHECK_UPDATES: false,
      }),
    ).toEqual([{ key: "AUTO_CHECK_UPDATES", value: "false", type: "boolean" }]);
  });
});

describe("mergeFormData", () => {
  it("applies defined updates and skips undefined ones", () => {
    expect(
      mergeFormData(
        { PLEX_SERVER_IP: "10.0.0.2", PLEX_SERVER_PORT: "32400" },
        { PLEX_SERVER_IP: "10.0.0.3", PLEX_SERVER_PORT: undefined },
      ),
    ).toEqual({ PLEX_SERVER_IP: "10.0.0.3", PLEX_SERVER_PORT: "32400" });
  });
});
