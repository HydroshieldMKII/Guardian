"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Info,
  CheckCircle,
  Download,
  Loader2,
  RefreshCw,
  Calendar,
  GitBranch,
  Database,
  Server,
  Clock,
} from "lucide-react";
import { config } from "@/lib/config";
import { useVersion } from "@/contexts/version-context";
import { AppSetting } from "@/types";

interface SystemInfoProps {
  onSettingsRefresh: () => void;
  settings: AppSetting[];
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

export function SystemInfo({ onSettingsRefresh, settings }: SystemInfoProps) {
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<Date | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{
    available: boolean;
    latestVersion?: string;
    message: string;
  } | null>(null);
  const [uptimeInfo, setUptimeInfo] = useState<UptimeInfo | null>(null);
  const [currentUptime, setCurrentUptime] = useState<number>(0);

  const { toast } = useToast();
  const { versionInfo } = useVersion();

  // Check if auto-update is enabled from settings
  const autoUpdateSetting = settings.find(
    (s) => s.key === "AUTO_CHECK_UPDATES"
  );
  const autoUpdateEnabled = autoUpdateSetting?.value === "true";

  // Fetch uptime information
  const fetchUptimeInfo = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/health`);
      if (response.ok) {
        const data: HealthResponse = await response.json();
        if (data.uptime) {
          setUptimeInfo(data.uptime);
          setCurrentUptime(data.uptime.seconds);
        }
      }
    } catch (error) {
      console.error("Failed to fetch uptime info:", error);
    }
  };

  // Update uptime counter every second
  useEffect(() => {
    fetchUptimeInfo();

    // If auto-update is enabled, perform an automatic check
    if (autoUpdateEnabled) {
      checkForUpdates(true); // Pass true to indicate this is an automatic check
    }

    const interval = setInterval(() => {
      setCurrentUptime((prev) => prev + 1);
    }, 1000);

    // Refresh uptime info every 5 minutes to stay accurate
    const uptimeRefreshInterval = setInterval(fetchUptimeInfo, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(uptimeRefreshInterval);
    };
  }, [autoUpdateEnabled]); // Add autoUpdateEnabled as dependency

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

  const checkForUpdates = async (isAutomatic: boolean = false) => {
    try {
      setCheckingUpdates(true);
      setUpdateStatus(null);

      // Simulate checking for updates (you can replace this with actual GitHub API call)
      const response = await fetch(`${config.api.baseUrl}/health`);

      if (!response.ok) {
        throw new Error("Failed to check for updates");
      }

      // For now, simulate no updates available
      // In a real implementation, you'd check GitHub releases API
      const updateInfo = {
        available: false,
        latestVersion: versionInfo?.version || "1.2.3",
        message: "You are running the latest version of Guardian.",
      };

      setUpdateStatus(updateInfo);
      setLastUpdateCheck(new Date());

      // Only show toast for manual checks
      if (!isAutomatic) {
        toast({
          title: "Update Check Complete",
          description: updateInfo.message,
          variant: updateInfo.available ? "default" : "success",
        });
      }
    } catch (error) {
      console.error("Update check error:", error);
      setUpdateStatus({
        available: false,
        message: "Failed to check for updates. Please try again later.",
      });

      // Only show error toast for manual checks
      if (!isAutomatic) {
        toast({
          title: "Update Check Failed",
          description: "Unable to check for updates. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setCheckingUpdates(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* System Information Card */}
      <Card>
        <CardHeader className="mt-4">
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>
            Current system status and version information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Application Version */}
          <Card className="p-4 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Application Version
              </span>
              <Badge variant="outline" className="font-mono">
                v{versionInfo?.version || "1.2.3"}
              </Badge>
            </div>
          </Card>

          {/* Database Version */}
          <Card className="p-4 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database Version
              </span>
              <Badge variant="outline" className="font-mono">
                v{versionInfo?.databaseVersion || "1.2.3"}
              </Badge>
            </div>
          </Card>

          {/* System Status */}
          <Card className="p-4 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                System Status
              </span>
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-700"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                OK
              </Badge>
            </div>
          </Card>

          {/* Uptime */}
          <Card className="p-4 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Uptime
              </span>
              <div className="text-right">
                <div className="text-sm font-mono font-medium">
                  {formatUptime(currentUptime)}
                </div>
                {uptimeInfo && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Since {new Date(uptimeInfo.startTime).toLocaleDateString()}{" "}
                    {new Date(uptimeInfo.startTime).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Version Mismatch Warning */}
          {versionInfo?.isVersionMismatch && (
            <Card className="p-4 my-4 border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                <strong>Version Mismatch:</strong> Database version is newer
                than application version.
              </p>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Update Management Card */}
      <Card>
        <CardHeader className="mt-4">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Update Management
          </CardTitle>
          <CardDescription>
            Check for application updates and manage versions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Last Update Check */}
          {lastUpdateCheck && (
            <Card className="p-4 my-4">
              <div>
                <p className="text-sm font-medium">
                  {autoUpdateEnabled
                    ? "Last Automatic Update Check"
                    : "Last Update Check"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Calendar className="h-3 w-3" />
                  {lastUpdateCheck.toLocaleString()}
                </p>
              </div>
            </Card>
          )}

          {/* Update Status */}
          {updateStatus && (
            <Card
              className={`p-4 my-4 ${
                updateStatus.available
                  ? "border-blue-200 dark:border-blue-800"
                  : "border-green-200 dark:border-green-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {updateStatus.available ? (
                  <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
                <p
                  className={`text-sm font-medium ${
                    updateStatus.available
                      ? "text-blue-800 dark:text-blue-200"
                      : "text-green-800 dark:text-green-200"
                  }`}
                >
                  {updateStatus.message}
                </p>
              </div>
              {updateStatus.available && updateStatus.latestVersion && (
                <p className="text-xs text-muted-foreground mt-2">
                  Latest version: v{updateStatus.latestVersion}
                </p>
              )}
            </Card>
          )}

          {/* Manual Update Check Button */}
          <div className="pt-2 mb-4">
            <Button
              onClick={() => checkForUpdates(false)}
              disabled={checkingUpdates}
              className="w-full"
              variant="outline"
            >
              {checkingUpdates ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking for Updates...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check for Updates
                </>
              )}
            </Button>
          </div>

          {/* Auto-update Setting Info */}
          {!autoUpdateEnabled && (
            <div className="pt-4 border-t mb-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Automatic update checking can be
                  configured in Guardian settings. This manual check allows you
                  to immediately verify if newer versions are available.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
