"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, User, BellRing } from "lucide-react";
import { AppSetting } from "@/types";
import { getSettingInfo, SettingsFormData } from "./settings-utils";

// Helper function to get current time in a specific timezone offset
const getCurrentTimeInOffset = (offsetString: string): string => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;

  // Parse offset string (e.g. "+05:30" or "-08:00")
  const sign = offsetString.charAt(0) === "+" ? 1 : -1;
  const [hours, minutes = 0] = offsetString.slice(1).split(":").map(Number);
  const offsetMinutes = sign * (hours * 60 + minutes);

  const targetTime = new Date(utc + offsetMinutes * 60000);
  return targetTime.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface GeneralSettingsProps {
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  sectionId: string;
}

export function GeneralSettings({
  settings,
  formData,
  onFormDataChange,
  sectionId,
}: GeneralSettingsProps) {
  const handleInputChange = (key: string, value: string | boolean) => {
    onFormDataChange({ [key]: value });
  };

  const getSectionSettings = (section: string) => {
    const getSettingOrder = (section: string, settingKey: string): number => {
      const orderMaps = {
        guardian: [
          "AUTO_CHECK_UPDATES", // Application updates - now at top
          "PLEX_GUARD_DEFAULT_BLOCK", // Core security
          "PLEXGUARD_REFRESH_INTERVAL", // Session monitoring interval
          "CONCURRENT_STREAM_LIMIT", // Concurrent stream limit
          "CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS", // Include temp access in limit
          "DEVICE_CLEANUP_ENABLED", // Device cleanup feature
          "DEVICE_CLEANUP_INTERVAL_DAYS", // Device cleanup interval (follows the feature toggle)
          "TIMEZONE", // Display/locale setting
          "USER_PORTAL_ENABLED", // User portal settings
          "USER_PORTAL_SHOW_RULES",
          "USER_PORTAL_ALLOW_REJECTED_REQUESTS",
        ],
        customization: [
          "DEFAULT_PAGE",
          "ENABLE_MEDIA_THUMBNAILS",
          "ENABLE_MEDIA_ARTWORK",
          "MSG_DEVICE_PENDING",
          "MSG_DEVICE_REJECTED",
          "MSG_TIME_RESTRICTED",
          "MSG_CONCURRENT_LIMIT",
          "MSG_IP_LAN_ONLY",
          "MSG_IP_WAN_ONLY",
          "MSG_IP_NOT_ALLOWED",
        ],
        notifications: [
          "IN_APP_ENABLED",
          "IN_APP_NOTIFY_ON_NEW_DEVICE",
          "IN_APP_NOTIFY_ON_BLOCK",
          "IN_APP_NOTIFY_ON_LOCATION_CHANGE",
          "IN_APP_NOTIFY_ON_DEVICE_NOTE",
          "AUTO_MARK_NOTIFICATION_READ",
        ],
      };

      const order = orderMaps[section as keyof typeof orderMaps];
      const index = order?.indexOf(settingKey);
      return index !== undefined && index >= 0 ? index : 999;
    };

    let filteredSettings: AppSetting[];
    switch (section) {
      case "guardian":
        filteredSettings = settings.filter((setting) =>
          [
            "PLEX_GUARD_DEFAULT_BLOCK",
            "PLEXGUARD_REFRESH_INTERVAL",
            "AUTO_CHECK_UPDATES",
            "CONCURRENT_STREAM_LIMIT",
            "CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS",
            "DEVICE_CLEANUP_ENABLED",
            "DEVICE_CLEANUP_INTERVAL_DAYS",
            "TIMEZONE",
            "USER_PORTAL_ENABLED",
            "USER_PORTAL_SHOW_RULES",
            "USER_PORTAL_ALLOW_REJECTED_REQUESTS",
          ].includes(setting.key)
        );
        break;
      case "customization":
        filteredSettings = settings.filter(
          (setting) =>
            [
              "DEFAULT_PAGE",
              "ENABLE_MEDIA_THUMBNAILS",
              "ENABLE_MEDIA_ARTWORK",
            ].includes(setting.key) || setting.key.startsWith("MSG_")
        );
        break;
      case "notifications":
        filteredSettings = settings.filter((setting) =>
          [
            "IN_APP_ENABLED",
            "AUTO_MARK_NOTIFICATION_READ",
            "IN_APP_NOTIFY_ON_NEW_DEVICE",
            "IN_APP_NOTIFY_ON_BLOCK",
            "IN_APP_NOTIFY_ON_LOCATION_CHANGE",
            "IN_APP_NOTIFY_ON_DEVICE_NOTE",
          ].includes(setting.key)
        );
        break;
      default:
        filteredSettings = [];
    }

    // Sort the filtered settings according to the defined order
    return filteredSettings.sort(
      (a, b) =>
        getSettingOrder(section, a.key) - getSettingOrder(section, b.key)
    );
  };

  const getSectionInfo = (section: string) => {
    switch (section) {
      case "guardian":
        return {
          title: "Guardian Configuration",
          description: "Core Guardian behavior and security settings",
          icon: Shield,
        };
      case "customization":
        return {
          title: "Customization",
          description:
            "Customize user interface, messages, and user experience",
          icon: User,
        };
      case "notifications":
        return {
          title: "Notification Settings",
          description: "Configure notification behavior and preferences",
          icon: BellRing,
        };
      default:
        return {
          title: "Settings",
          description: "Application settings",
          icon: Shield,
        };
    }
  };

  const renderDeviceCleanupGroup = (settings: AppSetting[]) => {
    const cleanupEnabledSetting = settings.find(
      (s) => s.key === "DEVICE_CLEANUP_ENABLED"
    );
    const cleanupIntervalSetting = settings.find(
      (s) => s.key === "DEVICE_CLEANUP_INTERVAL_DAYS"
    );

    if (!cleanupEnabledSetting || !cleanupIntervalSetting) return null;

    const cleanupEnabledInfo = getSettingInfo(cleanupEnabledSetting);
    const cleanupIntervalInfo = getSettingInfo(cleanupIntervalSetting);

    const cleanupEnabledValue =
      formData[cleanupEnabledSetting.key] ?? cleanupEnabledSetting.value;
    const cleanupIntervalValue =
      formData[cleanupIntervalSetting.key] ?? cleanupIntervalSetting.value;

    const isCleanupEnabled =
      cleanupEnabledValue === "true" || cleanupEnabledValue === true;

    return (
      <div className="space-y-4">
        {/* Parent setting */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor={cleanupEnabledSetting.key}>
              {cleanupEnabledInfo.label}
            </Label>
            {cleanupEnabledInfo.description && (
              <p className="text-sm text-muted-foreground">
                {cleanupEnabledInfo.description}
              </p>
            )}
          </div>
          <Switch
            id={cleanupEnabledSetting.key}
            checked={isCleanupEnabled}
            onCheckedChange={(checked) =>
              handleInputChange(cleanupEnabledSetting.key, checked)
            }
            className="cursor-pointer"
          />
        </div>

        {/* Child setting - indented */}
        <div
          className={`ml-6 space-y-2 transition-opacity duration-200 ${!isCleanupEnabled ? "opacity-50" : ""}`}
        >
          <Label
            htmlFor={cleanupIntervalSetting.key}
            className={!isCleanupEnabled ? "text-muted-foreground" : ""}
          >
            {cleanupIntervalInfo.label}
          </Label>
          {cleanupIntervalInfo.description && (
            <p className="text-sm text-muted-foreground">
              {cleanupIntervalInfo.description}
            </p>
          )}
          <Input
            id={cleanupIntervalSetting.key}
            type="number"
            value={
              typeof cleanupIntervalValue === "string"
                ? cleanupIntervalValue
                : String(cleanupIntervalValue)
            }
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleInputChange(cleanupIntervalSetting.key, e.target.value)
            }
            placeholder="Enter device cleanup interval"
            disabled={!isCleanupEnabled}
            className="cursor-pointer"
          />
        </div>
      </div>
    );
  };

  const renderConcurrentStreamGroup = (settings: AppSetting[]) => {
    const concurrentLimitSetting = settings.find(
      (s) => s.key === "CONCURRENT_STREAM_LIMIT"
    );
    const includeTempAccessSetting = settings.find(
      (s) => s.key === "CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS"
    );

    if (!concurrentLimitSetting) return null;

    const concurrentLimitInfo = getSettingInfo(concurrentLimitSetting);
    const includeTempAccessInfo = includeTempAccessSetting
      ? getSettingInfo(includeTempAccessSetting)
      : null;

    const concurrentLimitValue =
      formData[concurrentLimitSetting.key] ?? concurrentLimitSetting.value;
    const includeTempAccessValue = includeTempAccessSetting
      ? (formData[includeTempAccessSetting.key] ??
        includeTempAccessSetting.value)
      : false;

    return (
      <div className="space-y-4">
        {/* Parent setting - concurrent stream limit */}
        <div className="space-y-2">
          <Label htmlFor={concurrentLimitSetting.key}>
            {concurrentLimitInfo.label}
          </Label>
          {concurrentLimitInfo.description && (
            <p className="text-sm text-muted-foreground">
              {concurrentLimitInfo.description}
            </p>
          )}
          <Input
            id={concurrentLimitSetting.key}
            type="number"
            min="0"
            value={
              typeof concurrentLimitValue === "string"
                ? concurrentLimitValue
                : String(concurrentLimitValue)
            }
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleInputChange(concurrentLimitSetting.key, e.target.value)
            }
            placeholder="0 = unlimited"
            className="cursor-pointer"
          />
        </div>

        {/* Child setting - include temp access */}
        {includeTempAccessSetting && includeTempAccessInfo && (
          <div
            className={`ml-6 transition-opacity duration-200 ${Number(concurrentLimitValue) === 0 ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor={includeTempAccessSetting.key}
                  className={
                    Number(concurrentLimitValue) === 0
                      ? "text-muted-foreground"
                      : ""
                  }
                >
                  {includeTempAccessInfo.label}
                </Label>
                {includeTempAccessInfo.description && (
                  <p className="text-sm text-muted-foreground">
                    {includeTempAccessInfo.description}
                  </p>
                )}
              </div>
              <Switch
                id={includeTempAccessSetting.key}
                checked={
                  includeTempAccessValue === "true" ||
                  includeTempAccessValue === true
                }
                onCheckedChange={(checked) =>
                  handleInputChange(includeTempAccessSetting.key, checked)
                }
                disabled={Number(concurrentLimitValue) === 0}
                className="cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNotificationGroup = (settings: AppSetting[]) => {
    const inAppEnabledSetting = settings.find(
      (s) => s.key === "IN_APP_ENABLED"
    );
    const notifyOnNewDeviceSetting = settings.find(
      (s) => s.key === "IN_APP_NOTIFY_ON_NEW_DEVICE"
    );
    const notifyOnBlockSetting = settings.find(
      (s) => s.key === "IN_APP_NOTIFY_ON_BLOCK"
    );
    const notifyOnLocationChangeSetting = settings.find(
      (s) => s.key === "IN_APP_NOTIFY_ON_LOCATION_CHANGE"
    );
    const autoMarkReadSetting = settings.find(
      (s) => s.key === "AUTO_MARK_NOTIFICATION_READ"
    );

    if (
      !inAppEnabledSetting ||
      !notifyOnNewDeviceSetting ||
      !notifyOnBlockSetting ||
      !notifyOnLocationChangeSetting ||
      !autoMarkReadSetting
    )
      return null;

    const inAppEnabledInfo = getSettingInfo(inAppEnabledSetting);
    const inAppEnabledValue =
      formData[inAppEnabledSetting.key] ?? inAppEnabledSetting.value;
    const isInAppEnabled =
      inAppEnabledValue === "true" || inAppEnabledValue === true;

    const renderNotificationSwitch = (setting: AppSetting) => {
      const info = getSettingInfo(setting);
      const value = formData[setting.key] ?? setting.value;
      const isChecked = value === "true" || value === true;

      return (
        <div className="pl-4 border-l-2 border-muted space-y-2 mb-4 last:mb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor={setting.key}
                className={!isInAppEnabled ? "text-muted-foreground" : ""}
              >
                {info.label}
              </Label>
              {info.description && (
                <p className="text-sm text-muted-foreground">
                  {info.description}
                </p>
              )}
            </div>
            <Switch
              id={setting.key}
              checked={isChecked}
              onCheckedChange={(checked) =>
                handleInputChange(setting.key, checked)
              }
              disabled={!isInAppEnabled}
              className="cursor-pointer"
            />
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {/* Parent setting: IN_APP_ENABLED */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor={inAppEnabledSetting.key}>
              {inAppEnabledInfo.label}
            </Label>
            {inAppEnabledInfo.description && (
              <p className="text-sm text-muted-foreground">
                {inAppEnabledInfo.description}
              </p>
            )}
          </div>
          <Switch
            id={inAppEnabledSetting.key}
            checked={isInAppEnabled}
            onCheckedChange={(checked) =>
              handleInputChange(inAppEnabledSetting.key, checked)
            }
            className="cursor-pointer"
          />
        </div>

        {/* Child settings */}
        <div className={`ml-6 ${!isInAppEnabled ? "opacity-50" : ""}`}>
          {renderNotificationSwitch(notifyOnNewDeviceSetting)}
          {renderNotificationSwitch(notifyOnBlockSetting)}
          {renderNotificationSwitch(notifyOnLocationChangeSetting)}
          {renderNotificationSwitch(autoMarkReadSetting)}
        </div>
      </div>
    );
  };

  const renderUserPortalGroup = (settings: AppSetting[]) => {
    const portalEnabledSetting = settings.find(
      (s) => s.key === "USER_PORTAL_ENABLED"
    );
    const showRulesSetting = settings.find(
      (s) => s.key === "USER_PORTAL_SHOW_RULES"
    );
    const allowRejectedSetting = settings.find(
      (s) => s.key === "USER_PORTAL_ALLOW_REJECTED_REQUESTS"
    );

    if (!portalEnabledSetting && !showRulesSetting && !allowRejectedSetting)
      return null;

    const portalEnabledValue = portalEnabledSetting
      ? (formData[portalEnabledSetting.key] ?? portalEnabledSetting.value)
      : false;
    const isPortalEnabled =
      portalEnabledValue === "true" || portalEnabledValue === true;

    const renderSwitch = (setting: AppSetting, disabled: boolean = false) => {
      const info = getSettingInfo(setting);
      const value = formData[setting.key] ?? setting.value;
      const isChecked = value === "true" || value === true;

      return (
        <div className="space-y-2 mb-4 last:mb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor={setting.key}
                className={disabled ? "text-muted-foreground" : ""}
              >
                {info.label}
              </Label>
              {info.description && (
                <p className="text-sm text-muted-foreground">
                  {info.description}
                </p>
              )}
            </div>
            <Switch
              id={setting.key}
              checked={isChecked}
              onCheckedChange={(checked) =>
                handleInputChange(setting.key, checked)
              }
              disabled={disabled}
              className="cursor-pointer"
            />
          </div>
        </div>
      );
    };

    const portalEnabledInfo = portalEnabledSetting
      ? getSettingInfo(portalEnabledSetting)
      : null;

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">User Portal</h4>
          <p className="text-sm text-muted-foreground">
            Allow Plex users to log in and manage their devices
          </p>
        </div>

        {/* Parent setting: USER_PORTAL_ENABLED */}
        {portalEnabledSetting && portalEnabledInfo && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={portalEnabledSetting.key}>
                {portalEnabledInfo.label}
              </Label>
              {portalEnabledInfo.description && (
                <p className="text-sm text-muted-foreground">
                  {portalEnabledInfo.description}
                </p>
              )}
            </div>
            <Switch
              id={portalEnabledSetting.key}
              checked={isPortalEnabled}
              onCheckedChange={(checked) =>
                handleInputChange(portalEnabledSetting.key, checked)
              }
              className="cursor-pointer"
            />
          </div>
        )}

        {/* Child settings - indented */}
        <div
          className={`ml-6 space-y-4 transition-opacity duration-200 ${!isPortalEnabled ? "opacity-50" : ""}`}
        >
          {showRulesSetting && renderSwitch(showRulesSetting, !isPortalEnabled)}
          {allowRejectedSetting &&
            renderSwitch(allowRejectedSetting, !isPortalEnabled)}
        </div>
      </div>
    );
  };

  const renderSetting = (setting: AppSetting) => {
    const { label, description } = getSettingInfo(setting);
    const value = formData[setting.key] ?? setting.value;

    if (setting.type === "boolean") {
      return (
        <div key={setting.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={setting.key}>{label}</Label>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <Switch
              id={setting.key}
              checked={value === "true" || value === true}
              onCheckedChange={(checked) =>
                handleInputChange(setting.key, checked)
              }
              className="cursor-pointer"
            />
          </div>
        </div>
      );
    }

    // Special handling for timezone
    if (setting.key === "TIMEZONE") {
      return (
        <div key={setting.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={setting.key}>{label}</Label>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <Select
              value={typeof value === "string" ? value : String(value)}
              onValueChange={(newValue) =>
                handleInputChange(setting.key, newValue)
              }
            >
              <SelectTrigger className="w-[220px] cursor-pointer">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-12:00">
                  UTC-12:00 - {getCurrentTimeInOffset("-12:00")}
                </SelectItem>
                <SelectItem value="-11:00">
                  UTC-11:00 - {getCurrentTimeInOffset("-11:00")}
                </SelectItem>
                <SelectItem value="-10:00">
                  UTC-10:00 - {getCurrentTimeInOffset("-10:00")}
                </SelectItem>
                <SelectItem value="-09:00">
                  UTC-09:00 - {getCurrentTimeInOffset("-09:00")}
                </SelectItem>
                <SelectItem value="-08:00">
                  UTC-08:00 - {getCurrentTimeInOffset("-08:00")}
                </SelectItem>
                <SelectItem value="-07:00">
                  UTC-07:00 - {getCurrentTimeInOffset("-07:00")}
                </SelectItem>
                <SelectItem value="-06:00">
                  UTC-06:00 - {getCurrentTimeInOffset("-06:00")}
                </SelectItem>
                <SelectItem value="-05:00">
                  UTC-05:00 - {getCurrentTimeInOffset("-05:00")}
                </SelectItem>
                <SelectItem value="-04:00">
                  UTC-04:00 - {getCurrentTimeInOffset("-04:00")}
                </SelectItem>
                <SelectItem value="-03:00">
                  UTC-03:00 - {getCurrentTimeInOffset("-03:00")}
                </SelectItem>
                <SelectItem value="-02:00">
                  UTC-02:00 - {getCurrentTimeInOffset("-02:00")}
                </SelectItem>
                <SelectItem value="-01:00">
                  UTC-01:00 - {getCurrentTimeInOffset("-01:00")}
                </SelectItem>
                <SelectItem value="+00:00">
                  UTC+00:00 - {getCurrentTimeInOffset("+00:00")}
                </SelectItem>
                <SelectItem value="+01:00">
                  UTC+01:00 - {getCurrentTimeInOffset("+01:00")}
                </SelectItem>
                <SelectItem value="+02:00">
                  UTC+02:00 - {getCurrentTimeInOffset("+02:00")}
                </SelectItem>
                <SelectItem value="+03:00">
                  UTC+03:00 - {getCurrentTimeInOffset("+03:00")}
                </SelectItem>
                <SelectItem value="+04:00">
                  UTC+04:00 - {getCurrentTimeInOffset("+04:00")}
                </SelectItem>
                <SelectItem value="+05:00">
                  UTC+05:00 - {getCurrentTimeInOffset("+05:00")}
                </SelectItem>
                <SelectItem value="+06:00">
                  UTC+06:00 - {getCurrentTimeInOffset("+06:00")}
                </SelectItem>
                <SelectItem value="+07:00">
                  UTC+07:00 - {getCurrentTimeInOffset("+07:00")}
                </SelectItem>
                <SelectItem value="+08:00">
                  UTC+08:00 - {getCurrentTimeInOffset("+08:00")}
                </SelectItem>
                <SelectItem value="+09:00">
                  UTC+09:00 - {getCurrentTimeInOffset("+09:00")}
                </SelectItem>
                <SelectItem value="+10:00">
                  UTC+10:00 - {getCurrentTimeInOffset("+10:00")}
                </SelectItem>
                <SelectItem value="+11:00">
                  UTC+11:00 - {getCurrentTimeInOffset("+11:00")}
                </SelectItem>
                <SelectItem value="+12:00">
                  UTC+12:00 - {getCurrentTimeInOffset("+12:00")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // Special handling for select fields
    if (setting.key === "DEFAULT_PAGE") {
      const currentValue = typeof value === "string" ? value : String(value);

      return (
        <div key={setting.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={setting.key}>{label}</Label>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="flex rounded-lg border border-input bg-muted/30 p-1">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium cursor-pointer rounded-md transition-all duration-200 ${
                  currentValue === "devices"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
                onClick={() => handleInputChange(setting.key, "devices")}
              >
                Devices
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium cursor-pointer rounded-md transition-all duration-200 ${
                  currentValue === "streams"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
                onClick={() => handleInputChange(setting.key, "streams")}
              >
                Streams
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={setting.key} className="space-y-2">
        <Label htmlFor={setting.key}>{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <Input
          id={setting.key}
          type={setting.key.includes("INTERVAL") ? "number" : "text"}
          value={typeof value === "string" ? value : String(value)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleInputChange(setting.key, e.target.value)
          }
          placeholder={`Enter ${label.toLowerCase()}`}
          disabled={
            setting.key === "DEVICE_CLEANUP_INTERVAL_DAYS" &&
            (formData["DEVICE_CLEANUP_ENABLED"] === false ||
              formData["DEVICE_CLEANUP_ENABLED"] === "false")
          }
          className={`cursor-pointer ${
            setting.key === "DEVICE_CLEANUP_INTERVAL_DAYS" &&
            (formData["DEVICE_CLEANUP_ENABLED"] === false ||
              formData["DEVICE_CLEANUP_ENABLED"] === "false")
              ? "opacity-50"
              : ""
          }`}
        />
      </div>
    );
  };

  const sectionSettings = getSectionSettings(sectionId);
  const sectionInfo = getSectionInfo(sectionId);
  const IconComponent = sectionInfo.icon;

  if (sectionSettings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="mt-4">
        <CardTitle>{sectionInfo.title}</CardTitle>
        <CardDescription>{sectionInfo.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Handle notifications section with grouped rendering */}
        {sectionId === "notifications" ? (
          <Card className="p-4 my-4">
            {renderNotificationGroup(sectionSettings)}
          </Card>
        ) : (
          sectionSettings.map((setting) => {
            // Handle device cleanup group
            if (setting.key === "DEVICE_CLEANUP_ENABLED") {
              return (
                <Card key="device-cleanup-group" className="p-4 my-4">
                  {renderDeviceCleanupGroup(sectionSettings)}
                </Card>
              );
            }

            // Skip the interval setting since it's handled in the group
            if (setting.key === "DEVICE_CLEANUP_INTERVAL_DAYS") {
              return null;
            }

            // Handle concurrent stream limit group
            if (setting.key === "CONCURRENT_STREAM_LIMIT") {
              return (
                <Card key="concurrent-stream-group" className="p-4 my-4">
                  {renderConcurrentStreamGroup(sectionSettings)}
                </Card>
              );
            }

            // Skip the include temp access setting since it's handled in the group
            if (setting.key === "CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS") {
              return null;
            }

            // Handle User Portal group
            if (setting.key === "USER_PORTAL_ENABLED") {
              return (
                <Card key="user-portal-group" className="p-4 my-4">
                  {renderUserPortalGroup(sectionSettings)}
                </Card>
              );
            }

            // Skip child settings since they're handled in the group
            if (
              setting.key === "USER_PORTAL_SHOW_RULES" ||
              setting.key === "USER_PORTAL_ALLOW_REJECTED_REQUESTS"
            ) {
              return null;
            }

            // Render other settings normally
            return (
              <Card key={setting.key} className="p-4 my-4">
                {renderSetting(setting)}
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
