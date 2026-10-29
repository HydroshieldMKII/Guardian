import React, { useState } from "react";
import { UserPreference, UserTimeRule } from "@/types";
import { groupPolicyBadges } from "@/lib/device-policies";
import { IPAccessModal } from "./IPAccessModal";
import { ConcurrentStreamModal } from "./ConcurrentStreamModal";
import type { DeviceFocus, UserDeviceGroup } from "./user-group";

export type { DeviceFocus } from "./user-group";
import { UserDetailHeader } from "./user-detail/UserDetailHeader";
import {
  UserDevicesGroup,
  type DeviceActions,
} from "./user-detail/UserDevicesGroup";
import { UserRulesGroup } from "./user-detail/UserRulesGroup";

interface UserDetailProps extends DeviceActions {
  group: UserDeviceGroup;
  actionLoading: number | null;
  timeRules?: UserTimeRule[];
  updatingUserPreference?: string | null;
  deviceFocus?: DeviceFocus | null;
  onBack: () => void;
  onUpdateUserPreference: (
    userId: string,
    defaultBlock: boolean | null,
  ) => void;
  onUpdateUserIPPolicy: (
    userId: string,
    updates: Partial<UserPreference>,
  ) => void;
  onUserPreferenceChange?: (
    userId: string,
    changes: Partial<UserPreference>,
  ) => void;
  onToggleUserVisibility: (userId: string) => void;
  onShowHistory: (userId: string) => void;
  onGrantUserTemporaryAccess: (userId: string) => void;
  onShowTimePolicy: (userId: string, deviceIdentifier?: string) => void;
}

export const UserDetail: React.FC<UserDetailProps> = ({
  group,
  actionLoading,
  timeRules,
  updatingUserPreference,
  deviceFocus,
  onBack,
  onUpdateUserPreference,
  onUpdateUserIPPolicy,
  onUserPreferenceChange,
  onToggleUserVisibility,
  onShowHistory,
  onGrantUserTemporaryAccess,
  onShowTimePolicy,
  ...deviceActions
}) => {
  const [showIPModal, setShowIPModal] = useState(false);
  const [showConcurrentStreamModal, setShowConcurrentStreamModal] =
    useState(false);
  const { userId, username, preference } = group.user;

  return (
    <div className="space-y-8" data-user-id={userId}>
      <UserDetailHeader
        group={group}
        policyBadges={groupPolicyBadges(group.devices, preference, timeRules)}
        onBack={onBack}
        onShowHistory={() => onShowHistory(userId)}
        onHide={() => onToggleUserVisibility(userId)}
      />

      <UserDevicesGroup
        devices={group.devices}
        preference={preference}
        timeRules={timeRules}
        deviceFocus={deviceFocus}
        actionLoading={actionLoading}
        actions={deviceActions}
      />

      <UserRulesGroup
        group={group}
        timeRules={timeRules}
        savingPolicy={updatingUserPreference === userId}
        onSavePolicy={(next) => onUpdateUserPreference(userId, next)}
        onEditStreamLimit={() => setShowConcurrentStreamModal(true)}
        onEditSchedule={() => onShowTimePolicy(userId)}
        onEditNetworks={() => setShowIPModal(true)}
        onGrantTemporaryAccess={() => onGrantUserTemporaryAccess(userId)}
      />

      <IPAccessModal
        isOpen={showIPModal}
        onClose={() => setShowIPModal(false)}
        user={group.user}
        userDevices={group.devices}
        onSave={onUpdateUserIPPolicy}
      />

      <ConcurrentStreamModal
        isOpen={showConcurrentStreamModal}
        onClose={() => setShowConcurrentStreamModal(false)}
        userId={userId}
        username={username}
        onUpdate={(changes) => onUserPreferenceChange?.(userId, changes)}
      />
    </div>
  );
};
