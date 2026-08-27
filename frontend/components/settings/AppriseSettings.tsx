"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/entity";
import { Banner, SettingControl, SettingsCard, isTruthy } from "./settings-ui";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { AppSetting } from "@/types";
import {
  getSettingInfo,
  SettingsFormData,
  ConnectionStatus,
} from "./settings-utils";

interface AppriseSettingsProps {
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  hasUnsavedChanges?: boolean;
}

export function AppriseSettings({
  settings,
  formData,
  onFormDataChange,
  hasUnsavedChanges = false,
}: AppriseSettingsProps) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setConnectionStatus(null);
    }
  }, [hasUnsavedChanges]);

  const appriseSettings = settings
    .filter(
      (setting) => setting && setting.key && setting.key.startsWith("APPRISE_"),
    )
    .sort((a, b) => {
      const order = [
        "APPRISE_ENABLED",
        "APPRISE_NOTIFY_ON_NEW_DEVICE",
        "APPRISE_NOTIFY_ON_BLOCK",
        "APPRISE_NOTIFY_ON_LOCATION_CHANGE",
        "APPRISE_NOTIFY_ON_DEVICE_NOTE",
        "APPRISE_URLS",
      ];

      const indexA = order.indexOf(a.key);
      const indexB = order.indexOf(b.key);

      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  const handleInputChange = (key: string, value: string | boolean) => {
    onFormDataChange({ [key]: value });
  };

  const testAppriseConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionStatus(null);

      const result = await apiClient.testAppriseConnection<any>();

      if (result.success) {
        setConnectionStatus({ success: true, message: result.message });
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "Apprise test failed",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to test Apprise connection";
      setConnectionStatus({ success: false, message: errorMessage });
    } finally {
      setTestingConnection(false);
    }
  };

  const CHILD_KEYS = [
    "APPRISE_NOTIFY_ON_NEW_DEVICE",
    "APPRISE_NOTIFY_ON_BLOCK",
    "APPRISE_NOTIFY_ON_LOCATION_CHANGE",
    "APPRISE_NOTIFY_ON_DEVICE_NOTE",
  ];

  const isAppriseEnabled = isTruthy(formData["APPRISE_ENABLED"]);

  const enabledSetting = appriseSettings.find(
    (s) => s.key === "APPRISE_ENABLED",
  );
  const childSettings = CHILD_KEYS.map((key) =>
    appriseSettings.find((s) => s.key === key),
  ).filter((setting): setting is AppSetting => Boolean(setting));
  const urlsSetting = appriseSettings.find((s) => s.key === "APPRISE_URLS");

  const toggle = (key: string, checked: string | boolean) =>
    handleInputChange(key, String(checked));

  return (
    <SettingsCard
      title="Apprise Notifications"
      description="Send Guardian notifications on to Discord, Slack, Telegram, Pushover and many others."
      footer={
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Test Apprise Connection
            </p>
            <p className="text-xs text-muted-foreground">
              Send a test notification to every service URL above
            </p>
          </div>

          {hasUnsavedChanges && (
            <Banner tone="warning">
              Save your changes before testing the connection.
            </Banner>
          )}

          {isAppriseEnabled && connectionStatus && !hasUnsavedChanges && (
            <Banner tone={connectionStatus.success ? "positive" : "danger"}>
              {connectionStatus.message}
            </Banner>
          )}

          <Button
            onClick={testAppriseConnection}
            disabled={
              !isAppriseEnabled || testingConnection || hasUnsavedChanges
            }
            variant="outline"
            className="w-full"
          >
            {testingConnection && <Loader2 className="size-4 animate-spin" />}
            {testingConnection ? "Testing..." : "Send Test Notification"}
          </Button>

          {!isAppriseEnabled && !hasUnsavedChanges && (
            <p className="text-center text-xs text-muted-foreground">
              Turn Apprise on to test the connection.
            </p>
          )}
        </div>
      }
    >
      <Banner tone="info">
        Apprise forwards notifications to over a hundred services. Each one has
        its own URL format.{" "}
        <a
          href="https://github.com/caronc/apprise/wiki"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          See the Apprise documentation
        </a>{" "}
        for the URL your service expects.
      </Banner>

      {enabledSetting && (
        <div className="space-y-3">
          <SettingControl
            setting={enabledSetting}
            formData={formData}
            onChange={toggle}
          />
          {childSettings.length > 0 && (
            <div
              className={`space-y-3 border-l-2 pl-4 transition-opacity duration-200 sm:ml-2 ${
                isAppriseEnabled ? "" : "opacity-50"
              }`}
            >
              {childSettings.map((setting) => (
                <SettingControl
                  key={setting.key}
                  setting={setting}
                  formData={formData}
                  onChange={toggle}
                  disabled={!isAppriseEnabled}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {urlsSetting && (
        <Field
          label={getSettingInfo(urlsSetting).label}
          htmlFor={urlsSetting.key}
          hint={getSettingInfo(urlsSetting).description}
        >
          <Textarea
            id={urlsSetting.key}
            placeholder={
              "discord://webhook_id/webhook_token\ntelegram://bot_token/chat_id\nslack://token_a/token_b/token_c"
            }
            value={String(formData[urlsSetting.key] ?? urlsSetting.value)}
            onChange={(e) => handleInputChange(urlsSetting.key, e.target.value)}
            disabled={!isAppriseEnabled}
            className="min-h-[120px] font-mono text-sm"
          />
        </Field>
      )}
    </SettingsCard>
  );
}
