"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Banner, SettingControl, SettingsCard, isTruthy } from "./settings-ui";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { AppSetting } from "@/types";
import { SettingsFormData, ConnectionStatus } from "./settings-utils";

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

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setConnectionStatus(null);
    }
  }, [hasUnsavedChanges]);

  const plexSettings = settings
    .filter(
      (setting) =>
        (setting.key.startsWith("PLEX_") &&
          setting.key !== "PLEX_GUARD_DEFAULT_BLOCK") ||
        setting.key === "USE_SSL" ||
        setting.key === "IGNORE_CERT_ERRORS" ||
        setting.key === "CUSTOM_PLEX_URL",
    )
    .sort((a, b) => {
      const order = [
        "PLEX_TOKEN",
        "PLEX_SERVER_IP",
        "PLEX_SERVER_PORT",
        "USE_SSL",
        "IGNORE_CERT_ERRORS",
        "CUSTOM_PLEX_URL",
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

      const result = await apiClient.testPlexConnection<any>();

      if (result.success) {
        setConnectionStatus({ success: true, message: result.message });
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || "Connection failed",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to test connection";
      setConnectionStatus({ success: false, message: errorMessage });
    } finally {
      setTestingConnection(false);
    }
  };

  const useSslSetting = plexSettings.find((s) => s.key === "USE_SSL");
  const ignoreCertErrorsSetting = plexSettings.find(
    (s) => s.key === "IGNORE_CERT_ERRORS",
  );
  const isSslEnabled = isTruthy(formData["USE_SSL"]);

  return (
    <SettingsCard
      title="Plex Integration"
      description="Configure your Plex Media Server connection and related settings."
      footer={
        <div className="space-y-3">
          {hasUnsavedChanges && (
            <Banner tone="warning">
              Save your changes before testing the connection
            </Banner>
          )}

          {connectionStatus && !hasUnsavedChanges && (
            <Banner tone={connectionStatus.success ? "positive" : "danger"}>
              {connectionStatus.message}
            </Banner>
          )}

          <Button
            onClick={testPlexConnection}
            disabled={testingConnection || hasUnsavedChanges}
            className="w-full"
          >
            {testingConnection && <Loader2 className="size-4 animate-spin" />}
            {testingConnection
              ? "Testing Connection..."
              : "Test Plex Connection"}
          </Button>
        </div>
      }
    >
      {plexSettings
        .filter(
          (setting) =>
            setting.key !== "USE_SSL" && setting.key !== "IGNORE_CERT_ERRORS",
        )
        .map((setting) => (
          <SettingControl
            key={setting.key}
            setting={setting}
            formData={formData}
            onChange={handleInputChange}
          />
        ))}

      {useSslSetting && ignoreCertErrorsSetting && (
        <div className="space-y-3">
          <SettingControl
            setting={useSslSetting}
            formData={formData}
            onChange={handleInputChange}
          />
          <SettingControl
            setting={ignoreCertErrorsSetting}
            formData={formData}
            onChange={handleInputChange}
            disabled={!isSslEnabled}
            className="ml-6"
          />
        </div>
      )}
    </SettingsCard>
  );
}
