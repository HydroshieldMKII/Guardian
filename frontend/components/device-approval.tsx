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
  Wifi,
  Search,
  ExternalLink,
} from "lucide-react";
import { UserDevice, UserPreference } from "@/types";
import { config } from "@/lib/config";

// Clickable IP component
const ClickableIP = ({ ipAddress }: { ipAddress: string | null | undefined }) => {
  if (!ipAddress || ipAddress === "Unknown IP" || ipAddress === "Unknown") {
    return <span className="truncate">{ipAddress || "Unknown IP"}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    window.open(
      `https://ipinfo.io/${ipAddress}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <button
      onClick={handleClick}
      className="truncate text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors"
      title={`Look up ${ipAddress} on ipinfo.io`}
    >
      <span className="truncate">{ipAddress}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
    </button>
  );
};

// Skeleton components for loading states
const DeviceSkeleton = () => (
  <div className="p-3 sm:p-4 rounded-lg border bg-card border-border shadow-sm animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
      <div className="flex-1 min-w-0">
        {/* Device header with icon, name and status */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-5 h-5 bg-muted rounded"></div>
          <div className="h-5 bg-muted rounded w-36 sm:w-40"></div>
          <div className="h-5 bg-muted rounded w-20"></div>
        </div>
        
        {/* Device details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-28"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-24"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-32"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-20"></div>
          </div>
        </div>
        
        {/* Additional device info */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-44"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-38"></div>
          </div>
        </div>
      </div>
      
      {/* Action buttons skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0 sm:min-w-[280px]">
        <div className="h-8 bg-muted rounded col-span-2 sm:col-span-1"></div>
        <div className="h-8 bg-muted rounded"></div>
        <div className="h-8 bg-muted rounded"></div>
        <div className="h-8 bg-muted rounded"></div>
      </div>
    </div>
    
    {/* Separator and timestamp */}
    <div className="h-px bg-border my-3"></div>
    <div className="flex justify-between items-center">
      <div className="h-3 bg-muted rounded w-32"></div>
      <div className="h-3 bg-muted rounded w-24"></div>
    </div>
  </div>
);

const UserSkeleton = () => (
  <div className="p-3 sm:p-4 rounded-lg border bg-card border-border shadow-sm animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        {/* User header */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-5 h-5 bg-muted rounded"></div>
          <div className="h-5 bg-muted rounded w-32"></div>
          <div className="h-5 bg-muted rounded w-28"></div>
        </div>
        
        {/* User details */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-36"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-28"></div>
          </div>
        </div>
      </div>
      
      {/* Action buttons skeleton */}
      <div className="flex flex-row gap-2">
        <div className="h-8 bg-muted rounded w-20"></div>
        <div className="h-8 bg-muted rounded w-16"></div>
        <div className="h-8 bg-muted rounded w-18"></div>
      </div>
    </div>
  </div>
);

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
          }
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
          <Badge variant="destructive" className="bg-red-600 dark:bg-red-700 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            Block by Default
          </Badge>
        );
      }
      return (
        <Badge variant="default" className="bg-green-600 dark:bg-green-700 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          Allow by Default
        </Badge>
      );
    };

    return (
      <div className="p-3 sm:p-4 rounded-lg border bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-4 h-4" />
              <h3 className="font-semibold text-foreground truncate">
                {user.username || user.userId}
              </h3>
              {getPreferenceBadge(user.defaultBlock)}
            </div>
            {/* <div className="text-sm text-slate-600 dark:text-slate-400">
            User ID: {user.userId}
          </div> */}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={user.defaultBlock === null ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdatePreference(null)}
              disabled={isUpdating}
              className="text-xs px-2"
            >
              <Settings className="w-3 h-3 mr-1" />
              Global
            </Button>
            <Button
              variant={user.defaultBlock === false ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdatePreference(false)}
              disabled={isUpdating}
              className={`text-xs px-2 ${
                user.defaultBlock === false
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                  : ""
              }`}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Allow
            </Button>
            <Button
              variant={user.defaultBlock === true ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdatePreference(true)}
              disabled={isUpdating}
              className={`text-xs px-2 ${
                user.defaultBlock === true
                  ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white"
                  : ""
              }`}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Block
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

UserPreferenceCard.displayName = "UserPreferenceCard";

interface DeviceApprovalProps {
  devicesData?: {
    all: UserDevice[];
    pending: UserDevice[];
    approved: UserDevice[];
    processed: UserDevice[];
  };
  usersData?: UserPreference[];
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void;
}

const DeviceApproval = memo(({ devicesData, usersData, onRefresh, autoRefresh: parentAutoRefresh, onAutoRefreshChange }: DeviceApprovalProps) => {
  const [allDevices, setAllDevices] = useState<UserDevice[]>([]);
  const [pendingDevices, setPendingDevices] = useState<UserDevice[]>([]);
  const [processedDevices, setProcessedDevices] = useState<UserDevice[]>([]);
  const [users, setUsers] = useState<UserPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(parentAutoRefresh ?? true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "processed" | "users">(
    "pending"
  );
  const [searchDevices, setSearchDevices] = useState("");
  const [searchUsers, setSearchUsers] = useState("");

  // Update devices state when devicesData prop changes
  useEffect(() => {
    if (devicesData) {
      // Only update if data actually changed
      const currentAllString = JSON.stringify(allDevices);
      const currentPendingString = JSON.stringify(pendingDevices);
      const currentProcessedString = JSON.stringify(processedDevices);
      
      const newAllString = JSON.stringify(devicesData.all || []);
      const newPendingString = JSON.stringify(devicesData.pending || []);
      const newProcessedString = JSON.stringify(devicesData.processed || []);
      
      if (currentAllString !== newAllString) {
        setAllDevices(devicesData.all || []);
      }
      if (currentPendingString !== newPendingString) {
        setPendingDevices(devicesData.pending || []);
      }
      if (currentProcessedString !== newProcessedString) {
        setProcessedDevices(devicesData.processed || []);
      }
      
      setLoading(false);
    }
  }, [devicesData, allDevices, pendingDevices, processedDevices]);

  // Update users state when usersData prop changes
  useEffect(() => {
    if (usersData) {
      // Only update if data actually changed
      const currentUsersString = JSON.stringify(users);
      const newUsersString = JSON.stringify(usersData || []);
      
      if (currentUsersString !== newUsersString) {
        setUsers(usersData || []);
      }
    }
  }, [usersData, users]);

  // Sync local autoRefresh with parent
  useEffect(() => {
    if (parentAutoRefresh !== undefined) {
      setAutoRefresh(parentAutoRefresh);
    }
  }, [parentAutoRefresh]);

  // Confirmation dialog states
  const [confirmAction, setConfirmAction] = useState<{
    device: UserDevice;
    action: "approve" | "reject" | "delete" | "toggle";
    title: string;
    description: string;
  } | null>(null);

  const handleRefresh = () => {
    if (onRefresh) {
      setRefreshing(true);
      onRefresh();
      // Reset refreshing state after a short delay
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    if (onAutoRefreshChange) {
      onAutoRefreshChange(newValue);
    }
  };

  // Auto-refresh functionality (controlled by parent dashboard component)
  // The dashboard component handles the actual refresh interval

  // Filter and sort functions
  const filteredDevices = (
    deviceList: UserDevice[],
    listType: "pending" | "processed" | "all" = "all"
  ) => {
    let filtered = deviceList;

    // Apply search filter if search term exists
    if (searchDevices.trim()) {
      const searchLower = searchDevices.toLowerCase();
      filtered = deviceList.filter((device) => {
        const username = (device.username || device.userId || "").toLowerCase();
        const deviceName = (
          device.deviceName ||
          device.deviceIdentifier ||
          ""
        ).toLowerCase();
        const devicePlatform = (device.devicePlatform || "").toLowerCase();
        const deviceProduct = (device.deviceProduct || "").toLowerCase();

        return (
          username.includes(searchLower) ||
          deviceName.includes(searchLower) ||
          devicePlatform.includes(searchLower) ||
          deviceProduct.includes(searchLower)
        );
      });
    }

    // Apply sorting based on the list type
    return filtered.sort((a, b) => {
      const usernameA = a.username || a.userId || "";
      const usernameB = b.username || b.userId || "";

      // For pending devices: sort by newest first (firstSeen desc), then by username
      if (listType === "pending") {
        const dateA = new Date(a.firstSeen).getTime();
        const dateB = new Date(b.firstSeen).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Newest first
        }
        return usernameA.localeCompare(usernameB);
      }

      // For processed devices: sort by username first, then by last seen desc
      if (listType === "processed") {
        if (usernameA !== usernameB) {
          return usernameA.localeCompare(usernameB);
        }
        const dateA = new Date(a.lastSeen).getTime();
        const dateB = new Date(b.lastSeen).getTime();
        return dateB - dateA; // Most recently active first within same user
      }

      // Default: sort by username
      return usernameA.localeCompare(usernameB);
    });
  };

  const filteredUsers = users
    .filter((user) => {
      if (!searchUsers.trim()) return true;

      const searchLower = searchUsers.toLowerCase();
      const username = (user.username || "").toLowerCase();
      const userId = user.userId.toLowerCase();

      return username.includes(searchLower) || userId.includes(searchLower);
    })
    .sort((a, b) => {
      // Sort users alphabetically by username, fallback to userId
      const nameA = a.username || a.userId;
      const nameB = b.username || b.userId;
      return nameA.localeCompare(nameB);
    });

  const handleApprove = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/approve`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        // Optimistic update - update the device status immediately
        const updateDeviceStatus = (devices: UserDevice[]) =>
          devices.map((device) =>
            device.id === deviceId
              ? { ...device, status: "approved" as const }
              : device
          );

        setAllDevices(updateDeviceStatus);
        setProcessedDevices((prev) => updateDeviceStatus(prev));
        setPendingDevices((devices) =>
          devices.filter((device) => device.id !== deviceId)
        );

        // Still fetch to ensure consistency
        setTimeout(handleRefresh, 100);
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
        }
      );

      if (response.ok) {
        // Optimistic update
        const updateDeviceStatus = (devices: UserDevice[]) =>
          devices.map((device) =>
            device.id === deviceId
              ? { ...device, status: "rejected" as const }
              : device
          );

        setAllDevices((prev) => updateDeviceStatus(prev));
        setProcessedDevices((prev) => updateDeviceStatus(prev));
        setPendingDevices((devices) =>
          devices.filter((device) => device.id !== deviceId)
        );

        setTimeout(handleRefresh, 100);
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
        }
      );

      if (response.ok) {
        // Optimistic update - remove device immediately
        const removeDevice = (devices: UserDevice[]) =>
          devices.filter((device) => device.id !== deviceId);

        setAllDevices((prev) => removeDevice(prev));
        setProcessedDevices((prev) => removeDevice(prev));
        setPendingDevices((prev) => removeDevice(prev));

        setTimeout(handleRefresh, 100);
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

  const getDeviceIcon = (platform: string | null | undefined, product: string | null | undefined) => {
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
          <Badge variant="default" className="bg-green-600 dark:bg-green-700 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="bg-red-600 dark:bg-red-700 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const devicesToShow =
    activeTab === "processed"
      ? filteredDevices(processedDevices, "processed")
      : activeTab === "pending"
        ? filteredDevices(pendingDevices, "pending")
        : [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <Shield className="w-5 h-5 mr-2" />
                Device Management
              </CardTitle>
              <CardDescription className="mt-1 flex items-center">
                Manage device access to your Plex server
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                              <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoRefreshToggle}
                  className={`text-xs sm:text-sm ${
                    autoRefresh ? "bg-green-50 border-green-200 text-green-700" : ""
                  }`}
                >
                  <Wifi
                    className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${autoRefresh ? "animate-pulse" : ""}`}
                  />
                  {autoRefresh ? "Live" : "Manual"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-xs sm:text-sm"
                >
                  <RefreshCw
                    className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${refreshing ? "animate-spin" : ""}`}
                  />
                  <span>Refresh</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search bars */}
          {activeTab === "users" ? (
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by username..."
                  value={searchUsers}
                  onChange={(e) => setSearchUsers(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              {searchUsers && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing {filteredUsers.length} of {users.length} users
                </p>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search devices by username, device name, or platform..."
                  value={searchDevices}
                  onChange={(e) => setSearchDevices(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              {searchDevices && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing{" "}
                  {activeTab === "pending"
                    ? filteredDevices(pendingDevices).length
                    : filteredDevices(processedDevices).length}{" "}
                  of{" "}
                  {activeTab === "pending"
                    ? pendingDevices.length
                    : processedDevices.length}{" "}
                  devices
                </p>
              )}
            </div>
          )}

          {activeTab === "users" ? (
            // Users management section
            <div>
              {(loading && users.length === 0) ? (
                // Show skeleton loading for users only on initial load
                <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
                  <div className="space-y-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <UserSkeleton key={`user-skeleton-${i}`} />
                    ))}
                  </div>
                </ScrollArea>
              ) : filteredUsers.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {searchUsers ? (
                    <>
                      <Search className="w-6 h-6 mr-2" />
                      No users match your search
                    </>
                  ) : (
                    <>
                      <User className="w-6 h-6 mr-2" />
                      No users found
                    </>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
                  <div className="space-y-4">
                    {filteredUsers.map((user) => (
                      <UserPreferenceCard
                        key={user.userId}
                        user={user}
                        onUpdate={handleRefresh}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (loading && (
            (activeTab === "pending" && pendingDevices.length === 0) ||
            (activeTab === "processed" && processedDevices.length === 0)
          )) ? (
            // Show skeleton loading for devices only on initial load when no data exists
            <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
              <div className="space-y-4">
                {Array.from({ 
                  length: activeTab === "pending" ? 3 : activeTab === "processed" ? 5 : 4 
                }, (_, i) => (
                  <DeviceSkeleton key={`device-skeleton-${activeTab}-${i}`} />
                ))}
              </div>
            </ScrollArea>
          ) : devicesToShow.length === 0 ? (
            <div className="flex items-center justify-center h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] text-muted-foreground">
              {searchDevices ? (
                <>
                  <Search className="w-6 h-6 mr-2" />
                  No devices match your search
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6 mr-2" />
                  {activeTab === "processed"
                    ? "No processed devices found"
                    : "No pending devices"}
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
              <div className="space-y-4">
                {devicesToShow.map((device) => (
                  <div
                    key={device.id}
                    className="p-3 sm:p-4 rounded-lg border bg-card border-border shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          {getDeviceIcon(
                            device.devicePlatform,
                            device.deviceProduct
                          )}
                          <h3 className="font-semibold text-foreground truncate">
                            {/* On mobile, show shortened name */}
                            <span className="sm:hidden">
                              {(device.deviceName || device.deviceIdentifier).length > 14 
                                ? (device.deviceName || device.deviceIdentifier).slice(0, 14) + '...'
                                : (device.deviceName || device.deviceIdentifier)
                              }
                            </span>
                            <span className="hidden sm:inline">
                              {device.deviceName || device.deviceIdentifier}
                            </span>
                          </h3>
                          {getDeviceStatus(device)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
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
                            <ClickableIP ipAddress={device.ipAddress} />
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Streams Started: {device.sessionCount}
                          </div>
                        </div>
                      </div>

                      {/* Desktop: Buttons on the right side */}
                      <div className="hidden sm:flex sm:flex-col sm:gap-2 sm:min-w-[140px]">
                        {/* Details button on top */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDevice(device)}
                          className="text-xs px-2 w-full"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          <span>Details</span>
                        </Button>

                        {/* Action buttons below */}
                        <div className="flex gap-2">
                          {activeTab === "pending" ? (
                            /* Pending devices: Show Approve, Reject, Delete buttons */
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => showApproveConfirmation(device)}
                                disabled={actionLoading === device.id}
                                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 flex-1"
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
                                className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-2 flex-1"
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
                                className="text-xs px-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 flex-1"
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
                                className={`text-xs px-2 flex-1 ${
                                  device.status === "approved"
                                    ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                                    : "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
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
                                className="text-xs px-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 flex-1"
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
                    </div>

                    {/* Mobile: Buttons at full width below device info */}
                    <div className="sm:hidden space-y-2">
                      {/* Details button on top */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDevice(device)}
                        className="text-xs px-2 w-full"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        <span>Details</span>
                      </Button>

                      {/* Action buttons below at full width */}
                      <div className="grid grid-cols-1 gap-2">
                        {activeTab === "pending" ? (
                          /* Pending devices: Show Approve, Reject, Delete buttons */
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => showApproveConfirmation(device)}
                              disabled={actionLoading === device.id}
                              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 w-full"
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
                              className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-2 w-full"
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
                              className="text-xs px-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 w-full"
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
                              className={`text-xs px-2 w-full ${
                                device.status === "approved"
                                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                                  : "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
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
                              className="text-xs px-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 w-full"
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

                    <div className="text-xs text-muted-foreground">
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
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Device Name
                  </h4>
                  <p className="text-foreground">
                    {selectedDevice.deviceName || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    User
                  </h4>
                  <p className="text-foreground">
                    {selectedDevice.username || selectedDevice.userId}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Platform
                  </h4>
                  <p className="text-foreground">
                    {selectedDevice.devicePlatform || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Product
                  </h4>
                  <p className="text-foreground">
                    {selectedDevice.deviceProduct || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Version
                  </h4>
                  <p className="text-foreground">
                    {selectedDevice.deviceVersion || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    IP Address
                  </h4>
                  <div className="text-foreground">
                    <ClickableIP ipAddress={selectedDevice.ipAddress} />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Streams Started
                  </h4>
                  <p className="text-foreground">
                    {selectedDevice.sessionCount}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Status
                  </h4>
                  <div>{getDeviceStatus(selectedDevice)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                  Device Identifier
                </h4>
                <p className="text-xs font-mono bg-muted p-2 rounded">
                  {selectedDevice.deviceIdentifier}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    First Seen
                  </h4>
                  <p className="text-sm text-foreground">
                    {new Date(selectedDevice.firstSeen).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    Last Seen
                  </h4>
                  <p className="text-sm text-foreground">
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
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              {confirmAction?.action === "delete" && (
                <Trash2 className="w-5 h-5 text-red-600" />
              )}
              {confirmAction?.action === "toggle" &&
                (confirmAction.device.status === "approved" ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ))}
              {confirmAction?.title}
            </DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>

          {confirmAction && (
            <div className="my-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                {getDeviceIcon(
                  confirmAction.device.devicePlatform,
                  confirmAction.device.deviceProduct
                )}
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {confirmAction.device.deviceName ||
                      confirmAction.device.deviceIdentifier}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {confirmAction.device.username ||
                      confirmAction.device.userId}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
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
                    ? "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                    : confirmAction?.action === "delete"
                      ? "bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
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
