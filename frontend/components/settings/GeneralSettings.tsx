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

  // Parse offset string (e.g., "+05:30" or "-08:00")
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
          "DEVICE_CLEANUP_ENABLED", // Device cleanup feature
          "DEVICE_CLEANUP_INTERVAL_DAYS", // Device cleanup interval (follows the feature toggle)
          "TIMEZONE", // Display/locale setting
        ],
        customization: [
          "ENABLE_MEDIA_THUMBNAILS", // UI settings first
          "ENABLE_MEDIA_ARTWORK", // UI settings
          "MSG_DEVICE_PENDING", // Message settings grouped
          "MSG_DEVICE_REJECTED",
          "MSG_TIME_RESTRICTED",
          "MSG_IP_LAN_ONLY",
          "MSG_IP_WAN_ONLY",
          "MSG_IP_NOT_ALLOWED",
        ],
        notifications: ["AUTO_MARK_NOTIFICATION_READ"],
      };

      const order = orderMaps[section as keyof typeof orderMaps];
      const index = order?.indexOf(settingKey);
      return index !== undefined && index >= 0 ? index : 999;
    };

    let filteredSettings;
    switch (section) {
      case "guardian":
        filteredSettings = settings.filter((setting) =>
          [
            "PLEX_GUARD_DEFAULT_BLOCK",
            "PLEXGUARD_REFRESH_INTERVAL",
            "AUTO_CHECK_UPDATES",
            "DEVICE_CLEANUP_ENABLED",
            "DEVICE_CLEANUP_INTERVAL_DAYS",
            "TIMEZONE",
          ].includes(setting.key)
        );
        break;
      case "customization":
        filteredSettings = settings.filter(
          (setting) =>
            ["ENABLE_MEDIA_THUMBNAILS", "ENABLE_MEDIA_ARTWORK"].includes(
              setting.key
            ) || setting.key.startsWith("MSG_")
        );
        break;
      case "notifications":
        filteredSettings = settings.filter((setting) =>
          ["AUTO_MARK_NOTIFICATION_READ"].includes(setting.key)
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
          <Label htmlFor={setting.key}>{label}</Label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <Select
            value={typeof value === "string" ? value : String(value)}
            onValueChange={(newValue) =>
              handleInputChange(setting.key, newValue)
            }
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="+00:00">
                UTC+00:00 (GMT) - {getCurrentTimeInOffset("+00:00")}
              </SelectItem>
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
      );
    }

    // Special handling for select fields
    if (setting.key === "DEFAULT_PAGE") {
      return (
        <div key={setting.key} className="space-y-2">
          <Label htmlFor={setting.key}>{label}</Label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <select
            id={setting.key}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            value={typeof value === "string" ? value : String(value)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              handleInputChange(setting.key, e.target.value)
            }
          >
            <option value="">Select default page</option>
            <option value="devices">Devices</option>
            <option value="streams">Streams</option>
          </select>
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
        <CardTitle className="flex items-center gap-2">
          <IconComponent className="h-5 w-5" />
          {sectionInfo.title}
        </CardTitle>
        <CardDescription>{sectionInfo.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectionSettings.map((setting, index) => {
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

          // Render other settings normally
          return (
            <Card key={setting.key} className="p-4 my-4">
              {renderSetting(setting)}
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
