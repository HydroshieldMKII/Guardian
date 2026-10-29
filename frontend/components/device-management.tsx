"use client";

import { useState, useEffect, memo, useMemo } from "react";

import { useDeviceDecisions } from "@/hooks/device-management/useDeviceDecisions";
import { useDeviceFocus } from "@/hooks/device-management/useDeviceFocus";
import { useDeviceRename } from "@/hooks/device-management/useDeviceRename";
import { useUserDialogs } from "@/hooks/device-management/useUserDialogs";
import { useUserListControls } from "@/hooks/device-management/useUserListControls";
import { useUserPolicyUpdates } from "@/hooks/device-management/useUserPolicyUpdates";
import { useUserVisibility } from "@/hooks/device-management/useUserVisibility";
import { useTimeRulesForUsers } from "@/hooks/device-management/useTimeRules";
import { useToast } from "@/hooks/use-toast";

import { UserDevice, UserPreference, AppSetting } from "@/types";
import type { TimeRulesByUser } from "@/lib/time-rules-api";

import { UserDetail } from "@/components/device-management/UserDetail";
import { UserList } from "@/components/device-management/UserList";
import { ApprovalQueue } from "@/components/device-management/ApprovalQueue";
import {
  groupDevicesByUser,
  waitingQueue,
  withPreferenceChanges,
  type UserDeviceGroup,
} from "@/components/device-management/user-group";
import { cn } from "@/lib/utils";
import { DeviceManagementDialogs } from "@/components/device-management/DeviceManagementDialogs";
import { MissingUserNotice } from "@/components/device-management/MissingUserNotice";

const NO_TIME_RULES: TimeRulesByUser = {};

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
    const commitSelection = (userId: string | null) => {
      if (onSelectUser) {
        onSelectUser(userId);
      } else {
        setLocalSelectedUserId(userId);
      }
    };
    const { deviceFocus, setDeviceFocus, focusDevice } = useDeviceFocus(
      selectedUserId,
      commitSelection,
    );
    const selectUser = (userId: string | null) => {
      setDeviceFocus(null);
      commitSelection(userId);
    };
    const listControls = useUserListControls(userGroups);
    const rename = useDeviceRename();
    const dialogs = useUserDialogs(userGroups);
    const { data: userTimeRules = NO_TIME_RULES } = useTimeRulesForUsers(
      userGroups.map((group) => group.user.userId),
    );
    const { toast } = useToast();

    useEffect(() => {
      if (devicesData && usersData) {
        setUserGroups(groupDevicesByUser(devicesData.all, usersData));
        setLoading(false);
      }
    }, [devicesData, usersData]);

    const hasUsers = userGroups.length > 0;
    useEffect(() => {
      if (navigationTarget && hasUsers) {
        focusDevice(
          navigationTarget.userId,
          navigationTarget.deviceIdentifier,
          onNavigationComplete,
        );
      }
    }, [navigationTarget, hasUsers, onNavigationComplete, focusDevice]);

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
        rename.cancelEditing();
      },
      onAccessGranted: dialogs.closeTemporaryAccess,
    });
    const { actionLoading } = decisions;
    const policies = useUserPolicyUpdates(handleRefresh);
    const visibility = useUserVisibility({
      users: usersData,
      refresh: handleRefresh,
      onHidden: (userId) => {
        if (selectedUserId === userId) selectUser(null);
      },
    });

    const queueItems = useMemo(() => waitingQueue(userGroups), [userGroups]);

    const selectedGroup = selectedUserId
      ? userGroups.find((group) => group.user.userId === selectedUserId)
      : undefined;

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

    return (
      <>
        <h1 className="sr-only">Users</h1>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(300px,360px)_1fr]">
          <UserList
            className={cn(
              "lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)]",
              selectedUserId && "hidden lg:flex",
            )}
            {...listControls}
            allGroups={userGroups}
            loading={loading}
            selectedUserId={selectedUserId}
            onSelect={selectUser}
            onShowHidden={() => visibility.setHiddenUsersOpen(true)}
            pendingCount={queueItems.length}
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
                updatingUserPreference={policies.updatingUserId}
                onBack={() => selectUser(null)}
                onUpdateUserPreference={(userId, defaultBlock) =>
                  void policies.updateDefaultPolicy(userId, defaultBlock)
                }
                onUpdateUserIPPolicy={(userId, updates) =>
                  void policies.updateIPPolicy(userId, updates)
                }
                onUserPreferenceChange={handleUserPreferenceChange}
                onToggleUserVisibility={(userId) =>
                  void visibility.toggleVisibility(userId)
                }
                onShowHistory={dialogs.showHistory}
                onGrantUserTemporaryAccess={dialogs.showTemporaryAccess}
                onShowTimePolicy={dialogs.showTimeRules}
                onApprove={decisions.confirmApprove}
                onReject={decisions.confirmReject}
                onDelete={decisions.confirmDelete}
                onToggleApproval={decisions.confirmToggle}
                onRemoveTemporaryAccess={decisions.confirmRemoveTemporaryAccess}
                onShowDetails={setSelectedDevice}
                onDeviceUpdate={handleDeviceUpdate}
              />
            ) : selectedUserId && !loading ? (
              <MissingUserNotice onBack={() => selectUser(null)} />
            ) : loading && userGroups.length === 0 ? (
              <div className="h-64 animate-pulse rounded-2xl border bg-card" />
            ) : (
              <ApprovalQueue
                items={queueItems}
                actionLoading={actionLoading}
                onApprove={decisions.confirmApprove}
                onReject={decisions.confirmReject}
                onOpenDevice={focusDevice}
              />
            )}
          </div>
        </div>

        <DeviceManagementDialogs
          selectedDevice={selectedDevice}
          onCloseDevice={() => setSelectedDevice(null)}
          onDeviceUpdate={handleDeviceUpdate}
          onNavigateToDevice={handleNavigateToDeviceFromHistory}
          decisions={decisions}
          rename={rename}
          dialogs={dialogs}
          visibility={visibility}
          usersData={usersData}
          settingsData={settingsData}
          timeRules={userTimeRules}
        />
      </>
    );
  },
);

DeviceManagement.displayName = "DeviceManagement";

export { DeviceManagement };
