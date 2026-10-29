import type { useDeviceDecisions } from "@/hooks/device-management/useDeviceDecisions";
import type { useDeviceRename } from "@/hooks/device-management/useDeviceRename";
import type { useUserDialogs } from "@/hooks/device-management/useUserDialogs";
import type { useUserVisibility } from "@/hooks/device-management/useUserVisibility";
import {
  canGrantTemporaryAccess,
  devicePolicyBadges,
} from "@/lib/device-policies";
import type { TimeRulesByUser } from "@/lib/time-rules-api";
import type { AppSetting, UserDevice, UserPreference } from "@/types";
import { ConfirmationModal } from "./ConfirmationModal";
import { DeviceDetailsModal } from "./DeviceDetailsModal";
import { HiddenUsersDialog, HideUserDialog } from "./HiddenUsersDialogs";
import { TemporaryAccessModal } from "./TemporaryAccessModal";
import { TimeRuleModal } from "./TimeRuleModal";
import { UserHistoryModal } from "./UserHistoryModal";

interface DeviceManagementDialogsProps {
  selectedDevice: UserDevice | null;
  onCloseDevice: () => void;
  onDeviceUpdate: (device: UserDevice) => void;
  onNavigateToDevice: (userId: string, deviceIdentifier: string) => void;
  decisions: ReturnType<typeof useDeviceDecisions>;
  rename: ReturnType<typeof useDeviceRename>;
  dialogs: ReturnType<typeof useUserDialogs>;
  visibility: ReturnType<typeof useUserVisibility>;
  usersData?: UserPreference[];
  settingsData?: AppSetting[];
  timeRules: TimeRulesByUser;
}

export function DeviceManagementDialogs({
  selectedDevice,
  onCloseDevice,
  onDeviceUpdate,
  onNavigateToDevice,
  decisions,
  rename,
  dialogs,
  visibility,
  usersData,
  settingsData,
  timeRules,
}: DeviceManagementDialogsProps) {
  const { actionLoading } = decisions;
  const preferenceOf = (userId: string) =>
    usersData?.find((user) => user.userId === userId);

  return (
    <>
      <DeviceDetailsModal
        device={selectedDevice}
        isOpen={!!selectedDevice}
        onClose={onCloseDevice}
        editingDevice={rename.editingDevice}
        newDeviceName={rename.newDeviceName}
        actionLoading={actionLoading}
        onEdit={rename.startEditing}
        onCancelEdit={rename.cancelEditing}
        onRename={(deviceId, newName) =>
          void decisions.rename(deviceId, newName)
        }
        onNewDeviceNameChange={rename.setNewDeviceName}
        onSetPending={decisions.setPending}
        onDeviceUpdate={onDeviceUpdate}
        settingsData={settingsData}
        policies={
          selectedDevice
            ? devicePolicyBadges(
                selectedDevice,
                preferenceOf(selectedDevice.userId),
                timeRules[selectedDevice.userId],
              )
            : []
        }
      />

      <TemporaryAccessModal
        user={dialogs.temporaryAccessUser}
        userDevices={dialogs.temporaryAccessDevices}
        isOpen={!!dialogs.temporaryAccessUser}
        onClose={dialogs.closeTemporaryAccess}
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
            preferenceOf(device.userId),
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
        open={visibility.hiddenUsersOpen}
        onOpenChange={visibility.setHiddenUsersOpen}
        users={visibility.hiddenUsers}
        loading={visibility.loadingHiddenUsers}
        onShow={(userId) => void visibility.toggleVisibility(userId)}
      />

      <UserHistoryModal
        userId={dialogs.historyUser?.userId || null}
        username={dialogs.historyUser?.username}
        isOpen={dialogs.historyUser !== null}
        onClose={dialogs.closeHistory}
        onNavigateToDevice={onNavigateToDevice}
        scrollToSessionId={null}
      />

      <TimeRuleModal
        isOpen={dialogs.timeRuleUser !== null}
        onClose={dialogs.closeTimeRules}
        userId={dialogs.timeRuleUser?.userId || ""}
        username={dialogs.timeRuleUser?.username || "Unknown user"}
        deviceIdentifier={dialogs.timeRuleUser?.deviceIdentifier}
      />

      <HideUserDialog
        username={visibility.hideCandidate?.username ?? null}
        onCancel={visibility.cancelHide}
        onConfirm={() => void visibility.confirmHide()}
      />
    </>
  );
}
