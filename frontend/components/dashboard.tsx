"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  Settings,
  Server,
  WifiOff,
  Video,
  Signal,
} from "lucide-react";
import { StreamsList } from "./streams-list";
import { DeviceApproval } from "./device-approval";

import { DashboardStats, UnifiedDashboardData, PlexStatus } from "@/types";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";

export function Dashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<UnifiedDashboardData | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activeStreams: 0,
    totalDevices: 0,
    pendingDevices: 0,
    approvedDevices: 0,
  });
  const [activeTab, setActiveTab] = useState<"streams" | "devices">("devices");
  const [loading, setLoading] = useState(true);
  const [plexStatus, setPlexStatus] = useState<PlexStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const handleShowSettings = () => {
    router.push('/settings');
  };

  const refreshDashboard = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      // Fetch all dashboard data
      const newDashboardData = await apiClient.getDashboardData<UnifiedDashboardData>();
      
      // Only update state if data actually changed
      const currentDataString = JSON.stringify(dashboardData);
      const newDataString = JSON.stringify(newDashboardData);
      
      if (currentDataString !== newDataString) {
        setDashboardData(newDashboardData);
        setPlexStatus(newDashboardData.plexStatus);
        setStats(newDashboardData.stats);
      }
      
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      setPlexStatus({
        configured: false,
        hasValidCredentials: false,
        connectionStatus: "Failed to fetch dashboard data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return; // Don't set up interval in manual mode
    
    const interval = setInterval(() => refreshDashboard(true), config.app.refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    // Loading dots animation
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
          <div
            className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          ></div>
        </div>
      </div>
    );
  }

  // Show configuration prompt if Plex is not properly connected
  if (!plexStatus?.configured || !plexStatus?.hasValidCredentials) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)]">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-2xl">
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-full">
                    <Server className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  Plex Configuration Required
                </CardTitle>
                <CardDescription className="text-lg">
                  Guardian needs to connect to your Plex Media Server to monitor
                  streams and manage devices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {plexStatus?.configured ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-primary">
                        Connection Status
                      </h3>
                      <p className="text-sm text-primary/80">
                        {plexStatus?.connectionStatus || "Not configured"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">
                    To get started, you'll need to configure:
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Plex Server IP Address
                      </span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Plex Server Port
                      </span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Plex Authentication Token
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleShowSettings}
                    className="w-full"
                    size="lg"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Plex Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">

        {/* Server Statistics */}
        <div className="mb-3 sm:mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
            Devices Overview
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Active Streams</span>
                  <span className="sm:hidden">Streams</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.activeStreams}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Approved Devices</span>
                  <span className="sm:hidden">Approved</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.approvedDevices}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Pending Approval</span>
                  <span className="sm:hidden">Pending</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.pendingDevices}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Total Devices</span>
                  <span className="sm:hidden">Total</span>
                </CardTitle>
                <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                  {stats.totalDevices}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 sm:mb-6">
          <div className="flex w-full sm:w-fit space-x-0 sm:space-x-1 bg-muted p-1 rounded-lg">
            <Button
              variant={activeTab === "devices" ? "default" : "ghost"}
              onClick={() => setActiveTab("devices")}
              className="flex-1 sm:flex-none px-3 sm:px-6 text-sm relative"
            >
              <Shield className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Device Management</span>
              <span className="sm:hidden">Devices</span>
              {stats.pendingDevices > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-2 min-w-5 h-5 text-xs bg-red-600 dark:bg-red-700 text-white"
                >
                  {stats.pendingDevices}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeTab === "streams" ? "default" : "ghost"}
              onClick={() => setActiveTab("streams")}
              className="flex-1 sm:flex-none px-3 sm:px-6 text-sm relative"
            >
              <Activity className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Active Streams</span>
              <span className="sm:hidden">Streams</span>
              {stats.activeStreams > 0 && (
                <Badge
                  variant="default"
                  className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-2 min-w-5 h-5 text-xs bg-blue-600 dark:bg-blue-700 text-white"
                >
                  {stats.activeStreams}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "streams" ? (
          <StreamsList 
            sessionsData={dashboardData?.sessions}
            onRefresh={() => refreshDashboard(true)}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
          />
        ) : (
          <DeviceApproval 
            devicesData={dashboardData?.devices}
            usersData={dashboardData?.users}
            onRefresh={() => refreshDashboard(true)}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
          />
        )}
      </div>
    </div>
  );
}
