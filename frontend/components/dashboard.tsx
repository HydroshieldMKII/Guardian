"use client";

import { useState, useEffect } from "react";
import {
  Card,
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
} from "lucide-react";
import { StreamsList } from "./streams-list";
import { DeviceApproval } from "./device-approval";

import { DashboardStats } from "@/types";
import { apiClient } from "@/lib/api";
import { config } from "@/lib/config";

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeStreams: 0,
    totalDevices: 0,
    pendingDevices: 0,
    approvedDevices: 0,
  });
  const [activeTab, setActiveTab] = useState<"streams" | "devices">("streams");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [streamsData, allDevicesData, pendingData, approvedData] =
          await Promise.all([
            apiClient.get("/sessions/active"),
            apiClient.get("/devices"),
            apiClient.get("/devices/pending"),
            apiClient.get("/devices/approved"),
          ]);

        setStats({
          activeStreams: (streamsData as any)?.MediaContainer?.size || 0,
          totalDevices: (allDevicesData as any[]).length,
          pendingDevices: (pendingData as any[]).length,
          approvedDevices: (approvedData as any[]).length,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, config.app.refreshInterval);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Plex Guard Dashboard
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Monitor active streams and manage device access
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center">
                <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Active Streams</span>
                <span className="sm:hidden">Streams</span>
              </CardTitle>
              <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.activeStreams}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Approved Devices</span>
                <span className="sm:hidden">Approved</span>
              </CardTitle>
              <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.approvedDevices}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center">
                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Pending Approval</span>
                <span className="sm:hidden">Pending</span>
              </CardTitle>
              <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.pendingDevices}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center">
                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Total Devices</span>
                <span className="sm:hidden">Total</span>
              </CardTitle>
              <CardDescription className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.totalDevices}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 sm:mb-6">
          <div className="flex w-full sm:w-fit space-x-0 sm:space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
            <Button
              variant={activeTab === "streams" ? "default" : "ghost"}
              onClick={() => setActiveTab("streams")}
              className="flex-1 sm:flex-none px-3 sm:px-6 text-sm"
            >
              <Activity className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Active Streams</span>
              <span className="sm:hidden">Streams</span>
            </Button>
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
                  className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-2 min-w-5 h-5 text-xs"
                >
                  {stats.pendingDevices}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "streams" ? <StreamsList /> : <DeviceApproval />}
      </div>
    </div>
  );
}
