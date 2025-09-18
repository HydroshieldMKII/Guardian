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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Users,
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

// User avatar component that displays Plex profile picture
const UserAvatar = ({ userId, username, avatarUrl }: { 
  userId: string; 
  username?: string; 
  avatarUrl?: string;
}) => {
  const displayName = username || userId;
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <Avatar className="w-10 h-10 flex-shrink-0">
      {avatarUrl && (
        <AvatarImage 
          src={avatarUrl} 
          alt={`${displayName}'s avatar`}
          className="object-cover"
        />
      )}
      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

// User-Device group interface
interface UserDeviceGroup {
  user: {
    userId: string;
    username?: string;
    preference?: UserPreference;
  };
  devices: UserDevice[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

// Skeleton components for loading states
const UserGroupSkeleton = () => (
  <div className="rounded-lg border bg-card shadow-sm animate-pulse">
    <div className="p-4 border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-6 bg-muted rounded w-32"></div>
          <div className="h-5 bg-muted rounded w-20"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded w-16"></div>
          <div className="h-6 bg-muted rounded w-16"></div>
          <div className="h-6 bg-muted rounded w-16"></div>
        </div>
      </div>
    </div>
    <div className="p-4 space-y-3">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="p-3 rounded border bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-4 bg-muted rounded w-16"></div>
            </div>
            <div className="flex gap-1">
              <div className="h-6 bg-muted rounded w-16"></div>
              <div className="h-6 bg-muted rounded w-16"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 bg-muted rounded w-20"></div>
            <div className="h-3 bg-muted rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface DeviceManagementProps {
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

const DeviceManagement = memo(({
  devicesData,
  usersData,
  onRefresh,
  autoRefresh: parentAutoRefresh,
  onAutoRefreshChange
}: DeviceManagementProps) => {
  const [userGroups, setUserGroups] = useState<UserDeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(parentAutoRefresh ?? true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  
  // Local storage keys for sorting preferences
  const USER_SORT_BY_KEY = "guardian-unified-sort-by";
  const USER_SORT_ORDER_KEY = "guardian-unified-sort-order";

  const getStoredValue = (key: string, defaultValue: string) => {
    if (typeof window === "undefined") return defaultValue;
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const setStoredValue = (key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is not available
    }
  };
  
  // Sorting state with localStorage initialization
  const [sortBy, setSortBy] = useState<"username" | "deviceCount" | "pendingCount">(
    () => getStoredValue(USER_SORT_BY_KEY, "username") as "username" | "deviceCount" | "pendingCount"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    () => getStoredValue(USER_SORT_ORDER_KEY, "asc") as "asc" | "desc"
  );

  // Save sorting preferences to localStorage when they change
  useEffect(() => {
    setStoredValue(USER_SORT_BY_KEY, sortBy);
  }, [sortBy]);

  useEffect(() => {
    setStoredValue(USER_SORT_ORDER_KEY, sortOrder);
  }, [sortOrder]);

  // Confirmation dialog states
  const [confirmAction, setConfirmAction] = useState<{
    device: UserDevice;
    action: "approve" | "reject" | "delete" | "toggle";
    title: string;
    description: string;
  } | null>(null);

  // Group devices by user and merge with user preferences
  useEffect(() => {
    if (devicesData && usersData) {
      const deviceGroups = new Map<string, UserDeviceGroup>();
      
      // Initialize groups from devices
      devicesData.all.forEach(device => {
        const userId = device.userId;
        if (!deviceGroups.has(userId)) {
          deviceGroups.set(userId, {
            user: {
              userId,
              username: device.username,
              preference: usersData.find(u => u.userId === userId)
            },
            devices: [],
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0
          });
        }
        
        const group = deviceGroups.get(userId)!;
        group.devices.push(device);
        
        // Update counts
        switch (device.status) {
          case "pending":
            group.pendingCount++;
            break;
          case "approved":
            group.approvedCount++;
            break;
          case "rejected":
            group.rejectedCount++;
            break;
        }
        
        // Use device username if user preference doesn't have it
        if (!group.user.username && device.username) {
          group.user.username = device.username;
        }
      });
      
      // Add users without devices (users with preferences but no devices yet)
      usersData.forEach(userPref => {
        if (!deviceGroups.has(userPref.userId)) {
          deviceGroups.set(userPref.userId, {
            user: {
              userId: userPref.userId,
              username: userPref.username,
              preference: userPref
            },
            devices: [],
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0
          });
        }
      });
      
      // Convert to array and sort devices within each group
      const groups = Array.from(deviceGroups.values()).map(group => ({
        ...group,
        devices: group.devices.sort((a, b) => {
          // Sort devices by status (pending first, then by last seen)
          if (a.status !== b.status) {
            const statusOrder = { pending: 0, approved: 1, rejected: 2 };
            return statusOrder[a.status] - statusOrder[b.status];
          }
          return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        })
      }));
      
      setUserGroups(groups);
      setLoading(false);
    }
  }, [devicesData, usersData]);

  // Sync local autoRefresh with parent
  useEffect(() => {
    if (parentAutoRefresh !== undefined) {
      setAutoRefresh(parentAutoRefresh);
    }
  }, [parentAutoRefresh]);

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

  // Filter and sort user groups
  const filteredAndSortedGroups = userGroups
    .filter(group => {
      // Apply search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const username = (group.user.username || group.user.userId).toLowerCase();
        const hasMatchingDevice = group.devices.some(device => {
          const deviceName = (device.deviceName || device.deviceIdentifier || "").toLowerCase();
          const devicePlatform = (device.devicePlatform || "").toLowerCase();
          const deviceProduct = (device.deviceProduct || "").toLowerCase();
          return deviceName.includes(searchLower) || 
                 devicePlatform.includes(searchLower) || 
                 deviceProduct.includes(searchLower);
        });
        
        return username.includes(searchLower) || hasMatchingDevice;
      }
      
      return true;
    })
    .sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case "username":
          valueA = (a.user.username || a.user.userId).toLowerCase();
          valueB = (b.user.username || b.user.userId).toLowerCase();
          break;
        case "deviceCount":
          valueA = a.devices.length;
          valueB = b.devices.length;
          break;
        case "pendingCount":
          valueA = a.pendingCount;
          valueB = b.pendingCount;
          break;
        default:
          valueA = (a.user.username || a.user.userId).toLowerCase();
          valueB = (b.user.username || b.user.userId).toLowerCase();
          break;
      }

      // For numeric values, use numeric comparison
      if (sortBy === "deviceCount" || sortBy === "pendingCount") {
        const comparison = valueA - valueB;
        return sortOrder === "asc" ? comparison : -comparison;
      }

      // For string values, use localeCompare
      const comparison = valueA.localeCompare(valueB);
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Toggle user expansion
  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  // User preference update
  const handleUpdateUserPreference = async (userId: string, defaultBlock: boolean | null) => {
    try {
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/preference`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ defaultBlock }),
        }
      );

      if (response.ok) {
        handleRefresh();
      } else {
        console.error("Failed to update user preference");
      }
    } catch (error) {
      console.error("Error updating user preference:", error);
    }
  };

  // Device action handlers
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
          <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getUserPreferenceBadge = (defaultBlock: boolean | null) => {
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
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <Users className="w-5 h-5 mr-2" />
                User & Device Management
              </CardTitle>
              <CardDescription className="mt-1 flex items-center">
                Manage all users and their devices in one unified view
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
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
          {/* Search and Sort Controls */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by username or device..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              
              {/* Sorting Controls */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <span className="text-sm text-muted-foreground hidden sm:block">Sort:</span>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none">
                        {sortBy === "username" && "Username"}
                        {sortBy === "deviceCount" && "Device Count"}
                        {sortBy === "pendingCount" && "Pending Count"}
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setSortBy("username")}>
                        Username
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("deviceCount")}>
                        Device Count
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("pendingCount")}>
                        Pending Count
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 sm:flex-none"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {sortOrder === "asc" ? (
                      <>
                        <ArrowUp className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Ascending</span>
                        <span className="sm:hidden">Asc</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Descending</span>
                        <span className="sm:hidden">Desc</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            {searchTerm && (
              <p className="text-xs text-muted-foreground mb-4">
                Showing {filteredAndSortedGroups.length} of {userGroups.length} users
              </p>
            )}
          </div>

          {/* User Groups List */}
          {(loading && userGroups.length === 0) ? (
            // Show skeleton loading only on initial load
            <ScrollArea className="h-[70vh] max-h-[700px] sm:max-h-[800px] lg:max-h-[900px]">
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <UserGroupSkeleton key={`user-group-skeleton-${i}`} />
                ))}
              </div>
            </ScrollArea>
          ) : filteredAndSortedGroups.length === 0 ? (
            <div className="flex items-center justify-center h-[70vh] max-h-[700px] sm:max-h-[800px] lg:max-h-[900px] text-muted-foreground">
              {searchTerm ? (
                <>
                  <Search className="w-6 h-6 mr-2" />
                  No users match your search
                </>
              ) : (
                <>
                  <Users className="w-6 h-6 mr-2" />
                  No users found
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[70vh] max-h-[700px] sm:max-h-[800px] lg:max-h-[900px]">
              <div className="space-y-4">
                {filteredAndSortedGroups.map((group) => (
                  <Collapsible
                    key={group.user.userId}
                    open={expandedUsers.has(group.user.userId)}
                    onOpenChange={() => toggleUserExpansion(group.user.userId)}
                  >
                    <div className="rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow">
                      <CollapsibleTrigger asChild>
                        <div className="p-3 sm:p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              {expandedUsers.has(group.user.userId) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <UserAvatar 
                                userId={group.user.userId}
                                username={group.user.username}
                                avatarUrl={group.user.preference?.avatarUrl}
                              />
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
                                  {group.user.username || group.user.userId}
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {group.devices.length} device{group.devices.length !== 1 ? 's' : ''}
                                  {group.pendingCount > 0 && (
                                    <span className="text-yellow-600 dark:text-yellow-400">
                                      {" • "}{group.pendingCount} pending
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="hidden sm:flex">
                                {group.user.preference && getUserPreferenceBadge(group.user.preference.defaultBlock)}
                              </div>
                            </div>
                            
                            {/* Mobile: Stack badges vertically, Desktop: Horizontal */}
                            <div className="flex flex-wrap gap-1 sm:gap-2 sm:ml-4">
                              <div className="sm:hidden">
                                {group.user.preference && getUserPreferenceBadge(group.user.preference.defaultBlock)}
                              </div>
                              {group.pendingCount > 0 && (
                                <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs">
                                  {group.pendingCount} pending
                                </Badge>
                              )}
                              {group.approvedCount > 0 && (
                                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs">
                                  {group.approvedCount} approved
                                </Badge>
                              )}
                              {group.rejectedCount > 0 && (
                                <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs">
                                  {group.rejectedCount} rejected
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="p-3 sm:p-4 space-y-4">
                          {/* User Preference Controls */}
                          <div className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Settings className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm font-medium">Default Device Policy:</span>
                            </div>
                            <div className="flex sm:hidden">
                              {group.user.preference && getUserPreferenceBadge(group.user.preference.defaultBlock)}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                variant={!group.user.preference || group.user.preference.defaultBlock === null ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleUpdateUserPreference(group.user.userId, null)}
                                className="text-xs px-2 py-1"
                              >
                                <Settings className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Global</span>
                                <span className="sm:hidden">Global</span>
                              </Button>
                              <Button
                                variant={group.user.preference?.defaultBlock === false ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleUpdateUserPreference(group.user.userId, false)}
                                className={`text-xs px-2 py-1 ${
                                  group.user.preference?.defaultBlock === false
                                    ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                                    : ""
                                }`}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Allow</span>
                                <span className="sm:hidden">Allow</span>
                              </Button>
                              <Button
                                variant={group.user.preference?.defaultBlock === true ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleUpdateUserPreference(group.user.userId, true)}
                                className={`text-xs px-2 py-1 ${
                                  group.user.preference?.defaultBlock === true
                                    ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white"
                                    : ""
                                }`}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Block</span>
                                <span className="sm:hidden">Block</span>
                              </Button>
                            </div>
                          </div>

                          {/* Devices List */}
                          {group.devices.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                              <Monitor className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-sm">No devices found for this user</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {group.devices.map((device) => (
                                <div
                                  key={device.id}
                                  className="p-3 rounded border bg-card/50 hover:bg-card transition-colors"
                                >
                                  {/* Mobile-first layout */}
                                  <div className="space-y-3">
                                    {/* Device Header */}
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0 mt-0.5">
                                        {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-foreground truncate text-sm sm:text-base">
                                          {device.deviceName || device.deviceIdentifier}
                                        </h4>
                                      </div>
                                    </div>

                                    {/* Device Info Grid - Responsive with Status */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground">
                                      {/* Status badge - first item, left-aligned like other info */}
                                      <div className="flex items-center min-w-0">
                                        <Shield className="w-3 h-3 mr-2 flex-shrink-0" />
                                        {getDeviceStatus(device)}
                                      </div>
                                      <div className="flex items-center min-w-0">
                                        <Monitor className="w-3 h-3 mr-2 flex-shrink-0" />
                                        <span className="truncate">
                                          {device.devicePlatform || "Unknown Platform"}
                                        </span>
                                      </div>
                                      <div className="flex items-center min-w-0">
                                        <MapPin className="w-3 h-3 mr-2 flex-shrink-0" />
                                        <ClickableIP ipAddress={device.ipAddress} />
                                      </div>
                                      <div className="flex items-center">
                                        <Clock className="w-3 h-3 mr-2 flex-shrink-0" />
                                        <span>Streams: {device.sessionCount}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Clock className="w-3 h-3 mr-2 flex-shrink-0" />
                                        <span>Last: {new Date(device.lastSeen).toLocaleDateString()}</span>
                                      </div>
                                    </div>

                                    {/* Action Buttons - Mobile-optimized */}
                                    <div className="flex flex-col gap-2">
                                      {/* Details Button - Full width on mobile */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedDevice(device)}
                                        className="text-xs px-3 py-2 w-full sm:w-auto sm:px-2 sm:py-1"
                                      >
                                        <Eye className="w-3 h-3 mr-2" />
                                        View Details
                                      </Button>

                                      {/* Action Buttons Row */}
                                      {device.status === "pending" ? (
                                        <div className="grid grid-cols-2 gap-2">
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => showApproveConfirmation(device)}
                                            disabled={actionLoading === device.id}
                                            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-3 py-2 sm:px-2 sm:py-1"
                                          >
                                            {actionLoading === device.id ? (
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <>
                                                <CheckCircle className="w-3 h-3 mr-1 sm:mr-2" />
                                                <span className="hidden sm:inline">Approve</span>
                                                <span className="sm:hidden">Approve</span>
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => showRejectConfirmation(device)}
                                            disabled={actionLoading === device.id}
                                            className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-3 py-2 sm:px-2 sm:py-1"
                                          >
                                            {actionLoading === device.id ? (
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <>
                                                <XCircle className="w-3 h-3 mr-1 sm:mr-2" />
                                                <span className="hidden sm:inline">Reject</span>
                                                <span className="sm:hidden">Reject</span>
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                          <Button
                                            variant={device.status === "approved" ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => showToggleConfirmation(device)}
                                            disabled={actionLoading === device.id}
                                            className={`text-xs px-3 py-2 sm:px-2 sm:py-1 ${
                                              device.status === "approved"
                                                ? "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                                                : "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                                            }`}
                                          >
                                            {actionLoading === device.id ? (
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : device.status === "approved" ? (
                                              <>
                                                <XCircle className="w-3 h-3 mr-1 sm:mr-2" />
                                                <span className="hidden sm:inline">Reject</span>
                                                <span className="sm:hidden">Reject</span>
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle className="w-3 h-3 mr-1 sm:mr-2" />
                                                <span className="hidden sm:inline">Approve</span>
                                                <span className="sm:hidden">Approve</span>
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => showDeleteConfirmation(device)}
                                            disabled={actionLoading === device.id}
                                            className="text-xs px-3 py-2 sm:px-2 sm:py-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                                          >
                                            {actionLoading === device.id ? (
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <>
                                                <Trash2 className="w-3 h-3 mr-1 sm:mr-2" />
                                                <span className="hidden sm:inline">Delete</span>
                                                <span className="sm:hidden">Delete</span>
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

          {/* Device Details Dialog - Responsive */}
      <Dialog
        open={!!selectedDevice}
        onOpenChange={() => setSelectedDevice(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-base sm:text-lg">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Device Details
            </DialogTitle>
            <DialogDescription className="text-sm">
              Detailed information about this device
            </DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Device Name
                  </h4>
                  <p className="text-sm sm:text-base text-foreground break-words">
                    {selectedDevice.deviceName || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    User
                  </h4>
                  <p className="text-sm sm:text-base text-foreground break-words">
                    {selectedDevice.username || selectedDevice.userId}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Platform
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {selectedDevice.devicePlatform || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Product
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {selectedDevice.deviceProduct || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Version
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {selectedDevice.deviceVersion || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    IP Address
                  </h4>
                  <div className="text-sm sm:text-base text-foreground">
                    <ClickableIP ipAddress={selectedDevice.ipAddress} />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Streams Started
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {selectedDevice.sessionCount}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Status
                  </h4>
                  <div>{getDeviceStatus(selectedDevice)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground mb-2">
                  Device Identifier
                </h4>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {selectedDevice.deviceIdentifier}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    First Seen
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground">
                    {new Date(selectedDevice.firstSeen).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Last Seen
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground">
                    {new Date(selectedDevice.lastSeen).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSelectedDevice(null)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Action Confirmation Dialog - Mobile responsive */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {confirmAction?.action === "approve" && (
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              )}
              {confirmAction?.action === "reject" && (
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              )}
              {confirmAction?.action === "delete" && (
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              )}
              {confirmAction?.action === "toggle" &&
                (confirmAction.device.status === "approved" ? (
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                ))}
              {confirmAction?.title}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {confirmAction?.description}
            </DialogDescription>
          </DialogHeader>

          {confirmAction && (
            <div className="my-4 p-3 sm:p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                {getDeviceIcon(
                  confirmAction.device.devicePlatform,
                  confirmAction.device.deviceProduct
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {confirmAction.device.deviceName ||
                      confirmAction.device.deviceIdentifier}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {confirmAction.device.username ||
                      confirmAction.device.userId}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Platform: {confirmAction.device.devicePlatform || "Unknown"} •{" "}
                Product: {confirmAction.device.deviceProduct || "Unknown"}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={actionLoading !== null}
              className="w-full sm:w-auto"
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
              className={`w-full sm:w-auto ${
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
              }`}
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {confirmAction?.action === "approve" && (
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  )}
                  {confirmAction?.action === "reject" && (
                    <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  )}
                  {confirmAction?.action === "delete" && (
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  )}
                  {confirmAction?.action === "toggle" &&
                    (confirmAction.device.status === "approved" ? (
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    ) : (
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
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

DeviceManagement.displayName = "DeviceManagement";

export { DeviceManagement };