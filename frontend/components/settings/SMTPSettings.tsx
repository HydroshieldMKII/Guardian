"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Loader2,
  MailQuestionMark,
  MailCheck,
  AlertTriangle,
  Mail,
  SendHorizontal,
} from "lucide-react";
import { config } from "@/lib/config";
import { AppSetting } from "@/types";
import {
  getSettingInfo,
  SettingsFormData,
  ConnectionStatus,
} from "./settings-utils";

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
  const { toast } = useToast();

  const smtpSettings = settings
    .filter((setting) => setting.key.startsWith("SMTP_"))
    .sort((a, b) => {
      const order = [
        "SMTP_ENABLED",
        "SMTP_NOTIFY_ON_NOTIFICATIONS",
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

      const response = await fetch(
        `${config.api.baseUrl}/config/test-smtp-connection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setConnectionStatus({ success: true, message: result.message });
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "SMTP test failed",
        });
      }
    } catch (error) {
      const errorMessage = "Failed to test SMTP connection";
      setConnectionStatus({ success: false, message: errorMessage });
    } finally {
      setTestingConnection(false);
    }
  };

  const renderEmailNotificationGroup = () => {
    const smtpEnabledSetting = smtpSettings.find(
      (s) => s.key === "SMTP_ENABLED",
    );
    const notifyOnNotificationsSetting = smtpSettings.find(
      (s) => s.key === "SMTP_NOTIFY_ON_NOTIFICATIONS",
    );

    if (!smtpEnabledSetting || !notifyOnNotificationsSetting) return null;

    const isSmtpEnabled =
      formData["SMTP_ENABLED"] === true || formData["SMTP_ENABLED"] === "true";

    return (
      <Card className="p-4 my-4">
        <div className="space-y-4">
          {/* Parent setting: SMTP_ENABLED */}
          {renderSetting(smtpEnabledSetting)}

          {/* Child setting: SMTP_NOTIFY_ON_NOTIFICATIONS - indented and disabled when parent is off */}
          <div className={`ml-6 ${!isSmtpEnabled ? "opacity-50" : ""}`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={notifyOnNotificationsSetting.key}
                    className={!isSmtpEnabled ? "text-muted-foreground" : ""}
                  >
                    {getSettingInfo(notifyOnNotificationsSetting).label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {getSettingInfo(notifyOnNotificationsSetting).description}
                  </p>
                </div>
                <Switch
                  id={notifyOnNotificationsSetting.key}
                  checked={
                    (formData[notifyOnNotificationsSetting.key] ??
                      notifyOnNotificationsSetting.value) === "true" ||
                    (formData[notifyOnNotificationsSetting.key] ??
                      notifyOnNotificationsSetting.value) === true
                  }
                  onCheckedChange={(checked) =>
                    handleInputChange(notifyOnNotificationsSetting.key, checked)
                  }
                  disabled={!isSmtpEnabled}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
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

    return (
      <div key={setting.key} className="space-y-2">
        <Label htmlFor={setting.key}>{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <Input
          id={setting.key}
          type={
            setting.key.includes("PASSWORD")
              ? "password"
              : setting.key === "SMTP_PORT"
                ? "number"
                : "text"
          }
          value={typeof value === "string" ? value : String(value)}
          onChange={(e) => handleInputChange(setting.key, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="cursor-pointer"
        />
      </div>
    );
  };

  const isSmtpEnabled = (() => {
    const formValue = formData["SMTP_ENABLED"];
    if (formValue !== undefined) {
      return formValue === true || formValue === "true";
    }

    const smtpSetting = settings.find((s) => s.key === "SMTP_ENABLED");
    return smtpSetting?.value === "true";
  })();

  return (
    <Card>
      <CardHeader className="mt-4">
        <CardTitle className="flex items-center gap-2">
          <MailQuestionMark className="h-5 w-5" />
          Email Notifications (SMTP)
        </CardTitle>
        <CardDescription>
          Configure email notifications for Guardian events and alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email notification group - parent and child relationship */}
        {renderEmailNotificationGroup()}

        {/* Other SMTP settings */}
        {smtpSettings
          .filter(
            (setting) =>
              setting.key !== "SMTP_ENABLED" &&
              setting.key !== "SMTP_NOTIFY_ON_NOTIFICATIONS",
          )
          .map((setting) => (
            <Card key={setting.key} className="p-4 my-4">
              {renderSetting(setting)}
            </Card>
          ))}

        {isSmtpEnabled && (
          <div className="pb-4">
            <Button
              onClick={testSMTPConnection}
              disabled={testingConnection || hasUnsavedChanges}
              className="w-full"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending test email...
                </>
              ) : (
                <>
                  <SendHorizontal className="mr-2 h-4 w-4" />
                  Send test email
                </>
              )}
            </Button>

            {hasUnsavedChanges && (
              <div className="mt-3 p-3 rounded-md flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Save your changes before testing SMTP connection
                </span>
              </div>
            )}

            {connectionStatus && !hasUnsavedChanges && (
              <div
                className={`mt-3 p-3 rounded-md flex items-center gap-2 ${
                  connectionStatus.success
                    ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
                    : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800"
                }`}
              >
                {connectionStatus.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{connectionStatus.message}</span>
              </div>
            )}
          </div>
        )}

        {!isSmtpEnabled && (
          <div className="pb-4">
            <Button
              onClick={testSMTPConnection}
              disabled={true}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Test SMTP Connection
            </Button>

            {hasUnsavedChanges ? (
              <div className="mt-3 p-3 rounded-md flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Save your changes before testing SMTP connection
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Enable emails to test the connection.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
