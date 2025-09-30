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
import { Input } from "@/components/ui/input";
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
  Edit2,
  Save,
  X,
  Timer,
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
  Activity,
} from "lucide-react";
import { UserDevice, UserPreference, AppSetting } from "@/types";
import { config } from "@/lib/config";
import { 
  useDeviceActions, 
  useUserPreferences, 
  useDeviceUtils 
} from "@/hooks/device-management";
import { DeviceDetailsModal } from "@/components/device-management/DeviceDetailsModal";
import { TemporaryAccessModal } from "@/components/device-management/TemporaryAccessModal";
import { ConfirmationModal } from "@/components/device-management/ConfirmationModal";
import { UserGroupCard } from "@/components/device-management/UserGroupCard";
import { DeviceCard } from "@/components/device-management/DeviceCard";
import { ClickableIP, UserAvatar, getDeviceIcon, DeviceStatus, getUserPreferenceBadge } from "@/components/device-management/SharedComponents";

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
  settingsData?: AppSetting[];
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void;
  navigationTarget?: {
    userId: string;
    deviceIdentifier: string;
  } | null;
  onNavigationComplete?: () => void;
}

interface ConfirmActionData {
  device: UserDevice;
  action: "approve" | "reject" | "delete" | "toggle";
  title: string;
  description: string;
}

const DeviceManagement = memo(({
  devicesData,
  usersData,
  settingsData,
  onRefresh,
  autoRefresh: parentAutoRefresh,
  onAutoRefreshChange,
  navigationTarget,
  onNavigationComplete
}: DeviceManagementProps) => {
  // State management
  const [userGroups, setUserGroups] = useState<UserDeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(parentAutoRefresh ?? true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [editingDevice, setEditingDevice] = useState<number | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [temporaryAccessDevice, setTemporaryAccessDevice] = useState<number | null>(null);
  const [durationValue, setDurationValue] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks'>('hours');

  // Confirmation dialog states
  const [confirmAction, setConfirmAction] = useState<{
    device: UserDevice;
    action: "approve" | "reject" | "delete" | "toggle";
    title: string;
    description: string;
  } | null>(null);

  // Custom hooks
  const deviceActions = useDeviceActions();
  const userPreferences = useUserPreferences();
  const deviceUtils = useDeviceUtils();

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
    () => getStoredValue(USER_SORT_BY_KEY, "pendingCount") as "username" | "deviceCount" | "pendingCount"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    () => getStoredValue(USER_SORT_ORDER_KEY, "desc") as "asc" | "desc"
  );

  // Save sorting preferences to localStorage when they change
  useEffect(() => {
    setStoredValue(USER_SORT_BY_KEY, sortBy);
  }, [sortBy]);

  useEffect(() => {
    setStoredValue(USER_SORT_ORDER_KEY, sortOrder);
  }, [sortOrder]);

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

  // Handle navigation from streams
  useEffect(() => {
    if (navigationTarget && userGroups.length > 0) {
      const { userId, deviceIdentifier } = navigationTarget;
      
      // First expand the user if not already expanded
      const wasExpanded = expandedUsers.has(userId);
      if (!wasExpanded) {
        const newExpanded = new Set(expandedUsers);
        newExpanded.add(userId);
        setExpandedUsers(newExpanded);
      }
      
      // Use appropriate delay based on whether expansion is needed
      const delay = wasExpanded ? 100 : 600; // Longer delay if we need to wait for expansion
      
      setTimeout(() => {
        const deviceElement = document.querySelector(`[data-device-identifier="${deviceIdentifier}"]`);
        if (deviceElement) {
          // Scroll directly to the device with some padding above
          deviceElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
          
          // Add highlight effect
          setTimeout(() => {
            deviceElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-75');
            setTimeout(() => {
              deviceElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-75');
              // Call completion callback
              if (onNavigationComplete) {
                onNavigationComplete();
              }
            }, 1500);
          }, 200); // Small delay before highlighting
        }
      }, delay);
    }
  }, [navigationTarget, userGroups.length, onNavigationComplete]);

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

  // User preference update handler
  const handleUpdateUserPreference = async (userId: string, defaultBlock: boolean | null) => {
    const success = await userPreferences.updateUserPreference(userId, defaultBlock);
    if (success) {
      handleRefresh();
    }
  };

  // Reset duration values when modal opens
  useEffect(() => {
    if (temporaryAccessDevice) {
      setDurationValue(1);
      setDurationUnit('hours');
    }
  }, [temporaryAccessDevice]);

  // Device action handlers
  const handleApprove = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.approveDevice(deviceId);
      if (success) {
        setTimeout(handleRefresh, 100);
      }
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleReject = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.rejectDevice(deviceId);
      if (success) {
        setTimeout(handleRefresh, 100);
      }
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleDelete = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.deleteDevice(deviceId);
      if (success) {
        setTimeout(handleRefresh, 100);
      }
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

  const handleRename = async (deviceId: number, newName: string) => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.renameDevice(deviceId, newName);
      if (success) {
        // Update the selectedDevice state immediately to reflect the change in the modal
        if (selectedDevice && selectedDevice.id === deviceId) {
          setSelectedDevice({
            ...selectedDevice,
            deviceName: newName,
          });
        }
        
        setTimeout(handleRefresh, 100);
        setEditingDevice(null);
        setNewDeviceName("");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const startEditing = (device: UserDevice) => {
    setEditingDevice(device.id);
    setNewDeviceName(device.deviceName || device.deviceIdentifier);
  };

  const cancelEditing = () => {
    setEditingDevice(null);
    setNewDeviceName("");
  };

  const handleGrantTemporaryAccess = async (deviceId: number, durationMinutes: number) => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.grantTemporaryAccess(deviceId, durationMinutes);
      if (success) {
        setTimeout(handleRefresh, 100);
        setTemporaryAccessDevice(null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Convert duration value and unit to minutes
  const convertToMinutes = (value: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): number => {
    if (value <= 0) return 1; // Minimum 1 minute
    
    switch (unit) {
      case 'minutes':
        return Math.round(value);
      case 'hours':
        return Math.round(value * 60);
      case 'days':
        return Math.round(value * 60 * 24);
      case 'weeks':
        return Math.round(value * 60 * 24 * 7);
      default:
        return Math.round(value);
    }
  };

  // Format duration for display
  const formatDuration = (value: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): string => {
    if (value === 1) {
      return `1 ${unit.slice(0, -1)}`; // Remove 's' for singular
    }
    return `${value} ${unit}`;
  };

  // Validate if duration is reasonable (not more than 1 year)
  const isValidDuration = (value: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): boolean => {
    if (value <= 0) return false; // Invalid if empty or zero
    const totalMinutes = convertToMinutes(value, unit);
    const oneYearInMinutes = 365 * 24 * 60; // 525,600 minutes
    return totalMinutes > 0 && totalMinutes <= oneYearInMinutes;
  };

  const handleRevokeTemporaryAccess = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.revokeTemporaryAccess(deviceId);
      if (success) {
        setTimeout(handleRefresh, 100);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const getTemporaryAccessTimeLeft = (device: UserDevice): string | null => {
    return deviceUtils.getTemporaryAccessTimeLeft(device);
  };

  const hasTemporaryAccess = (device: UserDevice): boolean => {
    return deviceUtils.hasTemporaryAccess(device);
  };



  // Utility function to check if grant temp access should be shown
  const shouldShowGrantTempAccess = (device: UserDevice): boolean => {
    // Only show for pending or rejected devices
    if (device.status !== "pending" && device.status !== "rejected") {
      return false;
    }

    // Find the user's preference
    const userPreference = usersData?.find(u => u.userId === device.userId);
    
    // If user policy is explicitly set to allow (defaultBlock = false), don't show Grant Temp Access
    if (userPreference && userPreference.defaultBlock === false) {
      return false;
    }

    // If user has no preference (defaultBlock = null), check global setting
    if (!userPreference || userPreference.defaultBlock === null) {
      // Find global default block setting
      const globalDefaultBlock = settingsData?.find(s => s.key === "PLEX_GUARD_DEFAULT_BLOCK");
      
      // If global setting is to allow (value "false"), don't show Grant Temp Access
      if (globalDefaultBlock && globalDefaultBlock.value === "false") {
        return false;
      }
    }

    // Show Grant Temp Access if:
    // - User is explicitly set to block (defaultBlock = true), OR
    // - User is set to global AND global is to block (default behavior)
    return true;
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

  // Duplicate functions removed - now using imports from SharedComponents



  // Confirmation dialog handlers
  const showConfirmation = (device: UserDevice, action: "approve" | "reject" | "delete" | "toggle") => {
    const confirmations = {
      approve: {
        title: "Approve Device",
        description: `Are you sure you want to approve this device? "${device.deviceName || device.deviceIdentifier}" will be able to access your Plex server.`,
      },
      reject: {
        title: "Reject Device",
        description: `Are you sure you want to reject this device? "${device.deviceName || device.deviceIdentifier}" will be blocked from accessing your Plex server.`,
      },
      delete: {
        title: "Delete Device",
        description: `Are you sure you want to permanently delete this device record? This action cannot be undone. The device "${device.deviceName || device.deviceIdentifier}" will need to be re-approved if it tries to connect again.`,
      },
      toggle: {
        title: device.status === "approved" ? "Reject Device" : "Approve Device",
        description: device.status === "approved"
          ? `Are you sure you want to reject "${device.deviceName || device.deviceIdentifier}"? This will block access to your Plex server.`
          : `Are you sure you want to approve "${device.deviceName || device.deviceIdentifier}"? This will grant access to your Plex server.`,
      }
    };

    setConfirmAction({
      device,
      action,
      ...confirmations[action]
    });
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
                Manage all users and their devices
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
            <div className="space-y-4">
              {Array.from({ length: 3 }, (_, i) => (
                <UserGroupSkeleton key={`user-group-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredAndSortedGroups.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
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
            <div className="space-y-4">
              {filteredAndSortedGroups.map((group) => (
                  <Collapsible
                    key={group.user.userId}
                    open={expandedUsers.has(group.user.userId)}
                    onOpenChange={() => toggleUserExpansion(group.user.userId)}
                  >
                    <div 
                      className="rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow"
                      data-user-id={group.user.userId}
                    >
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
                            
                            {/* Mobile: Show preference badge */}
                            <div className="sm:hidden">
                              {group.user.preference && getUserPreferenceBadge(group.user.preference.defaultBlock)}
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
                            <div className="space-y-4">
                              {group.devices.map((device) => (
                                <div
                                  key={device.id}
                                  className="relative group bg-gradient-to-br from-card to-card/80 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden backdrop-blur-sm"
                                  data-device-identifier={device.deviceIdentifier}
                                >
                                  {/* Status indicator stripe */}
                                  <div className={`absolute top-0 left-0 w-full h-1 ${
                                    device.status === 'approved' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                    device.status === 'rejected' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                                    'bg-gradient-to-r from-yellow-500 to-amber-500'
                                  }`} />
                                  
                                  {/* Mobile-first layout */}
                                  <div className="space-y-4 sm:space-y-0">
                                    {/* Mobile: Stacked layout */}
                                    <div className="sm:hidden p-4 pt-5 space-y-4">
                                      {/* Device Header */}
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          <div className="flex-shrink-0 mt-0.5">
                                            {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-3 mb-1">
                                              <h4 className="font-semibold text-foreground truncate text-base">
                                                {device.deviceName || device.deviceIdentifier}
                                              </h4>
                                              <DeviceStatus device={device} />
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Device Info Grid - Mobile */}
                                      <div className="grid grid-cols-1 gap-3 text-sm">
                                        <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">Platform</span>
                                          </div>
                                          <span className="text-muted-foreground truncate ml-2">
                                            {device.devicePlatform || "Unknown"}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">IP Address</span>
                                          </div>
                                          <div className="ml-2">
                                            <ClickableIP ipAddress={device.ipAddress} />
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="flex flex-col p-2.5 bg-muted/30 rounded-lg">
                                            <div className="flex items-center gap-1.5 mb-1">
                                              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                                              <span className="text-xs font-medium text-muted-foreground">Streams</span>
                                            </div>
                                            <span className="font-semibold text-foreground">{device.sessionCount}</span>
                                          </div>
                                          <div className="flex flex-col p-2.5 bg-muted/30 rounded-lg">
                                            <div className="flex items-center gap-1.5 mb-1">
                                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                              <span className="text-xs font-medium text-muted-foreground">Last Seen</span>
                                            </div>
                                            <span className="font-semibold text-foreground text-xs">
                                              {new Date(device.lastSeen).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action Buttons - Mobile */}
                                      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
                                        {/* Details Button - Full width on mobile */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setSelectedDevice(device)}
                                          className="text-sm px-4 py-2.5 w-full font-medium shadow-sm hover:shadow-md transition-shadow"
                                        >
                                          <Eye className="w-4 h-4 mr-2" />
                                          View Details
                                        </Button>

                                        {/* Action Buttons Row */}
                                        {device.status === "pending" ? (
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => showApproveConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm px-4 py-2.5 font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <>
                                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                                    <span>Approve</span>
                                                  </>
                                                )}
                                              </Button>
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => showRejectConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="bg-red-600 text-white hover:bg-red-700 text-sm px-4 py-2.5 font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <>
                                                    <XCircle className="w-4 h-4 mr-1.5" />
                                                    <span>Reject</span>
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                            {/* Temporary Access Button */}
                                            {hasTemporaryAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => handleRevokeTemporaryAccess(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-sm px-4 py-2.5 bg-orange-600 text-white hover:bg-orange-700 font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <>
                                                    <Timer className="w-4 h-4 mr-1.5" />
                                                    <span>Revoke Temp Access</span>
                                                  </>
                                                )}
                                              </Button>
                                            ) : shouldShowGrantTempAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => setTemporaryAccessDevice(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-sm px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                <Timer className="w-4 h-4 mr-1.5" />
                                                <span>Grant Temp Access</span>
                                              </Button>
                                            ) : null}
                                          </div>
                                        ) : device.status === "rejected" ? (
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => showToggleConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-3 py-2"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    <span>Approve</span>
                                                  </>
                                                )}
                                              </Button>
                                              <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => showDeleteConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="text-xs px-3 py-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <Trash2 className="w-3 h-3 mr-1" />
                                                    <span>Delete</span>
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                            {/* Temporary Access Button for Rejected Devices */}
                                            {hasTemporaryAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => handleRevokeTemporaryAccess(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-sm px-4 py-2.5 bg-orange-600 text-white hover:bg-orange-700 font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <>
                                                    <Timer className="w-4 h-4 mr-1.5" />
                                                    <span>Revoke Temp Access</span>
                                                  </>
                                                )}
                                              </Button>
                                            ) : shouldShowGrantTempAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => setTemporaryAccessDevice(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-sm px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                <Timer className="w-4 h-4 mr-1.5" />
                                                <span>Grant Temp Access</span>
                                              </Button>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-2 gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => showToggleConfirmation(device)}
                                              disabled={actionLoading === device.id}
                                              className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-3 py-2"
                                            >
                                              {actionLoading === device.id ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <>
                                                  <XCircle className="w-3 h-3 mr-1" />
                                                  <span>Reject</span>
                                                </>
                                              )}
                                            </Button>
                                            <Button
                                              variant="destructive"
                                              size="sm"
                                              onClick={() => showDeleteConfirmation(device)}
                                              disabled={actionLoading === device.id}
                                              className="text-xs px-3 py-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                                            >
                                              {actionLoading === device.id ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <>
                                                  <Trash2 className="w-3 h-3 mr-1" />
                                                  <span>Delete</span>
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Desktop: Side-by-side layout */}
                                    <div className="hidden sm:flex sm:items-start sm:justify-between sm:gap-6 p-4 pt-5">
                                      <div className="flex-1 min-w-0">
                                        {/* Device Header */}
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            <div className="flex-shrink-0">
                                              {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-semibold text-foreground truncate text-base">
                                                {device.deviceName || device.deviceIdentifier}
                                              </h4>
                                            </div>
                                          </div>
                                          <div className="flex-shrink-0">
                                            <DeviceStatus device={device} />
                                          </div>
                                        </div>
                                        {/* Device Info Grid - Desktop */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                                            <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            <span className="truncate font-medium text-foreground">
                                              {device.devicePlatform || "Unknown Platform"}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                                            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            <ClickableIP ipAddress={device.ipAddress} />
                                          </div>
                                          <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                                            <Activity className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">
                                              {device.sessionCount} streams
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">
                                              {new Date(device.lastSeen).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action Buttons - Desktop (Right side) */}
                                      <div className="flex flex-col gap-3 min-w-0 w-52">
                                        {/* Details Button */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setSelectedDevice(device)}
                                          className="text-sm px-3 py-2 w-full font-medium shadow-sm hover:shadow-md transition-all"
                                        >
                                          <Eye className="w-4 h-4 mr-2" />
                                          View Details
                                        </Button>

                                        {/* Action Buttons Row */}
                                        {device.status === "pending" ? (
                                          <div className="space-y-2">
                                            <div className="flex gap-2">
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => showApproveConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm px-3 py-2 flex-1 font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <>
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                    Approve
                                                  </>
                                                )}
                                              </Button>
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => showRejectConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="bg-red-600 text-white hover:bg-red-700 text-sm px-3 py-2 flex-1 font-medium shadow-sm hover:shadow-md transition-all"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <>
                                                    <XCircle className="w-4 h-4 mr-1" />
                                                    Reject
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                            {/* Temporary Access Button */}
                                            {hasTemporaryAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => handleRevokeTemporaryAccess(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-xs px-2 py-1 bg-orange-600 text-white hover:bg-orange-700"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <Timer className="w-3 h-3 mr-1" />
                                                    Revoke Temp
                                                  </>
                                                )}
                                              </Button>
                                            ) : shouldShowGrantTempAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => setTemporaryAccessDevice(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                                              >
                                                <Timer className="w-3 h-3 mr-1" />
                                                Temp Access
                                              </Button>
                                            ) : null}
                                          </div>
                                        ) : device.status === "rejected" ? (
                                          <div className="space-y-2">
                                            <div className="flex gap-1">
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => showToggleConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 py-1 flex-1"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Approve
                                                  </>
                                                )}
                                              </Button>
                                              <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => showDeleteConfirmation(device)}
                                                disabled={actionLoading === device.id}
                                                className="text-xs px-2 py-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <Trash2 className="w-3 h-3 mr-1" />
                                                    Delete
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                            {/* Temporary Access Button for Rejected Devices */}
                                            {hasTemporaryAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => handleRevokeTemporaryAccess(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-xs px-2 py-1 bg-orange-600 text-white hover:bg-orange-700"
                                              >
                                                {actionLoading === device.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <Timer className="w-3 h-3 mr-1" />
                                                    Revoke Temp
                                                  </>
                                                )}
                                              </Button>
                                            ) : shouldShowGrantTempAccess(device) ? (
                                              <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => setTemporaryAccessDevice(device.id)}
                                                disabled={actionLoading === device.id}
                                                className="w-full text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                                              >
                                                <Timer className="w-3 h-3 mr-1" />
                                                Temp Access
                                              </Button>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="flex gap-1">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => showToggleConfirmation(device)}
                                              disabled={actionLoading === device.id}
                                              className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-2 py-1 flex-1"
                                            >
                                              {actionLoading === device.id ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <>
                                                  <XCircle className="w-3 h-3 mr-1" />
                                                  Reject
                                                </>
                                              )}
                                            </Button>
                                            <Button
                                              variant="destructive"
                                              size="sm"
                                              onClick={() => showDeleteConfirmation(device)}
                                              disabled={actionLoading === device.id}
                                              className="text-xs px-2 py-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                                            >
                                              {actionLoading === device.id ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <>
                                                  <Trash2 className="w-3 h-3 mr-1" />
                                                  Delete
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        )}
                                      </div>
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
          )}
        </CardContent>
      </Card>

      {/* Device Details Modal */}
      <DeviceDetailsModal
        device={selectedDevice}
        isOpen={!!selectedDevice}
        onClose={() => setSelectedDevice(null)}
        editingDevice={editingDevice}
        newDeviceName={newDeviceName}
        actionLoading={actionLoading}
        onEdit={startEditing}
        onCancelEdit={cancelEditing}
        onRename={handleRename}
        onNewDeviceNameChange={setNewDeviceName}
      />

      {/* Temporary Access Modal */}
      <TemporaryAccessModal
        device={temporaryAccessDevice ? userGroups.flatMap(group => group.devices).find(d => d.id === temporaryAccessDevice) || null : null}
        isOpen={!!temporaryAccessDevice}
        onClose={() => setTemporaryAccessDevice(null)}
        onGrantAccess={handleGrantTemporaryAccess}
        actionLoading={actionLoading}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        confirmAction={confirmAction}
        actionLoading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
});

DeviceManagement.displayName = "DeviceManagement";

export { DeviceManagement };