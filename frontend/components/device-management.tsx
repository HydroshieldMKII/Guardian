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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import { useDeviceDecisions } from "@/hooks/device-management/useDeviceDecisions";
import { useUserPreferences } from "@/hooks/device-management/useUserPreferences";
import { useTimeRulesForUsers } from "@/hooks/device-management/useTimeRules";
import { useToast } from "@/hooks/use-toast";
import { useStoredChoice } from "@/hooks/use-stored-choice";

import { UserDevice, UserPreference, AppSetting } from "@/types";
import type { TimeRulesByUser } from "@/lib/time-rules-api";
import {
  canGrantTemporaryAccess,
  devicePolicyBadges,
} from "@/lib/device-policies";

import { apiClient } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

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
import { ApprovalQueue } from "@/components/device-management/ApprovalQueue";
import {
  groupDevicesByUser,
  matchesSearch,
  sortGroups,
  waitingQueue,
  withPreferenceChanges,
  type UserDeviceGroup,
} from "@/components/device-management/user-group";
import { cn } from "@/lib/utils";
import { DeviceDetailsModal } from "@/components/device-management/DeviceDetailsModal";
import { TemporaryAccessModal } from "@/components/device-management/TemporaryAccessModal";
import { ConfirmationModal } from "@/components/device-management/ConfirmationModal";
import { UserHistoryModal } from "@/components/device-management/UserHistoryModal";
import { TimeRuleModal } from "@/components/device-management/TimeRuleModal";
import {
  HiddenUsersDialog,
  HideUserDialog,
} from "@/components/device-management/HiddenUsersDialogs";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";

const NO_TIME_RULES: TimeRulesByUser = {};
const NO_USERS: UserPreference[] = [];
const DEVICE_LOOKUP_ATTEMPTS = 20;
const DEVICE_LOOKUP_RETRY_MS = 100;
const USER_SORT_BY_KEY = "guardian-unified-sort-by";
const USER_SORT_ORDER_KEY = "guardian-unified-sort-order";

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
    const [userGroups, setUserGroups] = useState<UserDeviceGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
    const [updatingUserPreference, setUpdatingUserPreference] = useState<
      string | null
    >(null);

    const [hideUserConfirmation, setHideUserConfirmation] = useState<{
      userId: string;
      username: string;
      isCurrentlyHidden: boolean;
    } | null>(null);

    const userPreferences = useUserPreferences();
    const { data: userTimeRules = NO_TIME_RULES } = useTimeRulesForUsers(
      userGroups.map((group) => group.user.userId),
    );
    const selectedUserIdRef = useRef(selectedUserId);
    const selectUserRef = useRef(selectUser);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: hiddenUsers = NO_USERS, isLoading: loadingHiddenUsers } =
      useQuery({
        queryKey: queryKeys.hiddenUsers,
        queryFn: () => apiClient.getHiddenUsers<UserPreference[]>(),
        enabled: hiddenUsersModalOpen,
      });
    const refreshHiddenUsers = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.hiddenUsers });

    useEffect(() => {
      selectedUserIdRef.current = selectedUserId;
      selectUserRef.current = selectUser;
    });

    const [sortBy, setSortBy] = useStoredChoice<UserSort>(
      USER_SORT_BY_KEY,
      "pendingCount",
    );
    const [sortOrder, setSortOrder] = useStoredChoice<"asc" | "desc">(
      USER_SORT_ORDER_KEY,
      "desc",
    );

    useEffect(() => {
      if (devicesData && usersData) {
        setUserGroups(groupDevicesByUser(devicesData.all, usersData));
        setLoading(false);
      }
    }, [devicesData, usersData]);

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

    const decisions = useDeviceDecisions({
      refresh: handleRefresh,
      onPendingSet: () => setSelectedDevice(null),
      onRenamed: (deviceId, newName) => {
        setSelectedDevice((current) =>
          current?.id === deviceId
            ? { ...current, deviceName: newName }
            : current,
        );
        setEditingDevice(null);
        setNewDeviceName("");
      },
      onAccessGranted: () => setTemporaryAccessUser(null),
    });
    const { actionLoading } = decisions;

    const visibleGroups = useMemo(
      () => userGroups.filter((group) => matchesFilter(group, filter)),
      [userGroups, filter],
    );

    const queueItems = useMemo(() => waitingQueue(userGroups), [userGroups]);

    const selectedGroup = selectedUserId
      ? userGroups.find((group) => group.user.userId === selectedUserId)
      : undefined;

    const filteredAndSortedGroups = useMemo(
      () =>
        sortGroups(
          visibleGroups.filter((group) =>
            matchesSearch(group, deferredSearchTerm),
          ),
          sortBy,
          sortOrder,
        ),
      [visibleGroups, deferredSearchTerm, sortBy, sortOrder],
    );

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
          await handleRefresh();
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

    const handleToggleUserVisibility = async (userId: string) => {
      try {
        const user =
          usersData?.find((u) => u.userId === userId) ||
          hiddenUsers.find((u) => u.userId === userId);
        const isCurrentlyHidden = user?.hidden || false;
        const username = user?.username || userId;

        if (!isCurrentlyHidden) {
          setHideUserConfirmation({ userId, username, isCurrentlyHidden });
          return;
        }

        await apiClient.toggleUserVisibility(userId);

        if (isCurrentlyHidden) {
          toast({
            title: "User shown",
            description: `${username} is back in the main user list`,
            variant: "success",
          });
        } else {
          toast({
            title: "User hidden",
            description: `${username} is now under "Hidden users" at the bottom of the user list. Their policies still apply.`,
            variant: "success",
          });
        }

        void handleRefresh();
        await refreshHiddenUsers();
      } catch (error) {
        console.error("Failed to toggle user visibility:", error);
        toast({
          title: "Error",
          description: "Failed to update user visibility",
          variant: "destructive",
        });
      }
    };

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
        await refreshHiddenUsers();
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

    const handleUserPreferenceChange = (
      userId: string,
      changes: Partial<UserPreference>,
    ) => {
      setUserGroups((groups) => withPreferenceChanges(groups, userId, changes));
      void handleRefresh();
    };

    const startEditing = (device: UserDevice) => {
      setEditingDevice(device.id);
      setNewDeviceName(device.deviceName || "");
    };

    const cancelEditing = () => {
      setEditingDevice(null);
      setNewDeviceName("");
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

    const handleTimeRuleModalClose = () => {
      setTimeRuleModalOpen(false);
      setSelectedTimeRuleUser(null);
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
            onShowHidden={() => setHiddenUsersModalOpen(true)}
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
                onUserPreferenceChange={handleUserPreferenceChange}
                onToggleUserVisibility={(userId) =>
                  void handleToggleUserVisibility(userId)
                }
                onShowHistory={handleShowHistory}
                onGrantUserTemporaryAccess={handleGrantUserTemporaryAccess}
                onShowTimePolicy={handleShowTimePolicy}
                onApprove={decisions.confirmApprove}
                onReject={decisions.confirmReject}
                onDelete={decisions.confirmDelete}
                onToggleApproval={decisions.confirmToggle}
                onRemoveTemporaryAccess={decisions.confirmRemoveTemporaryAccess}
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
                  onApprove={decisions.confirmApprove}
                  onReject={decisions.confirmReject}
                  onOpenDevice={focusDevice}
                />
                <ApprovalQueue
                  compact
                  className="lg:hidden"
                  items={queueItems}
                  actionLoading={actionLoading}
                  onApprove={decisions.confirmApprove}
                  onReject={decisions.confirmReject}
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
          onRename={(deviceId, newName) =>
            void decisions.rename(deviceId, newName)
          }
          onNewDeviceNameChange={setNewDeviceName}
          onSetPending={decisions.setPending}
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
            void decisions.grantTemporaryAccess(
              deviceIds,
              durationMinutes,
              bypassPolicies,
            )
          }
          actionLoading={actionLoading}
          canGrantTemporaryAccess={(device) =>
            canGrantTemporaryAccess(
              device,
              usersData?.find((u) => u.userId === device.userId),
              settingsData,
            )
          }
        />

        <ConfirmationModal
          confirmAction={decisions.confirmAction}
          actionLoading={actionLoading}
          onConfirm={() => void decisions.runConfirmedAction()}
          onCancel={decisions.cancelConfirmation}
        />

        <HiddenUsersDialog
          open={hiddenUsersModalOpen}
          onOpenChange={setHiddenUsersModalOpen}
          users={hiddenUsers}
          loading={loadingHiddenUsers}
          onShow={(userId) => void handleToggleUserVisibility(userId)}
        />

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
          onClose={handleTimeRuleModalClose}
          userId={selectedTimeRuleUser?.userId || ""}
          username={selectedTimeRuleUser?.username || "Unknown user"}
          deviceIdentifier={selectedTimeRuleUser?.deviceIdentifier}
        />

        <HideUserDialog
          username={hideUserConfirmation?.username ?? null}
          onCancel={() => setHideUserConfirmation(null)}
          onConfirm={() => void confirmHideUser()}
        />
      </>
    );
  },
);

DeviceManagement.displayName = "DeviceManagement";

export { DeviceManagement };
