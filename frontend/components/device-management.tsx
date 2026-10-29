"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  useMemo,
  useDeferredValue,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff } from "lucide-react";

// Hooks
import { useDeviceActions } from "@/hooks/device-management/useDeviceActions";
import { useUserPreferences } from "@/hooks/device-management/useUserPreferences";
import { useTimeRules } from "@/hooks/device-management/useTimeRules";
import { useToast } from "@/hooks/use-toast";

// Types
import { UserDevice, UserPreference, UserTimeRule, AppSetting } from "@/types";
import {
  devicePolicyBadges,
  isPlexampDevice,
  isWaitingDevice,
} from "@/lib/device-policies";
import { formatMinutes } from "@/lib/duration";

// API
import { apiClient } from "@/lib/api";

// Components
import {
  UserDetail,
  type DeviceFocus,
} from "@/components/device-management/UserDetail";
import {
  UserList,
  matchesFilter,
  type UserFilter,
  type UserSort,
} from "@/components/device-management/UserList";
import {
  ApprovalQueue,
  type QueueItem,
} from "@/components/device-management/ApprovalQueue";
import type { UserDeviceGroup } from "@/components/device-management/user-group";
import { cn } from "@/lib/utils";
import { DeviceDetailsModal } from "@/components/device-management/DeviceDetailsModal";
import { TemporaryAccessModal } from "@/components/device-management/TemporaryAccessModal";
import { ConfirmationModal } from "@/components/device-management/ConfirmationModal";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";
import { TimeRuleModal } from "@/components/device-management/TimeRuleModal";
import { UserAvatar } from "@/components/device-management/SharedComponents";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";

const DEVICE_LOOKUP_ATTEMPTS = 20;
const DEVICE_LOOKUP_RETRY_MS = 100;

interface DeviceManagementProps {
  devicesData?: {
    all: UserDevice[];
    pending: UserDevice[];
    approved: UserDevice[];
    processed: UserDevice[];
  };
  usersData?: UserPreference[];
  settingsData?: AppSetting[];
  onRefresh?: () => void | Promise<void>;
  navigationTarget?: {
    userId: string;
    deviceIdentifier: string;
  } | null;
  onNavigationComplete?: () => void;
  selectedUserId?: string | null;
  onSelectUser?: (userId: string | null) => void;
}

interface ConfirmActionData {
  device: UserDevice;
  action: "approve" | "reject" | "delete" | "toggle" | "removeTemporaryAccess";
  title: string;
  description: string;
}

const CONFIRM_COPY = {
  approve: {
    title: "Approve device",
    description: "This device will be able to stream from your Plex server.",
  },
  reject: {
    title: "Reject device",
    description:
      "This device will be blocked from streaming from your Plex server.",
  },
  removeTemporaryAccess: {
    title: "Remove temporary access",
    description:
      "The grant ends now instead of when it was due to expire. This device goes straight back under the user's usual policies, so it stops streaming if they block it.",
  },
  delete: {
    title: "Delete device",
    description:
      "The record is removed for good. The device reappears as pending the next time it connects, and follows this user's New devices rule until then.",
  },
};

const DeviceManagement = memo(
  ({
    devicesData,
    usersData,
    settingsData,
    onRefresh,
    navigationTarget,
    onNavigationComplete,
    selectedUserId: controlledSelectedUserId,
    onSelectUser,
  }: DeviceManagementProps) => {
    // State management
    const [userGroups, setUserGroups] = useState<UserDeviceGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [deviceFocus, setDeviceFocus] = useState<DeviceFocus | null>(null);
    const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(
      null,
    );
    const [localSelectedUserId, setLocalSelectedUserId] = useState<
      string | null
    >(null);
    const selectedUserId =
      controlledSelectedUserId !== undefined
        ? controlledSelectedUserId
        : localSelectedUserId;
    const selectUser = (userId: string | null) => {
      setDeviceFocus(null);
      if (onSelectUser) {
        onSelectUser(userId);
      } else {
        setLocalSelectedUserId(userId);
      }
    };
    const [filter, setFilter] = useState<UserFilter>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const [editingDevice, setEditingDevice] = useState<number | null>(null);
    const [newDeviceName, setNewDeviceName] = useState("");
    const [temporaryAccessUser, setTemporaryAccessUser] = useState<{
      userId: string;
      username?: string;
    } | null>(null);
    const [hiddenUsersModalOpen, setHiddenUsersModalOpen] = useState(false);
    const [hiddenUsers, setHiddenUsers] = useState<UserPreference[]>([]);
    const [userHistoryModalOpen, setUserHistoryModalOpen] = useState(false);
    const [selectedHistoryUser, setSelectedHistoryUser] = useState<{
      userId: string;
      username?: string;
    } | null>(null);
    const [scrollToSessionId, setScrollToSessionId] = useState<number | null>(
      null,
    );
    const [timeRuleModalOpen, setTimeRuleModalOpen] = useState(false);
    const [selectedTimeRuleUser, setSelectedTimeRuleUser] = useState<{
      userId: string;
      username?: string;
      deviceIdentifier?: string;
    } | null>(null);
    const [userTimeRules, setUserTimeRules] = useState<
      Record<string, UserTimeRule[]>
    >({});
    const loadingTimeRulesRef = useRef(false);
    const [updatingUserPreference, setUpdatingUserPreference] = useState<
      string | null
    >(null);

    // Confirmation dialog states
    const [confirmAction, setConfirmAction] =
      useState<ConfirmActionData | null>(null);
    const [hideUserConfirmation, setHideUserConfirmation] = useState<{
      userId: string;
      username: string;
      isCurrentlyHidden: boolean;
    } | null>(null);

    // Custom hooks
    const deviceActions = useDeviceActions();
    const userPreferences = useUserPreferences();
    const { getAllTimeRules, fetchAllTimeRules } = useTimeRules();
    const timeRulesApiRef = useRef({ getAllTimeRules, fetchAllTimeRules });
    const selectedUserIdRef = useRef(selectedUserId);
    const selectUserRef = useRef(selectUser);
    const { toast } = useToast();

    useEffect(() => {
      timeRulesApiRef.current = { getAllTimeRules, fetchAllTimeRules };
    });

    useEffect(() => {
      selectedUserIdRef.current = selectedUserId;
      selectUserRef.current = selectUser;
    });

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

    const [sortBy, setSortBy] = useState<UserSort>(
      () => getStoredValue(USER_SORT_BY_KEY, "pendingCount") as UserSort,
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
      () => getStoredValue(USER_SORT_ORDER_KEY, "desc") as "asc" | "desc",
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

          // Update counts (exclude Plexamp from pending count)
          switch (device.status) {
            case "pending":
              // Only count pending devices that are not Plexamp
              if (!isPlexampDevice(device)) {
                group.pendingCount++;
              }
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
              // Helper function to identify Plex Amp devices
              // Plexamp devices always go last
              const aIsPlexamp = isPlexampDevice(a);
              const bIsPlexamp = isPlexampDevice(b);

              if (aIsPlexamp && !bIsPlexamp) return 1; // a goes after b
              if (!aIsPlexamp && bIsPlexamp) return -1; // a goes before b
              if (aIsPlexamp && bIsPlexamp) {
                // Both are Plexamp, sort by lastSeen
                return (
                  new Date(b.lastSeen).getTime() -
                  new Date(a.lastSeen).getTime()
                );
              }

              // For non-Plexamp devices, sort by status (pending first, then rejected, then approved)
              if (a.status !== b.status) {
                const statusOrder = { pending: 0, rejected: 1, approved: 2 };
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

    // Load time policy status for all users when user groups change
    useEffect(() => {
      const loadTimePolicyStatus = async () => {
        if (userGroups.length > 0 && !loadingTimeRulesRef.current) {
          loadingTimeRulesRef.current = true;
          const userIds = userGroups.map((group) => group.user.userId);
          const { fetchAllTimeRules, getAllTimeRules } =
            timeRulesApiRef.current;

          try {
            // Fetch all time rules at once (cached globally)
            await fetchAllTimeRules(userIds);

            // Keep the full rules so each device can report its own schedule
            const ruleMap: Record<string, UserTimeRule[]> = {};
            for (const userId of userIds) {
              ruleMap[userId] = await getAllTimeRules(userId);
            }
            setUserTimeRules(ruleMap);
          } catch (error) {
            console.error("Error loading time rule status:", error);
          } finally {
            loadingTimeRulesRef.current = false;
          }
        }
      };

      void loadTimePolicyStatus();
    }, [userGroups]);

    const focusDevice = useCallback(
      (userId: string, deviceIdentifier: string, onDone?: () => void) => {
        const wasSelected = selectedUserIdRef.current === userId;
        if (!wasSelected) {
          selectUserRef.current(userId);
        }
        setDeviceFocus({ deviceIdentifier });

        const delay = wasSelected ? 100 : 400;

        const highlightDevice = (attempt: number) => {
          const deviceElement = Array.from(
            document.querySelectorAll<HTMLElement>("[data-device-identifier]"),
          ).find(
            (element) => element.dataset.deviceIdentifier === deviceIdentifier,
          );
          if (!deviceElement) {
            if (attempt < DEVICE_LOOKUP_ATTEMPTS) {
              setTimeout(
                () => highlightDevice(attempt + 1),
                DEVICE_LOOKUP_RETRY_MS,
              );
            } else {
              onDone?.();
            }
            return;
          }

          deviceElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });

          setTimeout(() => {
            deviceElement.classList.add(...HIGHLIGHT_CLASSES);
            setTimeout(() => {
              deviceElement.classList.remove(...HIGHLIGHT_CLASSES);
              onDone?.();
            }, 1500);
          }, 200);
        };

        setTimeout(() => highlightDevice(1), delay);
      },
      [],
    );

    useEffect(() => {
      if (navigationTarget && userGroups.length > 0) {
        focusDevice(
          navigationTarget.userId,
          navigationTarget.deviceIdentifier,
          onNavigationComplete,
        );
      }
    }, [
      navigationTarget,
      userGroups.length,
      onNavigationComplete,
      focusDevice,
    ]);

    const handleRefresh = async () => {
      if (onRefresh) {
        setRefreshing(true);
        try {
          await onRefresh();
        } catch (error) {
          console.error("Failed to refresh:", error);
        } finally {
          setRefreshing(false);
        }
      }
    };

    const visibleGroups = useMemo(
      () => userGroups.filter((group) => matchesFilter(group, filter)),
      [userGroups, filter],
    );

    const queueItems = useMemo<QueueItem[]>(
      () =>
        userGroups
          .flatMap((group) =>
            group.devices
              .filter(isWaitingDevice)
              .map((device) => ({ device, group })),
          )
          .sort(
            (a, b) =>
              new Date(b.device.lastSeen).getTime() -
              new Date(a.device.lastSeen).getTime(),
          ),
      [userGroups],
    );

    const selectedGroup = selectedUserId
      ? userGroups.find((group) => group.user.userId === selectedUserId)
      : undefined;

    // Filter and sort user groups
    const filteredAndSortedGroups = useMemo(() => {
      return visibleGroups
        .filter((group) => {
          // Apply search filter
          if (deferredSearchTerm.trim()) {
            const searchLower = deferredSearchTerm.toLowerCase();
            const username = (
              group.user.username || group.user.userId
            ).toLowerCase();
            const hasMatchingDevice = group.devices.some((device) => {
              const deviceName = (
                device.deviceName ||
                device.deviceIdentifier ||
                ""
              ).toLowerCase();
              const devicePlatform = (
                device.devicePlatform || ""
              ).toLowerCase();
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
          let valueA: string | number;
          let valueB: string | number;

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
                0,
              );
              valueB = b.devices.reduce(
                (total, device) => total + (device.sessionCount || 0),
                0,
              );
              break;
            default:
              valueA = (a.user.username || a.user.userId).toLowerCase();
              valueB = (b.user.username || b.user.userId).toLowerCase();
              break;
          }

          // For numeric values, use numeric comparison
          if (typeof valueA === "number" && typeof valueB === "number") {
            const comparison = valueA - valueB;
            return sortOrder === "asc" ? comparison : -comparison;
          }

          // For string values, use localeCompare
          const comparison = String(valueA).localeCompare(String(valueB));
          return sortOrder === "asc" ? comparison : -comparison;
        });
    }, [visibleGroups, deferredSearchTerm, sortBy, sortOrder]);

    // User preference update handler
    const handleUpdateUserPreference = async (
      userId: string,
      defaultBlock: boolean | null,
    ) => {
      setUpdatingUserPreference(userId);
      try {
        const success = await userPreferences.updateUserPreference(
          userId,
          defaultBlock,
        );
        if (success) {
          // Refresh data without clearing time rule status to prevent "Scheduled" tag flickering
          if (onRefresh) {
            await onRefresh();
          }
          toast({
            title: "Default device policy updated",
            description:
              "New devices from this user will follow the policy you picked",
            variant: "success",
          });
        } else {
          toast({
            title: "Update failed",
            description: "Failed to update the New devices rule",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error updating user preference:", error);
        toast({
          title: "Update failed",
          description: "Failed to update the New devices rule",
          variant: "destructive",
        });
      } finally {
        setUpdatingUserPreference(null);
      }
    };

    // User IP policy update handler
    const handleUpdateUserIPPolicy = async (
      userId: string,
      updates: Partial<UserPreference>,
    ) => {
      const success = await userPreferences.updateUserIPPolicy(userId, updates);
      if (success) {
        void handleRefresh();
        toast({
          title: "IP access updated",
          description:
            "The new network and IP rules apply to every device this user owns",
          variant: "success",
        });
      } else {
        toast({
          title: "Update failed",
          description: "Failed to update the IP access policies",
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

        // If hiding a user, show confirmation modal first
        if (!isCurrentlyHidden) {
          setHideUserConfirmation({ userId, username, isCurrentlyHidden });
          return;
        }

        // Directly show user without confirmation
        await apiClient.toggleUserVisibility(userId);

        if (isCurrentlyHidden) {
          // User was hidden, now showing
          toast({
            title: "User shown",
            description: `${username} is back in the main user list`,
            variant: "success",
          });
        } else {
          // User was visible, now hiding
          toast({
            title: "User hidden",
            description: `${username} is now under "Hidden users" at the bottom of the user list. Their policies still apply.`,
            variant: "success",
          });
        }

        void handleRefresh();
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

    // Confirm hiding user
    const confirmHideUser = async () => {
      if (!hideUserConfirmation) return;

      try {
        const { userId, username } = hideUserConfirmation;
        await apiClient.toggleUserVisibility(userId);
        if (selectedUserId === userId) selectUser(null);

        toast({
          title: "User hidden",
          description: `${username} is now under "Hidden users" at the bottom of the user list. Their policies still apply.`,
          variant: "success",
        });

        void handleRefresh();
        if (hiddenUsersModalOpen) {
          await loadHiddenUsers();
        }
      } catch (error) {
        console.error("Failed to hide user:", error);
        toast({
          title: "Error",
          description: "Failed to hide user",
          variant: "destructive",
        });
      } finally {
        setHideUserConfirmation(null);
      }
    };

    const handleShowHistory = (userId: string) => {
      // Find the username for this userId
      const userGroup = userGroups.find(
        (group) => group.user.userId === userId,
      );
      const username =
        userGroup?.user.username || userGroup?.user.preference?.username;

      setSelectedHistoryUser({ userId, username });
      setUserHistoryModalOpen(true);
    };

    const handleNavigateToDeviceFromHistory = (
      userId: string,
      deviceIdentifier: string,
    ) => {
      const device = userGroups
        .find((group) => group.user.userId === userId)
        ?.devices.find((d) => d.deviceIdentifier === deviceIdentifier);

      if (device) {
        focusDevice(userId, deviceIdentifier);
        return;
      }

      selectUser(userId);
      setDeviceFocus({ deviceIdentifier });
      toast({
        title: "Device not found",
        description:
          "The device may have been removed or is no longer available.",
        variant: "destructive",
      });
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
          setTimeout(() => void handleRefresh(), 100);
          toast({
            title: "Device approved",
            description: "This device can now stream from your Plex server",
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
          setTimeout(() => void handleRefresh(), 100);
          toast({
            title: "Device rejected",
            description: "This device is now blocked from streaming",
            variant: "success",
          });
        }
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    };

    const handleSetPending = async (deviceId: number): Promise<boolean> => {
      try {
        setActionLoading(deviceId);
        const success = await deviceActions.setPendingDevice(deviceId);
        if (success) {
          setTimeout(() => void handleRefresh(), 100);
          toast({
            title: "Device set to pending",
            description:
              "This device follows this user's New devices rule until you approve or reject it",
            variant: "success",
          });
          setSelectedDevice(null);
        }
        return success;
      } finally {
        setActionLoading(null);
      }
    };

    const handleDelete = async (deviceId: number) => {
      try {
        setActionLoading(deviceId);
        const success = await deviceActions.deleteDevice(deviceId);
        if (success) {
          setTimeout(() => void handleRefresh(), 100);
          toast({
            title: "Device deleted",
            description:
              "The record is gone. The device reappears as pending the next time it connects.",
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

          setTimeout(() => void handleRefresh(), 100);
          setEditingDevice(null);
          setNewDeviceName("");
        }
      } finally {
        setActionLoading(null);
      }
    };

    const handleDeviceUpdate = (updated: UserDevice) => {
      setUserGroups((groups) =>
        groups.map((group) =>
          group.user.userId === updated.userId
            ? {
                ...group,
                devices: group.devices.map((device) =>
                  device.id === updated.id ? updated : device,
                ),
              }
            : group,
        ),
      );
      setSelectedDevice((current) =>
        current?.id === updated.id ? updated : current,
      );
    };

    const startEditing = (device: UserDevice) => {
      setEditingDevice(device.id);
      setNewDeviceName(device.deviceName || "");
    };

    const cancelEditing = () => {
      setEditingDevice(null);
      setNewDeviceName("");
    };

    const handleGrantTemporaryAccess = async (
      deviceIds: number[],
      durationMinutes: number,
      bypassPolicies?: boolean,
    ) => {
      try {
        if (deviceIds.length === 1) {
          // Use single device endpoint for single device
          setActionLoading(deviceIds[0]);
          const success = await deviceActions.grantTemporaryAccess(
            deviceIds[0],
            durationMinutes,
            bypassPolicies,
          );
          if (!success) {
            toast({
              title: "Error",
              description: "Failed to grant temporary access",
              variant: "destructive",
            });
            return;
          }
        } else {
          // Use batch endpoint for multiple devices
          setActionLoading(deviceIds[0]); // Set loading indicator
          const result = await deviceActions.grantBatchTemporaryAccess(
            deviceIds,
            durationMinutes,
            bypassPolicies,
          );
          if (!result.success) {
            toast({
              title: "Error",
              description: "Failed to grant temporary access to these devices",
              variant: "destructive",
            });
            return;
          }

          // Check if any devices failed
          const batchResults = result.results as
            { success: boolean }[] | undefined;
          const failedDevices = batchResults?.filter((r) => !r.success) || [];
          if (failedDevices.length > 0) {
            toast({
              title: "Some devices were not granted access",
              description: `${deviceIds.length - failedDevices.length} of ${deviceIds.length} devices were granted temporary access. Try the remaining ${failedDevices.length} again.`,
              variant: "destructive",
            });
          }
        }

        setTimeout(() => void handleRefresh(), 100);
        setTemporaryAccessUser(null);
        toast({
          title: "Temporary access granted",
          description: `Temporary access granted to ${deviceIds.length} device${deviceIds.length > 1 ? "s" : ""} for ${formatMinutes(durationMinutes)}`,
          variant: "success",
        });
      } finally {
        setActionLoading(null);
      }
    };

    const handleGrantUserTemporaryAccess = (userId: string) => {
      const userGroup = userGroups.find(
        (group) => group.user.userId === userId,
      );
      if (userGroup) {
        setTemporaryAccessUser({
          userId: userGroup.user.userId,
          username: userGroup.user.username,
        });
      }
    };

    const handleRemoveTemporaryAccess = async (deviceId: number) => {
      try {
        setActionLoading(deviceId);
        const success = await deviceActions.revokeTemporaryAccess(deviceId);
        if (success) {
          setTimeout(() => void handleRefresh(), 100);
          toast({
            title: "Temporary access removed",
            description:
              "The grant ended early. This device is back under the user's usual policies.",
            variant: "success",
          });
        }
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    };

    const handleShowTimePolicy = (
      userId: string,
      deviceIdentifier?: string,
    ) => {
      const userGroup = userGroups.find(
        (group) => group.user.userId === userId,
      );
      if (userGroup) {
        setSelectedTimeRuleUser({
          userId: userGroup.user.userId,
          username: userGroup.user.username,
          deviceIdentifier,
        });
        setTimeRuleModalOpen(true);
      }
    };

    const handleTimeRuleModalClose = async () => {
      setTimeRuleModalOpen(false);
      setSelectedTimeRuleUser(null);
      // Refresh time policy status for all users after policy changes
      if (userGroups.length > 0 && !loadingTimeRulesRef.current) {
        loadingTimeRulesRef.current = true;
        const userIds = userGroups.map((group) => group.user.userId);

        try {
          // Refresh all time rules (cached globally)
          await fetchAllTimeRules(userIds);

          // Keep the full rules so each device can report its own schedule
          const ruleMap: Record<string, UserTimeRule[]> = {};
          for (const userId of userIds) {
            ruleMap[userId] = await getAllTimeRules(userId);
          }
          setUserTimeRules(ruleMap);
        } catch (error) {
          console.error("Error refreshing time rule status:", error);
        } finally {
          loadingTimeRulesRef.current = false;
        }
      }
    };

    // Only devices Guardian is currently blocking can be granted temporary access
    const canGrantTemporaryAccess = (device: UserDevice): boolean => {
      // Plexamp devices are exempt from every policy, so they never need a grant
      if (isPlexampDevice(device)) {
        return false;
      }

      // Only show for pending or rejected devices
      if (device.status !== "pending" && device.status !== "rejected") {
        return false;
      }

      // A rejected device is always blocked
      if (device.status === "rejected") {
        return true;
      }

      // For pending devices, check user and global policies
      const userPreference = usersData?.find((u) => u.userId === device.userId);

      // A pending device is only blocked when the effective default policy blocks
      if (userPreference && userPreference.defaultBlock === false) {
        return false;
      }

      // If user has no preference (defaultBlock = null), check global setting for pending devices
      if (!userPreference || userPreference.defaultBlock === null) {
        // Find global default block setting
        const globalDefaultBlock = settingsData?.find(
          (s) => s.key === "PLEX_GUARD_DEFAULT_BLOCK",
        );

        // The global default allows, so this pending device is already streaming
        if (globalDefaultBlock && globalDefaultBlock.value === "false") {
          return false;
        }
      }

      return true;
    };

    // Confirmation dialog handlers
    const showApproveConfirmation = (device: UserDevice) => {
      setConfirmAction({ device, action: "approve", ...CONFIRM_COPY.approve });
    };

    const showRejectConfirmation = (device: UserDevice) => {
      setConfirmAction({ device, action: "reject", ...CONFIRM_COPY.reject });
    };

    const showDeleteConfirmation = (device: UserDevice) => {
      setConfirmAction({ device, action: "delete", ...CONFIRM_COPY.delete });
    };

    const showRemoveTemporaryAccessConfirmation = (device: UserDevice) => {
      setConfirmAction({
        device,
        action: "removeTemporaryAccess",
        ...CONFIRM_COPY.removeTemporaryAccess,
      });
    };

    const showToggleConfirmation = (device: UserDevice) => {
      setConfirmAction({
        device,
        action: "toggle",
        ...CONFIRM_COPY[device.status === "approved" ? "reject" : "approve"],
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
        case "removeTemporaryAccess":
          await handleRemoveTemporaryAccess(confirmAction.device.id);
          break;
      }
    };

    const totalPending = queueItems.length;

    return (
      <>
        <h1 className="sr-only">Users</h1>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(300px,360px)_1fr]">
          <UserList
            className={cn(
              "lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)]",
              selectedUserId && "hidden lg:flex",
            )}
            groups={filteredAndSortedGroups}
            allGroups={userGroups}
            loading={loading}
            selectedUserId={selectedUserId}
            onSelect={selectUser}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filter={filter}
            onFilterChange={setFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onShowHidden={() => void openHiddenUsersModal()}
            pendingCount={totalPending}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />

          <div
            className={cn(
              "min-w-0",
              !selectedUserId && "order-first lg:order-none",
            )}
          >
            {selectedGroup ? (
              <UserDetail
                key={selectedGroup.user.userId}
                group={selectedGroup}
                actionLoading={actionLoading}
                timeRules={userTimeRules[selectedGroup.user.userId]}
                deviceFocus={deviceFocus}
                updatingUserPreference={updatingUserPreference}
                onBack={() => selectUser(null)}
                onUpdateUserPreference={(userId, defaultBlock) =>
                  void handleUpdateUserPreference(userId, defaultBlock)
                }
                onUpdateUserIPPolicy={(userId, updates) =>
                  void handleUpdateUserIPPolicy(userId, updates)
                }
                onToggleUserVisibility={(userId) =>
                  void handleToggleUserVisibility(userId)
                }
                onShowHistory={handleShowHistory}
                onGrantUserTemporaryAccess={handleGrantUserTemporaryAccess}
                onShowTimePolicy={handleShowTimePolicy}
                onApprove={showApproveConfirmation}
                onReject={showRejectConfirmation}
                onDelete={showDeleteConfirmation}
                onToggleApproval={showToggleConfirmation}
                onRemoveTemporaryAccess={showRemoveTemporaryAccessConfirmation}
                onShowDetails={setSelectedDevice}
                onDeviceUpdate={handleDeviceUpdate}
              />
            ) : selectedUserId && !loading ? (
              <div className="space-y-3 rounded-2xl border border-dashed px-6 py-16 text-center">
                <p className="text-[15px] font-semibold text-foreground">
                  This user is not in the list
                </p>
                <p className="text-sm text-muted-foreground">
                  They may be hidden or no longer have any devices.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectUser(null)}
                >
                  Back to all users
                </Button>
              </div>
            ) : loading && userGroups.length === 0 ? (
              <div className="h-64 animate-pulse rounded-2xl border bg-card" />
            ) : (
              <>
                <ApprovalQueue
                  className="hidden lg:block"
                  items={queueItems}
                  actionLoading={actionLoading}
                  onApprove={showApproveConfirmation}
                  onReject={showRejectConfirmation}
                  onOpenDevice={focusDevice}
                />
                <ApprovalQueue
                  compact
                  className="lg:hidden"
                  items={queueItems}
                  actionLoading={actionLoading}
                  onApprove={showApproveConfirmation}
                  onReject={showRejectConfirmation}
                  onOpenDevice={focusDevice}
                />
              </>
            )}
          </div>
        </div>

        <DeviceDetailsModal
          device={selectedDevice}
          isOpen={!!selectedDevice}
          onClose={() => setSelectedDevice(null)}
          editingDevice={editingDevice}
          newDeviceName={newDeviceName}
          actionLoading={actionLoading}
          onEdit={startEditing}
          onCancelEdit={cancelEditing}
          onRename={(deviceId, newName) => void handleRename(deviceId, newName)}
          onNewDeviceNameChange={setNewDeviceName}
          onSetPending={handleSetPending}
          onDeviceUpdate={handleDeviceUpdate}
          settingsData={settingsData}
          policies={
            selectedDevice
              ? devicePolicyBadges(
                  selectedDevice,
                  usersData?.find((u) => u.userId === selectedDevice.userId),
                  userTimeRules[selectedDevice.userId],
                )
              : []
          }
        />

        <TemporaryAccessModal
          user={temporaryAccessUser}
          userDevices={
            temporaryAccessUser
              ? userGroups.find(
                  (group) => group.user.userId === temporaryAccessUser.userId,
                )?.devices || []
              : []
          }
          isOpen={!!temporaryAccessUser}
          onClose={() => setTemporaryAccessUser(null)}
          onGrantAccess={(deviceIds, durationMinutes, bypassPolicies) =>
            void handleGrantTemporaryAccess(
              deviceIds,
              durationMinutes,
              bypassPolicies,
            )
          }
          actionLoading={actionLoading}
          canGrantTemporaryAccess={canGrantTemporaryAccess}
        />

        {/* Confirmation Modal */}
        <ConfirmationModal
          confirmAction={confirmAction}
          actionLoading={actionLoading}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setConfirmAction(null)}
        />

        <Dialog
          open={hiddenUsersModalOpen}
          onOpenChange={setHiddenUsersModalOpen}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <EyeOff className="w-5 h-5 mr-2" />
                Hidden users
              </DialogTitle>
              <DialogDescription>
                These users are hidden from the main list. Click
                &quot;Show&quot; to make them visible again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {hiddenUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                      onClick={() =>
                        void handleToggleUserVisibility(user.userId)
                      }
                      className="ml-4"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Show
                    </Button>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setHiddenUsersModalOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
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

        <TimeRuleModal
          isOpen={timeRuleModalOpen}
          onClose={() => void handleTimeRuleModalClose()}
          userId={selectedTimeRuleUser?.userId || ""}
          username={selectedTimeRuleUser?.username || "Unknown user"}
          deviceIdentifier={selectedTimeRuleUser?.deviceIdentifier}
        />

        <Dialog
          open={!!hideUserConfirmation}
          onOpenChange={(open) => !open && setHideUserConfirmation(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <EyeOff className="w-5 h-5 mr-2" />
                Hide user?
              </DialogTitle>
              <DialogDescription className="pt-2">
                Are you sure you want to hide{" "}
                <span className="font-semibold text-foreground">
                  {hideUserConfirmation?.username}
                </span>{" "}
                from the user list?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="bg-muted/50 p-3 rounded-md text-sm">
                <p className="text-muted-foreground">
                  You can show them again from &quot;Hidden users&quot; at the
                  bottom of the user list.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setHideUserConfirmation(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void confirmHideUser()}
                className="w-full sm:w-auto"
              >
                <EyeOff className="w-4 h-4 mr-2" />
                Hide user
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

DeviceManagement.displayName = "DeviceManagement";

export { DeviceManagement };
