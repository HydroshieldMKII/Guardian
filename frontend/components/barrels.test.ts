import * as deviceManagement from "@/components/device-management/index";
import * as settings from "@/components/settings/index";
import * as streams from "@/components/streams/index";

describe("barrel exports", () => {
  it.each([
    "UserGroupCard",
    "DeviceCard",
    "DeviceDetailsModal",
    "TemporaryAccessModal",
    "ConfirmationModal",
    "UserHistoryModal",
    "IPAccessModal",
    "TimeRuleModal",
    "ConcurrentStreamModal",
    "ClickableIP",
    "UserAvatar",
    "DeviceStatus",
    "getUserPreferenceBadge",
  ])("device management re-exports %s", (name) => {
    expect(
      deviceManagement[name as keyof typeof deviceManagement],
    ).toBeDefined();
  });

  it.each([
    "PlexSettings",
    "SMTPSettings",
    "DatabaseManagement",
    "GeneralSettings",
    "AdminTools",
    "getSettingInfo",
  ])("settings re-exports %s", (name) => {
    expect(settings[name as keyof typeof settings]).toBeDefined();
  });

  it.each([
    "ClickableIP",
    "getDeviceIcon",
    "formatDuration",
    "getProgressPercentage",
    "getContentTitle",
    "getDetailedQuality",
    "StreamQuality",
    "StreamQualityDetails",
    "StreamDeviceInfo",
    "StreamProgress",
    "RemoveAccessModal",
    "StreamCard",
  ])("streams re-exports %s", (name) => {
    expect(streams[name as keyof typeof streams]).toBeDefined();
  });
});
