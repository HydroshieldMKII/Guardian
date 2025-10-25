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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Bell,
  SendHorizontal,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";
import { config } from "@/lib/config";
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
  const { toast } = useToast();

  const appriseSettings = settings
    .filter((setting) => setting && setting.key && setting.key.startsWith("APPRISE_"))
    .sort((a, b) => {
      const order = [
        "APPRISE_ENABLED",
        "APPRISE_NOTIFY_ON_NEW_DEVICES",
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

      const response = await fetch(
        `${config.api.baseUrl}/config/test-apprise-connection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setConnectionStatus({ success: true, message: result.message });
        toast({
          title: "Test Successful",
          description: result.message,
          variant: "success",
        });
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "Apprise test failed",
        });
        toast({
          title: "Test Failed",
          description: result.message || "Apprise test failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = "Failed to test Apprise connection";
      setConnectionStatus({ success: false, message: errorMessage });
      toast({
        title: "Test Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getStatusIcon = () => {
    if (testingConnection) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (connectionStatus?.success === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (connectionStatus?.success === false) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const isAppriseEnabled = formData["APPRISE_ENABLED"] === "true";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mt-4">
            <Bell className="h-5 w-5" />
            <CardTitle>Apprise Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure Apprise for sending notifications to various services like Discord, Slack, Telegram, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Apprise Documentation Link */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                  About Apprise
                </h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                  Apprise allows you to send notifications to 80+ services including Discord, Slack, Telegram, email, and more.
                  Each service URL follows a specific format.{" "}
                  <button
                    type="button"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer"
                    onClick={() => window.open("https://github.com/caronc/apprise/wiki", "_blank")}
                  >
                    View Apprise Documentation
                    <ExternalLink className="h-3 w-3" />
                  </button>{" "}
                  to get your service URLs.
                </p>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="space-y-4">
            {appriseSettings.map((setting) => {
              const settingInfo = getSettingInfo(setting);
              const currentValue = formData[setting.key] ?? setting.value;

              if (setting.key === "APPRISE_ENABLED") {
                return (
                  <div key={setting.key} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">
                        {settingInfo.label}
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        {settingInfo.description}
                      </div>
                    </div>
                    <Switch
                      checked={currentValue === "true"}
                      onCheckedChange={(checked) =>
                        handleInputChange(setting.key, checked.toString())
                      }
                    />
                  </div>
                );
              }

              if (setting.key === "APPRISE_NOTIFY_ON_NEW_DEVICES") {
                return (
                  <div key={setting.key} className="flex items-center justify-between ml-6 pl-4 border-l-2 border-muted">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">
                        {settingInfo.label}
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        {settingInfo.description}
                      </div>
                    </div>
                    <Switch
                      checked={currentValue === "true"}
                      onCheckedChange={(checked) =>
                        handleInputChange(setting.key, checked.toString())
                      }
                      disabled={!isAppriseEnabled}
                    />
                  </div>
                );
              }

              if (setting.key === "APPRISE_URLS") {
                return (
                  <div key={setting.key} className="space-y-3">
                    <Label htmlFor={setting.key} className="text-base font-medium">
                      {settingInfo.label}
                    </Label>
                    <Textarea
                      id={setting.key}
                      placeholder="discord://webhook_id/webhook_token
telegram://bot_token/chat_id
slack://token_a/token_b/token_c"
                      value={currentValue as string}
                      onChange={(e) => handleInputChange(setting.key, e.target.value)}
                      disabled={!isAppriseEnabled}
                      className="min-h-[120px] font-mono text-sm mt-2"
                    />
                    <div className="text-sm text-muted-foreground">
                      {settingInfo.description}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Test Connection */}
          {isAppriseEnabled && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Test Apprise Connection</h4>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to verify your configuration
                  </p>
                </div>
                <Button
                  onClick={testAppriseConnection}
                  disabled={testingConnection || hasUnsavedChanges}
                  size="sm"
                  variant="outline"
                >
                  {testingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <SendHorizontal className="h-4 w-4 mr-2" />
                  )}
                  {testingConnection ? "Testing..." : "Send Test"}
                </Button>
              </div>

              {hasUnsavedChanges && (
                <div className="mt-3 text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Save your changes before testing the connection
                </div>
              )}

              {connectionStatus && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {getStatusIcon()}
                  <span
                    className={
                      connectionStatus.success
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {connectionStatus.message}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}