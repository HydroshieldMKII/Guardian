"use client";

import React, { useState, useEffect, memo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  RefreshCw,
  Wifi,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Monitor,
  Settings,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";

// Hooks
import { useDeviceActions } from "@/hooks/device-management/useDeviceActions";
import { useUserPreferences } from "@/hooks/device-management/useUserPreferences";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import { useToast } from "@/hooks/use-toast";

// Types
import { UserDevice, UserPreference, AppSetting } from "@/types";

// API
import { apiClient } from "@/lib/api";

// Components
import { UserGroupCard } from "@/components/device-management/UserGroupCard";
import { DeviceCard } from "@/components/device-management/DeviceCard";
import { DeviceDetailsModal } from "@/components/device-management/DeviceDetailsModal";
import { TemporaryAccessModal } from "@/components/device-management/TemporaryAccessModal";
import { ConfirmationModal } from "@/components/device-management/ConfirmationModal";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";
import { UserAvatar } from "@/components/device-management/SharedComponents";

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
  lastSeen?: Date;
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

const DeviceManagement = memo(
  ({
    devicesData,
    usersData,
    settingsData,
    onRefresh,
    autoRefresh: parentAutoRefresh,
    onAutoRefreshChange,
    navigationTarget,
    onNavigationComplete,
  }: DeviceManagementProps) => {
    // State management
    const [userGroups, setUserGroups] = useState<UserDeviceGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(parentAutoRefresh ?? true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(
      null
    );
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [editingDevice, setEditingDevice] = useState<number | null>(null);
    const [newDeviceName, setNewDeviceName] = useState("");
    const [temporaryAccessDevice, setTemporaryAccessDevice] = useState<
      number | null
    >(null);
    const [hiddenUsersModalOpen, setHiddenUsersModalOpen] = useState(false);
    const [hiddenUsers, setHiddenUsers] = useState<UserPreference[]>([]);
    const [userHistoryModalOpen, setUserHistoryModalOpen] = useState(false);
    const [selectedHistoryUser, setSelectedHistoryUser] = useState<{
      userId: string;
      username?: string;
    } | null>(null);
    const [scrollToSessionId, setScrollToSessionId] = useState<number | null>(
      null
    );

    // Confirmation dialog states
    const [confirmAction, setConfirmAction] =
      useState<ConfirmActionData | null>(null);

    // Custom hooks
    const deviceActions = useDeviceActions();
    const userPreferences = useUserPreferences();
    const deviceUtils = useDeviceUtils();
    const { toast } = useToast();

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

    // Format duration in minutes to a human-readable format
    const formatDuration = (minutes: number): string => {
      if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else if (minutes < 1440) { // Less than 24 hours
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
          return `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
          return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        }
      } else if (minutes < 10080) { // Less than 7 days
        const days = Math.floor(minutes / 1440);
        const remainingHours = Math.floor((minutes % 1440) / 60);
        if (remainingHours === 0) {
          return `${days} day${days !== 1 ? 's' : ''}`;
        } else {
          return `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
        }
      } else { // 7 days or more
        const weeks = Math.floor(minutes / 10080);
        const remainingDays = Math.floor((minutes % 10080) / 1440);
        if (remainingDays === 0) {
          return `${weeks} week${weeks !== 1 ? 's' : ''}`;
        } else {
          return `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
        }
      }
    };

    // Sorting state with localStorage initialization
    const [sortBy, setSortBy] = useState<
      "username" | "deviceCount" | "pendingCount" | "lastSeen" | "streamCount"
    >(
      () =>
        getStoredValue(USER_SORT_BY_KEY, "pendingCount") as
          | "username"
          | "deviceCount"
          | "pendingCount"
          | "lastSeen"
          | "streamCount"
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
        devicesData.all.forEach((device) => {
          const userId = device.userId;
          if (!deviceGroups.has(userId)) {
            deviceGroups.set(userId, {
              user: {
                userId,
                username: device.username,
                preference: usersData.find((u) => u.userId === userId),
              },
              devices: [],
              pendingCount: 0,
              approvedCount: 0,
              rejectedCount: 0,
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

          // Update lastSeen to the most recent device activity
          if (device.lastSeen) {
            const deviceLastSeen = new Date(device.lastSeen);
            if (!group.lastSeen || deviceLastSeen > group.lastSeen) {
              group.lastSeen = deviceLastSeen;
            }
          }
        });

        // Add users without devices (users with preferences but no devices yet)
        usersData.forEach((userPref) => {
          if (!deviceGroups.has(userPref.userId)) {
            deviceGroups.set(userPref.userId, {
              user: {
                userId: userPref.userId,
                username: userPref.username,
                preference: userPref,
              },
              devices: [],
              pendingCount: 0,
              approvedCount: 0,
              rejectedCount: 0,
            });
          }
        });

        // Convert to array and filter out hidden users
        const groups = Array.from(deviceGroups.values())
          .filter((group) => {
            // Filter out users that are explicitly marked as hidden
            // Include users with no preference (not hidden) or users with preference that are not hidden
            return !group.user.preference || !group.user.preference.hidden;
          })
          .map((group) => ({
            ...group,
            devices: group.devices.sort((a, b) => {
              // Sort devices by status (pending first, then by last seen)
              if (a.status !== b.status) {
                const statusOrder = { pending: 0, approved: 1, rejected: 2 };
                return statusOrder[a.status] - statusOrder[b.status];
              }
              return (
                new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
              );
            }),
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
          const deviceElement = document.querySelector(
            `[data-device-identifier="${deviceIdentifier}"]`
          );
          if (deviceElement) {
            // Scroll directly to the device with some padding above
            deviceElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });

            // Add highlight effect
            setTimeout(() => {
              deviceElement.classList.add(
                "ring-2",
                "ring-blue-500",
                "ring-opacity-75"
              );
              setTimeout(() => {
                deviceElement.classList.remove(
                  "ring-2",
                  "ring-blue-500",
                  "ring-opacity-75"
                );
                // Call completion callback
                if (onNavigationComplete) {
                  onNavigationComplete();
                }
              }, 1500);
            }, 200); // Small delay before highlighting
          }
        }, delay);
      }
    }, [
      navigationTarget,
      userGroups.length,
      expandedUsers,
      onNavigationComplete,
    ]);

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
      .filter((group) => {
        // Apply search filter
        if (searchTerm.trim()) {
          const searchLower = searchTerm.toLowerCase();
          const username = (
            group.user.username || group.user.userId
          ).toLowerCase();
          const hasMatchingDevice = group.devices.some((device) => {
            const deviceName = (
              device.deviceName ||
              device.deviceIdentifier ||
              ""
            ).toLowerCase();
            const devicePlatform = (device.devicePlatform || "").toLowerCase();
            const deviceProduct = (device.deviceProduct || "").toLowerCase();
            return (
              deviceName.includes(searchLower) ||
              devicePlatform.includes(searchLower) ||
              deviceProduct.includes(searchLower)
            );
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
          case "lastSeen":
            // Use lastSeen date, fallback to 0 (epoch) if no devices
            valueA = a.lastSeen ? a.lastSeen.getTime() : 0;
            valueB = b.lastSeen ? b.lastSeen.getTime() : 0;
            break;
          case "streamCount":
            // Sum up session counts across all devices for each user
            valueA = a.devices.reduce(
              (total, device) => total + (device.sessionCount || 0),
              0
            );
            valueB = b.devices.reduce(
              (total, device) => total + (device.sessionCount || 0),
              0
            );
            break;
          default:
            valueA = (a.user.username || a.user.userId).toLowerCase();
            valueB = (b.user.username || b.user.userId).toLowerCase();
            break;
        }

        // For numeric values, use numeric comparison
        if (
          sortBy === "deviceCount" ||
          sortBy === "pendingCount" ||
          sortBy === "lastSeen" ||
          sortBy === "streamCount"
        ) {
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
    const handleUpdateUserPreference = async (
      userId: string,
      defaultBlock: boolean | null
    ) => {
      const success = await userPreferences.updateUserPreference(
        userId,
        defaultBlock
      );
      if (success) {
        handleRefresh();
      }
    };

    // User IP policy update handler
    const handleUpdateUserIPPolicy = async (
      userId: string,
      updates: Partial<UserPreference>
    ) => {
      const success = await userPreferences.updateUserIPPolicy(userId, updates);
      if (success) {
        handleRefresh();
        toast({
          title: "IP Policy Updated",
          description: `Access policies have been updated for this user`,
          variant: "success",
        });
      } else {
        toast({
          title: "Update Failed",
          description: "Failed to update IP access policies",
          variant: "destructive",
        });
      }
    };

    // User visibility toggle handler
    const handleToggleUserVisibility = async (userId: string) => {
      try {
        const user =
          usersData?.find((u) => u.userId === userId) ||
          hiddenUsers.find((u) => u.userId === userId);
        const isCurrentlyHidden = user?.hidden || false;
        const username = user?.username || userId;

        await apiClient.toggleUserVisibility(userId);

        if (isCurrentlyHidden) {
          // User was hidden, now showing
          toast({
            title: "User Shown",
            description: `${username} is now visible in the user list`,
            variant: "success",
          });
        } else {
          // User was visible, now hiding
          toast({
            title: "User Hidden",
            description: `${username} has been hidden from the user list. You can manage hidden users at the bottom of the user list.`,
            variant: "success",
          });
        }

        handleRefresh(); // Refresh to get updated user data
        // If modal is open, refresh hidden users list
        if (hiddenUsersModalOpen) {
          await loadHiddenUsers();
        }
      } catch (error) {
        console.error("Failed to toggle user visibility:", error);
        toast({
          title: "Error",
          description: "Failed to update user visibility",
          variant: "destructive",
        });
      }
    };

    const handleShowHistory = (userId: string) => {
      // Find the username for this userId
      const userGroup = userGroups.find(
        (group) => group.user.userId === userId
      );
      const username =
        userGroup?.user.username || userGroup?.user.preference?.username;

      setSelectedHistoryUser({ userId, username });
      setUserHistoryModalOpen(true);
    };

    const handleNavigateToDeviceFromHistory = (
      userId: string,
      deviceIdentifier: string
    ) => {
      // Expand the user group
      setExpandedUsers((prev) => new Set(prev).add(userId));

      // Find the device to verify it exists
      const device = userGroups
        .find((group) => group.user.userId === userId)
        ?.devices.find((d) => d.deviceIdentifier === deviceIdentifier);

      if (device) {
        const wasExpanded = expandedUsers.has(userId);
        const delay = wasExpanded ? 100 : 600;

        setTimeout(() => {
          const deviceElement = document.querySelector(
            `[data-device-identifier="${deviceIdentifier}"]`
          );
          if (deviceElement) {
            deviceElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });

            // Add highlight effect
            setTimeout(() => {
              deviceElement.classList.add(
                "ring-2",
                "ring-blue-500",
                "ring-opacity-75"
              );
              setTimeout(() => {
                deviceElement.classList.remove(
                  "ring-2",
                  "ring-blue-500",
                  "ring-opacity-75"
                );
              }, 1500);
            }, 200);
          }
        }, delay);
      } else {
        toast({
          title: "Device Not Found",
          description:
            "The device may have been removed or is no longer available.",
          variant: "destructive",
        });
      }
    };

    // Load hidden users for modal
    const loadHiddenUsers = async () => {
      try {
        const hiddenUsersData =
          await apiClient.getHiddenUsers<UserPreference[]>();
        setHiddenUsers(hiddenUsersData);
      } catch (error) {
        console.error("Failed to load hidden users:", error);
      }
    };

    // Open hidden users modal
    const openHiddenUsersModal = async () => {
      await loadHiddenUsers();
      setHiddenUsersModalOpen(true);
    };

    // Device action handlers
    const handleApprove = async (deviceId: number) => {
      try {
        setActionLoading(deviceId);
        const success = await deviceActions.approveDevice(deviceId);
        if (success) {
          setTimeout(handleRefresh, 100);
          toast({
            title: "Device Approved",
            description: "Device has been successfully approved",
            variant: "success",
          });
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
          toast({
            title: "Device Rejected",
            description: "Device has been successfully rejected",
            variant: "success",
          });
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
          toast({
            title: "Device Deleted",
            description: "Device has been successfully deleted",
            variant: "success",
          });
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

    const handleGrantTemporaryAccess = async (
      deviceId: number,
      durationMinutes: number
    ) => {
      try {
        setActionLoading(deviceId);
        const success = await deviceActions.grantTemporaryAccess(
          deviceId,
          durationMinutes
        );
        if (success) {
          setTimeout(handleRefresh, 100);
          setTemporaryAccessDevice(null);
          toast({
            title: "Temporary Access Granted",
            description: `Temporary access granted for ${formatDuration(durationMinutes)}`,
            variant: "success",
          });
        }
      } finally {
        setActionLoading(null);
      }
    };

    const handleRevokeTemporaryAccess = async (deviceId: number) => {
      try {
        setActionLoading(deviceId);
        const success = await deviceActions.revokeTemporaryAccess(deviceId);
        if (success) {
          setTimeout(handleRefresh, 100);
          toast({
            title: "Temporary Access Revoked",
            description: "Temporary access has been successfully revoked",
            variant: "success",
          });
        }
      } finally {
        setActionLoading(null);
      }
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

      // Always show Grant Temp Access for rejected devices
      if (device.status === "rejected") {
        return true;
      }

      // For pending devices, check user and global policies
      const userPreference = usersData?.find((u) => u.userId === device.userId);

      // If user policy is explicitly set to allow (defaultBlock = false), don't show Grant Temp Access for pending devices
      if (userPreference && userPreference.defaultBlock === false) {
        return false;
      }

      // If user has no preference (defaultBlock = null), check global setting for pending devices
      if (!userPreference || userPreference.defaultBlock === null) {
        // Find global default block setting
        const globalDefaultBlock = settingsData?.find(
          (s) => s.key === "PLEX_GUARD_DEFAULT_BLOCK"
        );

        // If global setting is to allow (value "false"), don't show Grant Temp Access for pending devices
        if (globalDefaultBlock && globalDefaultBlock.value === "false") {
          return false;
        }
      }

      // Show Grant Temp Access for pending devices if:
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
                      autoRefresh
                        ? "bg-green-50 border-green-200 text-green-700"
                        : ""
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
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    Sort:
                  </span>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 flex-1 sm:flex-none"
                        >
                          {sortBy === "username" && "Username"}
                          {sortBy === "deviceCount" && "Device Count"}
                          {sortBy === "pendingCount" && "Pending Count"}
                          {sortBy === "lastSeen" && "Last Stream"}
                          {sortBy === "streamCount" && "Stream Count"}
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setSortBy("username")}>
                          Username
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("deviceCount")}
                        >
                          Device Count
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("pendingCount")}
                        >
                          Pending Count
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortBy("lastSeen")}>
                          Last Stream
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("streamCount")}
                        >
                          Stream Count
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 flex-1 sm:flex-none"
                      onClick={() =>
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                      }
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
                  Showing {filteredAndSortedGroups.length} of{" "}
                  {userGroups.length} users
                </p>
              )}
            </div>

            {/* User Groups List */}
            {loading && userGroups.length === 0 ? (
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
                  <UserGroupCard
                    key={group.user.userId}
                    group={group}
                    isExpanded={expandedUsers.has(group.user.userId)}
                    settingsData={settingsData}
                    actionLoading={actionLoading}
                    editingDevice={editingDevice}
                    newDeviceName={newDeviceName}
                    onToggleExpansion={toggleUserExpansion}
                    onUpdateUserPreference={handleUpdateUserPreference}
                    onUpdateUserIPPolicy={handleUpdateUserIPPolicy}
                    onToggleUserVisibility={handleToggleUserVisibility}
                    onShowHistory={handleShowHistory}
                    onEdit={startEditing}
                    onCancelEdit={cancelEditing}
                    onRename={handleRename}
                    onApprove={showApproveConfirmation}
                    onReject={showRejectConfirmation}
                    onDelete={showDeleteConfirmation}
                    onToggleApproval={showToggleConfirmation}
                    onGrantTempAccess={setTemporaryAccessDevice}
                    onRevokeTempAccess={handleRevokeTemporaryAccess}
                    onShowDetails={setSelectedDevice}
                    onNewDeviceNameChange={setNewDeviceName}
                    shouldShowGrantTempAccess={shouldShowGrantTempAccess}
                  />
                ))}

                {/* Show Hidden Users Button */}
                <div className="mt-6 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={openHiddenUsersModal}
                    className="w-full text-sm"
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    Show Hidden Users
                  </Button>
                </div>
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
          device={
            temporaryAccessDevice
              ? userGroups
                  .flatMap((group) => group.devices)
                  .find((d) => d.id === temporaryAccessDevice) || null
              : null
          }
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

        {/* Hidden Users Modal */}
        <Dialog
          open={hiddenUsersModalOpen}
          onOpenChange={setHiddenUsersModalOpen}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <EyeOff className="w-5 h-5 mr-2" />
                Hidden Users
              </DialogTitle>
              <DialogDescription>
                These users are hidden from the main list. Click "Show" to make
                them visible again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {hiddenUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <p>No hidden users found</p>
                </div>
              ) : (
                hiddenUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        userId={user.userId}
                        username={user.username}
                        avatarUrl={user.avatarUrl}
                      />
                      <div>
                        <p className="font-medium">
                          {user.username || "Unknown username"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleToggleUserVisibility(user.userId)}
                      className="ml-4"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Show
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* User History Modal */}
        <UserHistoryModal
          userId={selectedHistoryUser?.userId || null}
          username={selectedHistoryUser?.username}
          isOpen={userHistoryModalOpen}
          onClose={() => {
            setUserHistoryModalOpen(false);
            setSelectedHistoryUser(null);
            setScrollToSessionId(null);
          }}
          onNavigateToDevice={handleNavigateToDeviceFromHistory}
          scrollToSessionId={scrollToSessionId}
        />
      </>
    );
  }
);

DeviceManagement.displayName = "DeviceManagement";

export { DeviceManagement };
