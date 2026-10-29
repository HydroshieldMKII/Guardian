import {
  invalidChangedSettings,
  settingError,
} from "@/components/settings/setting-validation";
import { appSetting } from "@/test-utils/dashboard";

describe("settingError numeric ranges", () => {
  it.each([
    ["CONCURRENT_STREAM_LIMIT", "0"],
    ["CONCURRENT_STREAM_LIMIT", "1000"],
    ["PLEXGUARD_REFRESH_INTERVAL", "5"],
    ["PLEXGUARD_REFRESH_INTERVAL", "86400"],
    ["DEVICE_CLEANUP_INTERVAL_DAYS", "3650"],
    ["SMTP_PORT", "65535"],
    ["PLEX_SERVER_PORT", "1"],
  ])("accepts %s = %s", (key, value) => {
    expect(settingError(key, value)).toBeNull();
  });

  it.each([
    ["CONCURRENT_STREAM_LIMIT", "-1"],
    ["CONCURRENT_STREAM_LIMIT", "1.5"],
    ["CONCURRENT_STREAM_LIMIT", "99999999999"],
    ["CONCURRENT_STREAM_LIMIT", ""],
    ["PLEXGUARD_REFRESH_INTERVAL", "4"],
    ["DEVICE_CLEANUP_INTERVAL_DAYS", "0"],
    ["SMTP_PORT", "99999999"],
    ["SMTP_PORT", "0"],
    ["PLEX_SERVER_PORT", "abc"],
  ])("rejects %s = %p", (key, value) => {
    expect(settingError(key, value)).toMatch(/must be/);
  });

  it("names the allowed range", () => {
    expect(settingError("PLEXGUARD_REFRESH_INTERVAL", "1")).toBe(
      "Session refresh interval must be between 5 and 86400",
    );
    expect(settingError("SMTP_PORT", "1.5")).toBe(
      "SMTP port must be a whole number between 1 and 65535",
    );
  });
});

describe("settingError text formats", () => {
  it.each(["", "mail.example.com", "10.0.0.2", "[::1]"])(
    "accepts host %p",
    (value) => {
      expect(settingError("SMTP_HOST", value)).toBeNull();
    },
  );

  it.each(["not a host !!", "http://mail.example.com", "a/b"])(
    "rejects host %p",
    (value) => {
      expect(settingError("SMTP_HOST", value)).toBe(
        "SMTP host must be a hostname or IP address without spaces, scheme or path",
      );
    },
  );

  it("validates the from email only when filled", () => {
    expect(settingError("SMTP_FROM_EMAIL", "")).toBeNull();
    expect(settingError("SMTP_FROM_EMAIL", "user@example.com")).toBeNull();
    expect(settingError("SMTP_FROM_EMAIL", "notanemail")).toBe(
      "From email must be a valid email address",
    );
  });

  it("validates every recipient", () => {
    expect(
      settingError(
        "SMTP_TO_EMAILS",
        "a@example.com, b@example.com\nc@example.com",
      ),
    ).toBeNull();
    expect(settingError("SMTP_TO_EMAILS", "a@example.com, nope")).toBe(
      "Invalid email address: nope",
    );
  });

  it("ignores booleans and settings without a rule", () => {
    expect(settingError("SMTP_ENABLED", true)).toBeNull();
    expect(settingError("SMTP_USER", "anything")).toBeNull();
    expect(settingError("SMTP_PORT", undefined)).toBeNull();
    expect(settingError("SMTP_PORT", 587)).toBeNull();
  });
});

describe("invalidChangedSettings", () => {
  const settings = [
    appSetting("SMTP_PORT", "587"),
    appSetting("SMTP_HOST", "bad host"),
  ];

  it("reports only edited settings that fail their rule", () => {
    expect(
      invalidChangedSettings(settings, {
        SMTP_PORT: "0",
        SMTP_HOST: "bad host",
      }),
    ).toEqual({ SMTP_PORT: "SMTP port must be between 1 and 65535" });
  });

  it("is empty when nothing invalid was edited", () => {
    expect(invalidChangedSettings(settings, { SMTP_PORT: "25" })).toEqual({});
    expect(invalidChangedSettings(settings, {})).toEqual({});
  });
});
