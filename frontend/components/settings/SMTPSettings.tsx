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

  const isSmtpEnabled =
    formData["SMTP_ENABLED"] === true || formData["SMTP_ENABLED"] === "true";

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
        {smtpSettings.map((setting) => (
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

            {connectionStatus && (
              <div
                className={`mt-3 p-3 rounded-md flex items-center gap-2 ${
                  connectionStatus.success
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
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
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              Enable email notifications above to configure SMTP settings and
              test the connection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
