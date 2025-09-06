"use client";

import { useState, useEffect, memo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Monitor,
  MapPin,
  Clock,
  User,
  Smartphone,
  Tv,
  Laptop,
  RefreshCw,
  Eye,
  Settings,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { config } from "@/lib/config";

interface UserDevice {
  id: number;
  userId: string;
  username: string | null;
  deviceIdentifier: string;
  deviceName: string | null;
  devicePlatform: string | null;
  deviceProduct: string | null;
  deviceVersion: string | null;
  status: "pending" | "approved" | "rejected";
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  ipAddress: string | null;
  userAgent: string | null;
}

interface UserPreference {
  id: number;
  userId: string;
  username: string | null;
  defaultBlock: boolean | null;
  createdAt: string;
  updatedAt: string;
}

const UserPreferenceCard = memo(
  ({ user, onUpdate }: { user: UserPreference; onUpdate: () => void }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdatePreference = async (defaultBlock: boolean | null) => {
      try {
        setIsUpdating(true);
        const response = await fetch(
          `${config.api.baseUrl}/users/${encodeURIComponent(user.userId)}/preference`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ defaultBlock }),
          },
        );

        if (response.ok) {
          onUpdate();
        } else {
          console.error("Failed to update user preference");
        }
      } catch (error) {
        console.error("Error updating user preference:", error);
      } finally {
        setIsUpdating(false);
      }
    };

    const getPreferenceText = (defaultBlock: boolean | null) => {
      if (defaultBlock === null) return "Global Default";
      return defaultBlock ? "Block by Default" : "Allow by Default";
    };

    const getPreferenceBadge = (defaultBlock: boolean | null) => {
      if (defaultBlock === null) {
        return (
          <Badge variant="secondary">
            <Settings className="w-3 h-3 mr-1" />
            Global Default
          </Badge>
        );
      }
      if (defaultBlock) {
        return (
          <Badge variant="destructive" className="bg-red-500">
            <XCircle className="w-3 h-3 mr-1" />
            Block by Default
          </Badge>
        );
      }
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Allow by Default
        </Badge>
      );
    };

    return (
      <div className="p-3 sm:p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-4 h-4" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user.username || user.userId}
              </h3>
              {getPreferenceBadge(user.defaultBlock)}
            </div>
            {/* <div className="text-sm text-slate-600 dark:text-slate-400">
            User ID: {user.userId}
          </div> */}
          </div>

          <div className="flex flex-row gap-2">
            <Button
              variant={user.defaultBlock === null ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdatePreference(null)}
              disabled={isUpdating}
              className="text-xs px-2 flex-1 sm:flex-none"
            >
              <Settings className="w-3 h-3 mr-1" />
              Global
            </Button>
            <Button
              variant={user.defaultBlock === false ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdatePreference(false)}
              disabled={isUpdating}
              className="text-xs px-2 flex-1 sm:flex-none"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Allow
            </Button>
            <Button
              variant={user.defaultBlock === true ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdatePreference(true)}
              disabled={isUpdating}
              className="text-xs px-2 flex-1 sm:flex-none"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Block
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

UserPreferenceCard.displayName = "UserPreferenceCard";

const DeviceApproval = memo(() => {
  const [allDevices, setAllDevices] = useState<UserDevice[]>([]);
  const [pendingDevices, setPendingDevices] = useState<UserDevice[]>([]);
  const [processedDevices, setProcessedDevices] = useState<UserDevice[]>([]);
  const [users, setUsers] = useState<UserPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "processed" | "users">(
    "pending",
  );

  // Confirmation dialog states
  const [confirmAction, setConfirmAction] = useState<{
    device: UserDevice;
    action: "approve" | "reject" | "delete" | "toggle";
    title: string;
    description: string;
  } | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all devices
      const allResponse = await fetch(`${config.api.baseUrl}/devices`);
      const allData: UserDevice[] = await allResponse.json();

      // Fetch pending devices (truly new devices)
      const pendingResponse = await fetch(
        `${config.api.baseUrl}/devices/pending`,
      );
      const pendingData: UserDevice[] = await pendingResponse.json();

      // Fetch processed devices (approved or rejected)
      const processedResponse = await fetch(
        `${config.api.baseUrl}/devices/processed`,
      );
      const processedData: UserDevice[] = await processedResponse.json();

      // Only update state if data has changed to prevent unnecessary re-renders
      const allDataString = JSON.stringify(allData);
      const pendingDataString = JSON.stringify(pendingData);
      const processedDataString = JSON.stringify(processedData);

      if (JSON.stringify(allDevices) !== allDataString) {
        setAllDevices(allData);
      }
      if (JSON.stringify(pendingDevices) !== pendingDataString) {
        setPendingDevices(pendingData);
      }
      if (JSON.stringify(processedDevices) !== processedDataString) {
        setProcessedDevices(processedData);
      }
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    } finally {
      setLoading(false);
    }
  }, [allDevices, pendingDevices, processedDevices]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/users`);
      const usersData: UserPreference[] = await response.json();
      setUsers(usersData || []); // Ensure we always have an array
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]); // Set to empty array on error
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    if (activeTab === "users") {
      fetchUsers();
    }
    const interval = setInterval(() => {
      fetchDevices();
      if (activeTab === "users") {
        fetchUsers();
      }
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleApprove = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/approve`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        // Optimistic update - update the device status immediately
        const updateDeviceStatus = (devices: UserDevice[]) =>
          devices.map((device) =>
            device.id === deviceId
              ? { ...device, status: "approved" as const }
              : device,
          );

        setAllDevices(updateDeviceStatus);
        setProcessedDevices((prev) => updateDeviceStatus(prev));
        setPendingDevices((devices) =>
          devices.filter((device) => device.id !== deviceId),
        );

        // Still fetch to ensure consistency
        setTimeout(fetchDevices, 100);
      } else {
        console.error("Failed to approve device");
      }
    } catch (error) {
      console.error("Error approving device:", error);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleReject = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/reject`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        // Optimistic update
        const updateDeviceStatus = (devices: UserDevice[]) =>
          devices.map((device) =>
            device.id === deviceId
              ? { ...device, status: "rejected" as const }
              : device,
          );

        setAllDevices((prev) => updateDeviceStatus(prev));
        setProcessedDevices((prev) => updateDeviceStatus(prev));
        setPendingDevices((devices) =>
          devices.filter((device) => device.id !== deviceId),
        );

        setTimeout(fetchDevices, 100);
      } else {
        console.error("Failed to reject device");
      }
    } catch (error) {
      console.error("Error rejecting device:", error);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleDelete = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/delete`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        // Optimistic update - remove device immediately
        const removeDevice = (devices: UserDevice[]) =>
          devices.filter((device) => device.id !== deviceId);

        setAllDevices((prev) => removeDevice(prev));
        setProcessedDevices((prev) => removeDevice(prev));
        setPendingDevices((prev) => removeDevice(prev));

        setTimeout(fetchDevices, 100);
      } else {
        console.error("Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleToggleApproval = async (device: UserDevice) => {
    if (device.status === "approved") {
      await handleReject(device.id);
    } else {
      await handleApprove(device.id);
    }
  };

  // Confirmation dialog handlers
  const showApproveConfirmation = (device: UserDevice) => {
    setConfirmAction({
      device,
      action: "approve",
      title: "Approve Device",
      description: `Are you sure you want to approve this device? "${device.deviceName || device.deviceIdentifier}" will be able to access your Plex server.`,
    });
  };

  const showRejectConfirmation = (device: UserDevice) => {
    setConfirmAction({
      device,
      action: "reject",
      title: "Reject Device",
      description: `Are you sure you want to reject this device? "${device.deviceName || device.deviceIdentifier}" will be blocked from accessing your Plex server.`,
    });
  };

  const showDeleteConfirmation = (device: UserDevice) => {
    setConfirmAction({
      device,
      action: "delete",
      title: "Delete Device",
      description: `Are you sure you want to permanently delete this device record? This action cannot be undone. The device "${device.deviceName || device.deviceIdentifier}" will need to be re-approved if it tries to connect again.`,
    });
  };

  const showToggleConfirmation = (device: UserDevice) => {
    const isCurrentlyApproved = device.status === "approved";
    setConfirmAction({
      device,
      action: "toggle",
      title: isCurrentlyApproved ? "Reject Device" : "Approve Device",
      description: isCurrentlyApproved
        ? `Are you sure you want to reject "${device.deviceName || device.deviceIdentifier}"? This will block access to your Plex server.`
        : `Are you sure you want to approve "${device.deviceName || device.deviceIdentifier}"? This will grant access to your Plex server.`,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    switch (confirmAction.action) {
      case "approve":
        await handleApprove(confirmAction.device.id);
        break;
      case "reject":
        await handleReject(confirmAction.device.id);
        break;
      case "delete":
        await handleDelete(confirmAction.device.id);
        break;
      case "toggle":
        await handleToggleApproval(confirmAction.device);
        break;
    }
  };

  const getDeviceIcon = (platform: string | null, product: string | null) => {
    const p = platform?.toLowerCase() || product?.toLowerCase() || "";

    if (
      p.includes("android") ||
      p.includes("iphone") ||
      p.includes("ios") ||
      p.includes("mobile")
    ) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (
      p.includes("tv") ||
      p.includes("roku") ||
      p.includes("apple tv") ||
      p.includes("chromecast")
    ) {
      return <Tv className="w-4 h-4" />;
    }
    if (p.includes("windows") || p.includes("mac") || p.includes("linux")) {
      return <Laptop className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const getDeviceStatus = (device: UserDevice) => {
    switch (device.status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="bg-orange-500">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const devicesToShow =
    activeTab === "processed"
      ? processedDevices
      : activeTab === "pending"
        ? pendingDevices
        : [];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Device Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Device Management
              </CardTitle>
              <CardDescription className="mt-1">
                Manage device access to your Plex server
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
              <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                <Button
                  variant={activeTab === "pending" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("pending")}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  <span>Pending</span>
                </Button>
                <Button
                  variant={activeTab === "processed" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("processed")}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  <span>Processed</span>
                </Button>
                <Button
                  variant={activeTab === "users" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("users")}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  <span>Users</span>
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={activeTab === "users" ? fetchUsers : fetchDevices}
                className="text-xs sm:text-sm"
              >
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "users" ? (
            // Users management section
            <div>
              {users.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
                  <User className="w-6 h-6 mr-2" />
                  No users found
                </div>
              ) : (
                <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
                  <div className="space-y-4 pr-4">
                    {users.map((user) => (
                      <UserPreferenceCard
                        key={user.userId}
                        user={user}
                        onUpdate={fetchUsers}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : devicesToShow.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
              <CheckCircle className="w-6 h-6 mr-2" />
              {activeTab === "processed"
                ? "No processed devices found"
                : "No pending devices"}
            </div>
          ) : (
            <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
              <div className="space-y-4 pr-4">
                {devicesToShow.map((device) => (
                  <div
                    key={device.id}
                    className="p-3 sm:p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          {getDeviceIcon(
                            device.devicePlatform,
                            device.deviceProduct,
                          )}
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {device.deviceName || device.deviceIdentifier}
                          </h3>
                          {getDeviceStatus(device)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center min-w-0">
                            <User className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">
                              {device.username || device.userId}
                            </span>
                          </div>
                          <div className="flex items-center min-w-0">
                            <Monitor className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">
                              {device.devicePlatform || "Unknown Platform"}
                            </span>
                          </div>
                          <div className="flex items-center min-w-0">
                            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">
                              {device.ipAddress || "Unknown IP"}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Sessions: {device.sessionCount}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDevice(device)}
                          className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          <span>Details</span>
                        </Button>

                        {activeTab === "pending" ? (
                          /* Pending devices: Show Approve, Reject, Delete buttons */
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => showApproveConfirmation(device)}
                              disabled={actionLoading === device.id}
                              className="bg-green-500 hover:bg-green-600 text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none"
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              <span>Approve</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => showRejectConfirmation(device)}
                              disabled={actionLoading === device.id}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50 text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none"
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3 mr-1" />
                              )}
                              <span>Reject</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => showDeleteConfirmation(device)}
                              disabled={actionLoading === device.id}
                              className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none"
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 mr-1" />
                              )}
                              <span>Delete</span>
                            </Button>
                          </>
                        ) : (
                          /* Processed devices: Show Toggle Approval and Delete buttons */
                          <>
                            <Button
                              variant={
                                device.status === "approved"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => showToggleConfirmation(device)}
                              disabled={actionLoading === device.id}
                              className={`text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none ${
                                device.status === "approved"
                                  ? "bg-green-500 hover:bg-green-600"
                                  : "border-orange-500 text-orange-600 hover:bg-orange-50"
                              }`}
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : device.status === "approved" ? (
                                <ToggleRight className="w-3 h-3 mr-1" />
                              ) : (
                                <ToggleLeft className="w-3 h-3 mr-1" />
                              )}
                              <span>
                                {device.status === "approved"
                                  ? "Approved"
                                  : "Rejected"}
                              </span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => showDeleteConfirmation(device)}
                              disabled={actionLoading === device.id}
                              className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none"
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 mr-1" />
                              )}
                              <span>Delete</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        First seen:{" "}
                        {new Date(device.firstSeen).toLocaleString()}
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        Last seen: {new Date(device.lastSeen).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Device Details Dialog */}
      <Dialog
        open={!!selectedDevice}
        onOpenChange={() => setSelectedDevice(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Device Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this device
            </DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Device Name
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.deviceName || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    User
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.username || selectedDevice.userId}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Platform
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.devicePlatform || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Product
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.deviceProduct || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Version
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.deviceVersion || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    IP Address
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.ipAddress || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Sessions
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.sessionCount}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Status
                  </h4>
                  <div>{getDeviceStatus(selectedDevice)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Device Identifier
                </h4>
                <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  {selectedDevice.deviceIdentifier}
                </p>
              </div>

              {selectedDevice.userAgent && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400 mb-2">
                    User Agent
                  </h4>
                  <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    {selectedDevice.userAgent}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    First Seen
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {new Date(selectedDevice.firstSeen).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Last Seen
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {new Date(selectedDevice.lastSeen).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDevice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Action Confirmation Dialog */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction?.action === "approve" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {confirmAction?.action === "reject" && (
                <XCircle className="w-5 h-5 text-orange-500" />
              )}
              {confirmAction?.action === "delete" && (
                <Trash2 className="w-5 h-5 text-red-500" />
              )}
              {confirmAction?.action === "toggle" &&
                (confirmAction.device.status === "approved" ? (
                  <XCircle className="w-5 h-5 text-orange-500" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ))}
              {confirmAction?.title}
            </DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>

          {confirmAction && (
            <div className="my-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                {getDeviceIcon(
                  confirmAction.device.devicePlatform,
                  confirmAction.device.deviceProduct,
                )}
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {confirmAction.device.deviceName ||
                      confirmAction.device.deviceIdentifier}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {confirmAction.device.username ||
                      confirmAction.device.userId}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Platform: {confirmAction.device.devicePlatform || "Unknown"} •
                Product: {confirmAction.device.deviceProduct || "Unknown"}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={actionLoading !== null}
            >
              Cancel
            </Button>
            <Button
              variant={
                confirmAction?.action === "delete"
                  ? "destructive"
                  : confirmAction?.action === "reject" ||
                      (confirmAction?.action === "toggle" &&
                        confirmAction.device.status === "approved")
                    ? "outline"
                    : "default"
              }
              onClick={handleConfirmAction}
              disabled={actionLoading !== null}
              className={
                confirmAction?.action === "approve" ||
                (confirmAction?.action === "toggle" &&
                  confirmAction.device.status !== "approved")
                  ? "bg-green-500 hover:bg-green-600"
                  : confirmAction?.action === "reject" ||
                      (confirmAction?.action === "toggle" &&
                        confirmAction.device.status === "approved")
                    ? "border-orange-500 text-orange-600 hover:bg-orange-50"
                    : ""
              }
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {confirmAction?.action === "approve" && (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {confirmAction?.action === "reject" && (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {confirmAction?.action === "delete" && (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  {confirmAction?.action === "toggle" &&
                    (confirmAction.device.status === "approved" ? (
                      <XCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ))}
                  {confirmAction?.action === "approve" && "Approve Device"}
                  {confirmAction?.action === "reject" && "Reject Device"}
                  {confirmAction?.action === "delete" && "Delete Device"}
                  {confirmAction?.action === "toggle" &&
                    (confirmAction.device.status === "approved"
                      ? "Reject Device"
                      : "Approve Device")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export { DeviceApproval };
