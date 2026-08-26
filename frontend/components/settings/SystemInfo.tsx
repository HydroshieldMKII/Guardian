"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Meta, MetaGrid, StatusPill } from "@/components/ui/entity";
import { Banner, SettingControl, SettingsCard } from "./settings-ui";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useVersion } from "@/contexts/version-context";
import { AppSetting } from "@/types";
import { SettingsFormData } from "./settings-utils";

interface SystemInfoProps {
  settings: AppSetting[];
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
}

interface UptimeInfo {
  milliseconds: number;
  seconds: number;
  startTime: string;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
  uptime?: UptimeInfo;
}

export function SystemInfo({
  settings,
  formData,
  onFormDataChange,
}: SystemInfoProps) {
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    available: boolean;
    latestVersion?: string;
    currentVersion?: string;
    message: string;
    updateUrl?: string;
  } | null>(null);
  const [uptimeInfo, setUptimeInfo] = useState<UptimeInfo | null>(null);
  const [currentUptime, setCurrentUptime] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<string>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  const { toast } = useToast();
  const { versionInfo, checkForUpdatesManually } = useVersion();

  // Fetch uptime information
  const fetchUptimeInfo = async () => {
    try {
      const startTime = performance.now();
      const data = await apiClient.getHealth<HealthResponse>();
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      if (data.uptime) {
        setUptimeInfo(data.uptime);
        setCurrentUptime(data.uptime.seconds);
      }
      setHealthStatus(data.status);
    } catch (error) {
      console.error("Failed to fetch uptime info:", error);
      setHealthStatus("error");
      setLatency(null);
    }
  };

  // Update uptime counter every second
  useEffect(() => {
    fetchUptimeInfo();

    const interval = setInterval(() => {
      setCurrentUptime((prev) => prev + 1);
    }, 1000);

    // Refresh uptime info every 5 minutes to stay accurate
    const uptimeRefreshInterval = setInterval(fetchUptimeInfo, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(uptimeRefreshInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const checkForUpdates = async () => {
    try {
      setCheckingUpdates(true);
      setUpdateStatus(null);

      if (!versionInfo?.version) {
        throw new Error(
          "Current version information not available yet. Try again in a moment.",
        );
      }

      const result = await checkForUpdatesManually();

      if (result) {
        const updateInfo = {
          available: result.hasUpdate,
          latestVersion: result.latestVersion,
          currentVersion: result.currentVersion,
          message: result.hasUpdate
            ? `A new version (${result.latestVersion}) is available!`
            : "You are running the latest version of Guardian.",
          updateUrl: result.updateUrl,
        };

        setUpdateStatus(updateInfo);

        toast({
          title: "Update Check Complete",
          description: updateInfo.message,
          variant: updateInfo.available ? "default" : "success",
        });
      } else {
        throw new Error("Failed to check for updates");
      }
    } catch (error) {
      console.error("Update check error:", error);
      setUpdateStatus({
        available: false,
        message: "Failed to check for updates. Please try again later.",
      });

      toast({
        title: "Update Check Failed",
        description: "Unable to check for updates. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setCheckingUpdates(false);
    }
  };
  const healthy = healthStatus === "ok" || healthStatus === "healthy";
  const autoCheckSetting = settings.find(
    (setting) => setting?.key === "AUTO_CHECK_UPDATES",
  );

  return (
    <div className="space-y-6">
      <SettingsCard
        title="System Information"
        description="Current system status and version information."
      >
        <MetaGrid className="sm:grid-cols-2">
          <Meta label="Application Version">
            <span className="font-mono">v{versionInfo?.version || "N/A"}</span>
          </Meta>
          <Meta label="Database Version">
            <span className="font-mono">
              v{versionInfo?.databaseVersion || "N/A"}
            </span>
          </Meta>
          <Meta label="System Status">
            <span className="flex items-center gap-2">
              <StatusPill
                tone={
                  healthStatus === "checking"
                    ? "info"
                    : healthy
                      ? "positive"
                      : "danger"
                }
                dot
              >
                {healthy
                  ? "OK"
                  : healthStatus === "checking"
                    ? "Checking..."
                    : "Error"}
              </StatusPill>
              {latency !== null && healthy && (
                <span className="text-xs text-muted-foreground">
                  {latency}ms
                </span>
              )}
            </span>
          </Meta>
          <Meta label="Uptime">
            <span className="font-mono">{formatUptime(currentUptime)}</span>
            {uptimeInfo && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (since {new Date(uptimeInfo.startTime).toLocaleDateString()}{" "}
                {new Date(uptimeInfo.startTime).toLocaleTimeString()})
              </span>
            )}
          </Meta>
        </MetaGrid>

        {versionInfo?.isVersionMismatch && (
          <Banner tone="warning">
            <strong className="font-semibold">Version Mismatch:</strong>{" "}
            Database version is newer than application version.
          </Banner>
        )}
      </SettingsCard>

      <SettingsCard
        title="Update Management"
        description="Check for application updates."
        footer={
          <Button
            onClick={() => checkForUpdates()}
            disabled={checkingUpdates || !versionInfo?.version}
            className="w-full"
            variant="outline"
          >
            {checkingUpdates && <Loader2 className="size-4 animate-spin" />}
            {checkingUpdates ? "Checking for Updates..." : "Check for Updates"}
          </Button>
        }
      >
        {autoCheckSetting && (
          <SettingControl
            setting={autoCheckSetting}
            formData={formData}
            onChange={(key, value) => onFormDataChange({ [key]: value })}
          />
        )}

        {updateStatus ? (
          <Banner tone={updateStatus.available ? "info" : "positive"}>
            {updateStatus.message}
            {updateStatus.available && updateStatus.latestVersion && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Latest version: v{updateStatus.latestVersion}
              </span>
            )}
          </Banner>
        ) : (
          <p className="text-sm text-muted-foreground">
            Run a check to see whether a newer Guardian release is available.
          </p>
        )}
      </SettingsCard>
    </div>
  );
}
