"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SecretInput } from "@/components/settings/SecretInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, SegmentedControl } from "@/components/ui/entity";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { Banner, SettingControl, SettingsCard, isTruthy } from "./settings-ui";
import { AppSetting } from "@/types";
import { getSettingInfo, SettingsFormData } from "./settings-utils";

const UTC_OFFSETS = Array.from({ length: 25 }, (_, index) => {
  const hours = index - 12;
  const sign = hours < 0 ? "-" : "+";
  return `${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
});

const getCurrentTimeInOffset = (offsetString: string): string => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;

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

interface SettingGroup {
  title: string;
  description: string;
  keys: string[];
  extra?: (key: string) => boolean;
}

interface ChildGroup {
  parent: string;
  children: string[];
  isDisabled: (parentValue: string | boolean | number) => boolean;
}

const CHILD_GROUPS: ChildGroup[] = [
  {
    parent: "CONCURRENT_STREAM_LIMIT",
    children: ["CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS"],
    isDisabled: (value) => Number(value) === 0,
  },
  {
    parent: "DEVICE_CLEANUP_ENABLED",
    children: ["DEVICE_CLEANUP_INTERVAL_DAYS"],
    isDisabled: (value) => !isTruthy(value),
  },
  {
    parent: "USER_PORTAL_ENABLED",
    children: ["USER_PORTAL_SHOW_RULES", "USER_PORTAL_ALLOW_REJECTED_REQUESTS"],
    isDisabled: (value) => !isTruthy(value),
  },
  {
    parent: "IN_APP_ENABLED",
    children: [
      "IN_APP_NOTIFY_ON_NEW_DEVICE",
      "IN_APP_NOTIFY_ON_BLOCK",
      "IN_APP_NOTIFY_ON_LOCATION_CHANGE",
      "IN_APP_NOTIFY_ON_DEVICE_NOTE",
      "AUTO_MARK_NOTIFICATION_READ",
    ],
    isDisabled: (value) => !isTruthy(value),
  },
];

const SECTIONS: Record<string, SettingGroup[]> = {
  guardian: [
    {
      title: "Access Control",
      description: "How devices are treated and how many streams they get.",
      keys: [
        "PLEX_GUARD_DEFAULT_BLOCK",
        "PLEX_GUARD_STRICT_MODE",
        "CONCURRENT_STREAM_LIMIT",
      ],
    },
    {
      title: "Monitoring & Maintenance",
      description:
        "How often Plex is polled, which clock is used, and when stale devices are dropped.",
      keys: [
        "PLEXGUARD_REFRESH_INTERVAL",
        "TIMEZONE",
        "DEVICE_CLEANUP_ENABLED",
      ],
    },
    {
      title: "User Portal",
      description: "What Plex users can see and do when they sign in.",
      keys: ["USER_PORTAL_ENABLED"],
    },
    {
      title: "Login Security",
      description:
        "Password recovery and optional captcha protection for the login page.",
      keys: [
        "PASSWORD_RESET_ENABLED",
        "CLOUDFLARE_TURNSTILE_SITE_KEY",
        "CLOUDFLARE_TURNSTILE_SECRET_KEY",
      ],
    },
  ],
  customization: [
    {
      title: "Interface",
      description: "What you see when you open the app.",
      keys: ["DEFAULT_PAGE", "ENABLE_MEDIA_THUMBNAILS", "ENABLE_MEDIA_ARTWORK"],
    },
    {
      title: "User-Facing Messages",
      description: "What Plex users are told when a stream is stopped.",
      keys: [
        "MSG_DEVICE_PENDING",
        "MSG_DEVICE_REJECTED",
        "MSG_TIME_RESTRICTED",
        "MSG_CONCURRENT_LIMIT",
        "MSG_IP_LAN_ONLY",
        "MSG_IP_WAN_ONLY",
        "MSG_IP_NOT_ALLOWED",
      ],
      extra: (key) => key.startsWith("MSG_"),
    },
  ],
  notifications: [
    {
      title: "In-App Notifications",
      description: "Which events raise a notification in the app.",
      keys: ["IN_APP_ENABLED"],
    },
  ],
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
  const { user } = useAuth();
  const [appUrlConfigured, setAppUrlConfigured] = useState(true);
  const [anyAdminEmail, setAnyAdminEmail] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/pg/auth/password-reset/status");
        if (response.ok) {
          const data = await response.json();
          setAppUrlConfigured(Boolean(data.appUrlConfigured));
          setAnyAdminEmail(Boolean(data.adminEmailConfigured));
        }
      } catch (error) {
        console.error("Failed to check password reset status:", error);
      }
    };

    void check();
  }, []);

  const handleInputChange = (key: string, value: string | boolean) => {
    onFormDataChange({ [key]: value });
  };

  const valueOf = (setting: AppSetting) =>
    formData[setting.key] ?? setting.value;

  const asString = (value: string | boolean | number) =>
    typeof value === "string" ? value : String(value);

  const findSetting = (key: string) =>
    settings.find((setting) => setting?.key === key);

  const groupSettings = (group: SettingGroup) => {
    const ordered = group.keys
      .map(findSetting)
      .filter((setting): setting is AppSetting => Boolean(setting));

    const extras = group.extra
      ? settings.filter(
          (setting) =>
            setting?.key &&
            group.extra?.(setting.key) &&
            !group.keys.includes(setting.key),
        )
      : [];

    return [...ordered, ...extras];
  };

  const renderChildGroup = (parent: AppSetting, group: ChildGroup) => {
    const children = group.children
      .map(findSetting)
      .filter((setting): setting is AppSetting => Boolean(setting));
    const disabled = group.isDisabled(valueOf(parent));

    return (
      <div className="space-y-3" key={parent.key}>
        {renderSetting(parent)}
        {children.length > 0 && (
          <div
            className={`space-y-3 border-l-2 pl-4 transition-opacity duration-200 sm:ml-2 ${
              disabled ? "opacity-50" : ""
            }`}
          >
            {children.map((child) => renderSetting(child, disabled))}
          </div>
        )}
      </div>
    );
  };

  const emailConfigured = ["SMTP_ENABLED", "SMTP_HOST", "SMTP_FROM_EMAIL"]
    .map((key) => {
      const stored = settings.find((setting) => setting?.key === key);
      return formData[key] ?? stored?.value;
    })
    .every((value, index) =>
      index === 0 ? isTruthy(value) : Boolean(value && String(value).trim()),
    );

  const renderSetting = (setting: AppSetting, disabled = false) => {
    const { label, description } = getSettingInfo(setting);
    const value = valueOf(setting);

    if (setting.key === "PASSWORD_RESET_ENABLED") {
      const unmet: { key: string; label: React.ReactNode }[] = [];

      if (!emailConfigured) {
        unmet.push({
          key: "smtp",
          label: (
            <>
              Configure and enable a mail server under{" "}
              <a href="#smtp" className="font-medium underline">
                Email settings
              </a>
            </>
          ),
        });
      }

      if (!appUrlConfigured) {
        unmet.push({
          key: "app-url",
          label: "Set the APP_URL environment variable",
        });
      }

      const ownEmail = isAdminUser(user) && Boolean(user.email);

      if (!anyAdminEmail && !ownEmail) {
        unmet.push({
          key: "admin-email",
          label: "Add an email address to your admin account",
        });
      }

      const blocked = unmet.length > 0;

      return (
        <div className="space-y-3" key={setting.key}>
          <SettingControl
            setting={setting}
            formData={formData}
            onChange={handleInputChange}
            disabled={blocked}
            className={blocked ? "opacity-50" : undefined}
          />
          {blocked && (
            <Banner tone="warning">
              <p>Reset links need the following first:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {unmet.map((requirement) => (
                  <li key={requirement.key}>{requirement.label}</li>
                ))}
              </ul>
            </Banner>
          )}
        </div>
      );
    }

    if (setting.key === "TIMEZONE") {
      return (
        <Field
          key={setting.key}
          label={label}
          htmlFor={setting.key}
          hint={description}
        >
          <Select
            value={asString(value)}
            onValueChange={(newValue) =>
              handleInputChange(setting.key, newValue)
            }
          >
            <SelectTrigger id={setting.key} className="w-full cursor-pointer">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {UTC_OFFSETS.map((offset) => (
                <SelectItem key={offset} value={offset}>
                  UTC{offset} - {getCurrentTimeInOffset(offset)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    }

    if (setting.key === "DEFAULT_PAGE") {
      return (
        <Field
          key={setting.key}
          label={label}
          hint={description}
          action={
            <SegmentedControl
              value={asString(value)}
              onChange={(next) => handleInputChange(setting.key, next)}
              options={[
                { value: "devices", label: "Devices" },
                { value: "streams", label: "Streams" },
              ]}
            />
          }
        />
      );
    }

    if (
      setting.key === "CLOUDFLARE_TURNSTILE_SITE_KEY" ||
      setting.key === "CLOUDFLARE_TURNSTILE_SECRET_KEY"
    ) {
      return (
        <Field
          key={setting.key}
          label={label}
          htmlFor={setting.key}
          hint={
            setting.key === "CLOUDFLARE_TURNSTILE_SITE_KEY" ? (
              <>
                {description} Get your Turnstile keys from{" "}
                <a
                  href="https://dash.cloudflare.com/sign-up?to=/:account/turnstile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Cloudflare Turnstile
                </a>
                .
              </>
            ) : (
              description
            )
          }
        >
          <SecretInput
            setting={setting}
            value={asString(value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            type={
              setting.key === "CLOUDFLARE_TURNSTILE_SECRET_KEY"
                ? "password"
                : "text"
            }
            onChange={(next) => handleInputChange(setting.key, next)}
          />
        </Field>
      );
    }

    if (setting.type !== "boolean") {
      return (
        <Field
          key={setting.key}
          label={label}
          htmlFor={setting.key}
          hint={description}
        >
          <Input
            id={setting.key}
            type={
              setting.key.includes("INTERVAL") ||
              setting.key === "CONCURRENT_STREAM_LIMIT"
                ? "number"
                : "text"
            }
            min={setting.key === "CONCURRENT_STREAM_LIMIT" ? "0" : undefined}
            value={asString(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleInputChange(setting.key, e.target.value)
            }
            placeholder={
              setting.key === "CONCURRENT_STREAM_LIMIT"
                ? "0 = unlimited"
                : `Enter ${label.toLowerCase()}`
            }
            disabled={disabled}
          />
        </Field>
      );
    }

    return (
      <SettingControl
        key={setting.key}
        setting={setting}
        formData={formData}
        onChange={handleInputChange}
        disabled={disabled}
      />
    );
  };

  const cards = (SECTIONS[sectionId] ?? [])
    .map((group) => ({ group, entries: groupSettings(group) }))
    .filter(({ entries }) => entries.length > 0);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {cards.map(({ group, entries }) => (
        <SettingsCard
          key={group.title}
          title={group.title}
          description={group.description}
        >
          {entries.map((setting) => {
            const childGroup = CHILD_GROUPS.find(
              (candidate) => candidate.parent === setting.key,
            );

            return childGroup
              ? renderChildGroup(setting, childGroup)
              : renderSetting(setting);
          })}
        </SettingsCard>
      ))}
    </div>
  );
}
