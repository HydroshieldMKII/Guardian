import { AppSetting } from "@/types";
import { getSettingInfo, getSecretInputDisplay } from "./settings-utils";

const setting = (key: string): AppSetting => ({ key }) as AppSetting;

describe("getSettingInfo", () => {
  it("returns the curated label and description for a known key", () => {
    expect(getSettingInfo(setting("PLEX_SERVER_IP"))).toEqual({
      label: "Plex server IP address",
      description: "IP address or hostname of your Plex Media Server",
    });
  });

  it.each([
    "PLEX_SERVER_PORT",
    "PLEX_TOKEN",
    "USE_SSL",
    "SMTP_ENABLED",
    "SMTP_HOST",
    "APPRISE_ENABLED",
    "CONCURRENT_STREAM_LIMIT",
    "USER_PORTAL_ENABLED",
    "TIMEZONE",
    "DEFAULT_PAGE",
  ])("has a non-empty label and description for %s", (key) => {
    const info = getSettingInfo(setting(key));
    expect(info.label.length).toBeGreaterThan(0);
    expect(info.description.length).toBeGreaterThan(0);
  });

  it("humanizes an unmapped key", () => {
    expect(getSettingInfo(setting("SOME_NEW_SETTING"))).toEqual({
      label: "Some New Setting",
      description: "",
    });
  });

  it("humanizes a single-word unmapped key", () => {
    expect(getSettingInfo(setting("EXPERIMENTAL")).label).toBe("Experimental");
  });

  it("returns an empty label for an empty key", () => {
    expect(getSettingInfo(setting("")).label).toBe("");
  });
});

describe("getSecretInputDisplay", () => {
  const secret = (value: string): AppSetting =>
    ({ key: "PLEX_TOKEN", value, private: true }) as AppSetting;

  it("hides an untouched masked secret behind a placeholder", () => {
    expect(
      getSecretInputDisplay(secret("••••••••"), "••••••••", "Enter plex token"),
    ).toEqual({
      value: "",
      placeholder: "•••••••• (saved)",
    });
  });

  it("shows the replacement once the user types one", () => {
    expect(
      getSecretInputDisplay(
        secret("••••••••"),
        "new-token",
        "Enter plex token",
      ),
    ).toEqual({
      value: "new-token",
      placeholder: "Enter plex token",
    });
  });

  it("keeps an unset secret as a normal empty field", () => {
    expect(getSecretInputDisplay(secret(""), "", "Enter plex token")).toEqual({
      value: "",
      placeholder: "Enter plex token",
    });
  });

  it("leaves a public setting untouched", () => {
    const publicSetting = {
      key: "PLEX_SERVER_IP",
      value: "10.0.0.2",
      private: false,
    } as AppSetting;

    expect(
      getSecretInputDisplay(
        publicSetting,
        "10.0.0.2",
        "Enter plex server ip address",
      ),
    ).toEqual({
      value: "10.0.0.2",
      placeholder: "Enter plex server ip address",
    });
  });
});

describe("optional settings", () => {
  it("marks a setting that is optional", () => {
    expect(getSettingInfo(setting("CUSTOM_PLEX_URL")).optional).toBe(true);
  });

  it("leaves a required setting unmarked", () => {
    expect(getSettingInfo(setting("PLEX_SERVER_IP")).optional).toBeUndefined();
  });
});
