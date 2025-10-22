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
}

export function SMTPSettings({
  settings,
  formData,
  onFormDataChange,
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
        "SMTP_NOTIFY_ON_NOTIFICATIONS", // Email notifications toggle first after enable
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USE_TLS", // Move TLS setting right after port for better UX
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
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setConnectionStatus({ success: true, message: result.message });
        toast({
          title: "SMTP test successful",
          description: result.message,
          variant: "success",
        });
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "SMTP test failed",
        });
        toast({
          title: "SMTP test failed",
          description: result.message || "Unable to connect to SMTP server",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = "Failed to test SMTP connection";
      setConnectionStatus({ success: false, message: errorMessage });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const renderEmailNotificationGroup = () => {
    const smtpEnabledSetting = smtpSettings.find(
      (s) => s.key === "SMTP_ENABLED"
    );
    const notifyOnNotificationsSetting = smtpSettings.find(
      (s) => s.key === "SMTP_NOTIFY_ON_NOTIFICATIONS"
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
        />
      </div>
    );
  };

  const isSmtpEnabled = (() => {
    const smtpSetting = settings.find((s) => s.key === "SMTP_ENABLED");
    return smtpSetting?.value === true || smtpSetting?.value === "true";
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
              setting.key !== "SMTP_NOTIFY_ON_NOTIFICATIONS"
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
              disabled={testingConnection}
              className="w-full"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing SMTP...
                </>
              ) : (
                <>
                  <MailCheck className="mr-2 h-4 w-4" />
                  Test SMTP Connection
                </>
              )}
            </Button>
          </div>
        )}

        {!isSmtpEnabled && (
          <div className="pb-4">
            <Button
              onClick={testSMTPConnection}
              disabled={true}
              className="w-full"
            >
              <MailCheck className="mr-2 h-4 w-4" />
              Test SMTP Connection
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Enable emails to test the connection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
