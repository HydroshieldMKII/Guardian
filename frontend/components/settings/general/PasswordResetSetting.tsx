import type { ReactNode } from "react";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { usePasswordResetStatus } from "@/hooks/usePasswordResetStatus";
import type { AppSetting } from "@/types";
import { Banner, SettingControl, isTruthy } from "../settings-ui";
import type { SettingsFormData } from "../settings-utils";
import type { SettingFieldProps } from "./types";

const EMAIL_KEYS = ["SMTP_ENABLED", "SMTP_HOST", "SMTP_FROM_EMAIL"];

const isEmailConfigured = (
  settings: AppSetting[],
  formData: SettingsFormData,
) =>
  EMAIL_KEYS.map(
    (key) =>
      formData[key] ?? settings.find((setting) => setting?.key === key)?.value,
  ).every((value, index) =>
    index === 0 ? isTruthy(value) : Boolean(value && String(value).trim()),
  );

export function PasswordResetSetting({
  setting,
  settings,
  formData,
  onChange,
}: SettingFieldProps & { settings: AppSetting[] }) {
  const { user } = useAuth();
  const { appUrlConfigured, anyAdminEmail } = usePasswordResetStatus();
  const unmet: { key: string; label: ReactNode }[] = [];

  if (!isEmailConfigured(settings, formData)) {
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
    <div className="space-y-3">
      <SettingControl
        setting={setting}
        formData={formData}
        onChange={onChange}
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
