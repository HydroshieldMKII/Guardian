"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Banner, SettingControl, SettingsCard, isTruthy } from "./settings-ui";
import { apiClient } from "@/lib/api";
import { AppSetting } from "@/types";
import { SettingsFormData, ConnectionStatus } from "./settings-utils";

interface SMTPSettingsProps {
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  hasUnsavedChanges?: boolean;
}

export function SMTPSettings({
  settings,
  formData,
  onFormDataChange,
  hasUnsavedChanges = false,
}: SMTPSettingsProps) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setConnectionStatus(null);
    }
  }, [hasUnsavedChanges]);

  const smtpSettings = settings
    .filter((setting) => setting.key.startsWith("SMTP_"))
    .sort((a, b) => {
      const order = [
        "SMTP_ENABLED",
        "SMTP_NOTIFY_ON_NEW_DEVICE",
        "SMTP_NOTIFY_ON_BLOCK",
        "SMTP_NOTIFY_ON_LOCATION_CHANGE",
        "SMTP_NOTIFY_ON_DEVICE_NOTE",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USE_TLS",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "SMTP_FROM_EMAIL",
        "SMTP_FROM_NAME",
        "SMTP_TO_EMAILS",
      ];

      const indexA = order.indexOf(a.key);
      const indexB = order.indexOf(b.key);

      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  const handleInputChange = (key: string, value: string | boolean) => {
    onFormDataChange({ [key]: value });
  };

  const testSMTPConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionStatus(null);

      const result = await apiClient.testSmtpConnection<any>();

      if (result.success) {
        setConnectionStatus({ success: true, message: result.message });
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "SMTP test failed",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to test SMTP connection";
      setConnectionStatus({ success: false, message: errorMessage });
    } finally {
      setTestingConnection(false);
    }
  };

  const NOTIFY_KEYS = [
    "SMTP_NOTIFY_ON_NEW_DEVICE",
    "SMTP_NOTIFY_ON_BLOCK",
    "SMTP_NOTIFY_ON_LOCATION_CHANGE",
    "SMTP_NOTIFY_ON_DEVICE_NOTE",
  ];

  const smtpEnabledSetting = smtpSettings.find((s) => s.key === "SMTP_ENABLED");
  const notifySettings = NOTIFY_KEYS.map((key) =>
    smtpSettings.find((s) => s.key === key),
  ).filter((setting): setting is AppSetting => Boolean(setting));
  const isSmtpEnabled = isTruthy(
    formData["SMTP_ENABLED"] ?? smtpEnabledSetting?.value,
  );

  return (
    <SettingsCard
      title="Email Notifications (SMTP)"
      description="Configure email notifications for Guardian events and alerts."
      footer={
        <div className="space-y-3">
          {hasUnsavedChanges && (
            <Banner tone="warning">
              Save your changes before testing SMTP connection
            </Banner>
          )}

          {isSmtpEnabled && connectionStatus && !hasUnsavedChanges && (
            <Banner tone={connectionStatus.success ? "positive" : "danger"}>
              {connectionStatus.message}
            </Banner>
          )}

          <Button
            onClick={testSMTPConnection}
            disabled={!isSmtpEnabled || testingConnection || hasUnsavedChanges}
            className="w-full"
          >
            {testingConnection && <Loader2 className="size-4 animate-spin" />}
            {testingConnection
              ? "Sending test email..."
              : isSmtpEnabled
                ? "Send test email"
                : "Test SMTP Connection"}
          </Button>

          {!isSmtpEnabled && !hasUnsavedChanges && (
            <p className="text-center text-xs text-muted-foreground">
              Enable emails to test the connection.
            </p>
          )}
        </div>
      }
    >
      {smtpEnabledSetting && (
        <div className="space-y-3">
          <SettingControl
            setting={smtpEnabledSetting}
            formData={formData}
            onChange={handleInputChange}
          />
          {notifySettings.length > 0 && (
            <div
              className={`space-y-3 border-l-2 pl-4 transition-opacity duration-200 sm:ml-2 ${
                isSmtpEnabled ? "" : "opacity-50"
              }`}
            >
              {notifySettings.map((setting) => (
                <SettingControl
                  key={setting.key}
                  setting={setting}
                  formData={formData}
                  onChange={handleInputChange}
                  disabled={!isSmtpEnabled}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {smtpSettings
        .filter(
          (setting) =>
            setting.key !== "SMTP_ENABLED" &&
            !NOTIFY_KEYS.includes(setting.key),
        )
        .map((setting) => (
          <SettingControl
            key={setting.key}
            setting={setting}
            formData={formData}
            onChange={handleInputChange}
          />
        ))}
    </SettingsCard>
  );
}
