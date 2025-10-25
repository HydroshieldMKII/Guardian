"use client";

import { useEffect, useState } from "react";
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

    useEffect(() => {
      if (!hasUnsavedChanges) {
        setConnectionStatus(null);
      }
    }, [hasUnsavedChanges]);
    
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
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "Apprise test failed",
        });
      }
    } catch (error) {
      const errorMessage = "Failed to test Apprise connection";
      setConnectionStatus({ success: false, message: errorMessage });
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
          <Card className="p-4 my-4">
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
                    <div className="text-sm text-muted-foreground">
                      {settingInfo.description}
                    </div>
                    <Textarea
                      id={setting.key}
                      placeholder="discord://webhook_id/webhook_token
telegram://bot_token/chat_id
slack://token_a/token_b/token_c"
                      value={currentValue as string}
                      onChange={(e) => handleInputChange(setting.key, e.target.value)}
                      disabled={!isAppriseEnabled}
                      className="min-h-[120px] font-mono text-sm mb-2"
                    />
                  </div>
                );
              }

              return null;
            })}
            </div>
          </Card>

          {/* Test Connection */}
          {isAppriseEnabled && (
            <div className="pt-4 border-t">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Test Apprise Connection</h4>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to verify your configuration
                  </p>
                </div>

                {/* Banners above button */}
                {hasUnsavedChanges && (
                  <div className="p-3 rounded-md flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Save your changes before testing apprise connection.
                    </span>
                  </div>
                )}

                {connectionStatus && !hasUnsavedChanges && (
                  <div className={`p-3 rounded-md flex items-center gap-2 ${
                    connectionStatus.success
                      ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
                      : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800"
                  }`}>
                    {getStatusIcon()}
                    <span className="text-sm">
                      {connectionStatus.message}
                    </span>
                  </div>
                )}

                <Button
                  onClick={testAppriseConnection}
                  disabled={testingConnection || hasUnsavedChanges}
                  className="w-full mb-4"
                  variant="outline"
                >
                  {testingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <SendHorizontal className="h-4 w-4 mr-2" />
                  )}
                  {testingConnection ? "Testing..." : "Send a test notification"}
                </Button>
              </div>
            </div>
          )}

          {/* Test Connection - Disabled State */}
          {!isAppriseEnabled && (
            <div className="pt-4 border-t">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Test Apprise Connection</h4>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to verify your configuration
                  </p>
                </div>

                {/* Banners above button */}
                {hasUnsavedChanges && (
                  <div className="p-3 rounded-md flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Save your changes before testing apprise connection.
                    </span>
                  </div>
                )}

                {!hasUnsavedChanges && (
                  <div className="p-3 rounded-md flex items-center gap-2 bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-950/20 dark:text-gray-300 dark:border-gray-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Enable Apprise to test the connection.
                    </span>
                  </div>
                )}

                <Button
                  onClick={testAppriseConnection}
                  disabled={true}
                  className="w-full"
                  variant="outline"
                >
                  <SendHorizontal className="h-4 w-4 mr-2" />
                  Send Test
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}