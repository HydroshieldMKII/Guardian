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
  Server,
  AlertTriangle,
} from "lucide-react";
import { config } from "@/lib/config";
import { AppSetting } from "@/types";
import {
  getSettingInfo,
  SettingsFormData,
  ConnectionStatus,
} from "./settings-utils";

interface PlexSettingsProps {
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  hasUnsavedChanges?: boolean;
}

export function PlexSettings({
  settings,
  formData,
  onFormDataChange,
  hasUnsavedChanges = false,
}: PlexSettingsProps) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const { toast } = useToast();

  const plexSettings = settings
    .filter(
      (setting) =>
        (setting.key.startsWith("PLEX_") &&
          setting.key !== "PLEX_GUARD_DEFAULT_BLOCK") ||
        setting.key === "USE_SSL" ||
        setting.key === "IGNORE_CERT_ERRORS" ||
        setting.key === "CUSTOM_PLEX_URL"
    )
    .sort((a, b) => {
      // Define the desired order for Plex settings
      const order = [
        "CUSTOM_PLEX_URL", // Custom URL at the top
        "PLEX_SERVER_IP",
        "PLEX_SERVER_PORT",
        "PLEX_TOKEN",
        "USE_SSL", // SSL settings grouped together
        "IGNORE_CERT_ERRORS", // SSL settings grouped together
      ];

      const indexA = order.indexOf(a.key);
      const indexB = order.indexOf(b.key);

      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  const handleInputChange = (key: string, value: string | boolean) => {
    onFormDataChange({ [key]: value });
  };

  const testPlexConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionStatus(null);

      const response = await fetch(
        `${config.api.baseUrl}/config/test-plex-connection`,
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
          message: result.message || "Connection failed",
        });
      }
    } catch (error) {
      const errorMessage = "Failed to test connection";
      setConnectionStatus({ success: false, message: errorMessage });
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
            setting.key.includes("PASSWORD") || setting.key.includes("TOKEN")
              ? "password"
              : "text"
          }
          value={typeof value === "string" ? value : String(value)}
          onChange={(e) => handleInputChange(setting.key, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="mt-4">
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Plex Integration
        </CardTitle>
        <CardDescription>
          Configure your Plex Media Server connection and related settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plexSettings.map((setting) => (
          <Card key={setting.key} className="p-4 my-4">
            {renderSetting(setting)}
          </Card>
        ))}

        <div className="pb-4">
          <Button
            onClick={testPlexConnection}
            disabled={testingConnection || hasUnsavedChanges}
            className="w-full"
          >
            {testingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Server className="mr-2 h-4 w-4" />
                Test Plex Connection
              </>
            )}
          </Button>

          {hasUnsavedChanges && (
            <div className="mt-3 p-3 rounded-md flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Save your changes before testing the connection
              </span>
            </div>
          )}

          {connectionStatus && !hasUnsavedChanges && (
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
      </CardContent>
    </Card>
  );
}
