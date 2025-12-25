import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Settings,
  CheckCircle,
  XCircle,
  Monitor,
  EyeOff,
  Eye,
  History,
  SquareUser,
  Shield,
  Timer,
  Users,
  UserMinus,
} from "lucide-react";
import { UserDevice, UserPreference, AppSetting } from "@/types";
import { UserAvatar, getUserPreferenceBadge } from "./SharedComponents";
import { DeviceCard } from "./DeviceCard";
import { IPAccessModal } from "./IPAccessModal";
import { ConcurrentStreamModal } from "./ConcurrentStreamModal";
import { useSettings } from "@/contexts/settings-context";

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

interface UserGroupCardProps {
  group: UserDeviceGroup;
  isExpanded: boolean;
  settingsData?: AppSetting[];
  actionLoading: number | null;
  editingDevice: number | null;
  newDeviceName: string;
  hasTimeSchedules?: boolean;
  hasIPPolicies?: boolean;
  updatingUserPreference?: string | null; // Track which user's preference is being updated
  onToggleExpansion: (userId: string) => void;
  onUpdateUserPreference: (
    userId: string,
    defaultBlock: boolean | null
  ) => void;
  onUpdateUserIPPolicy?: (
    userId: string,
    updates: Partial<UserPreference>
  ) => void;
  onToggleUserVisibility?: (userId: string) => void;
  onShowHistory?: (userId: string) => void;
  onGrantUserTempAccess?: (userId: string) => void;
  onShowTimePolicy?: (userId: string, deviceIdentifier?: string) => void;
  onEdit: (device: UserDevice) => void;
  onCancelEdit: () => void;
  onRename: (deviceId: number, newName: string) => void;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onRevokeTempAccess: (deviceId: number) => void;
  onShowDetails: (device: UserDevice) => void;
  onNewDeviceNameChange: (name: string) => void;
}

export const UserGroupCard: React.FC<UserGroupCardProps> = ({
  group,
  isExpanded,
  settingsData,
  actionLoading,
  editingDevice,
  newDeviceName,
  hasTimeSchedules = false,
  hasIPPolicies = false,
  updatingUserPreference,
  onToggleExpansion,
  onUpdateUserPreference,
  onUpdateUserIPPolicy,
  onToggleUserVisibility,
  onShowHistory,
  onGrantUserTempAccess,
  onShowTimePolicy,
  onEdit,
  onCancelEdit,
  onRename,
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onRevokeTempAccess,
  onShowDetails,
  onNewDeviceNameChange,
}) => {
  const [showIPModal, setShowIPModal] = useState(false);
  const [showConcurrentStreamModal, setShowConcurrentStreamModal] =
    useState(false);
  const { getGlobalDefaultBlock, loading: configLoading } = useSettings();

  // Count devices excluded from concurrent limit
  const excludedFromLimitCount = group.devices.filter(
    (device) => device.excludeFromConcurrentLimit
  ).length;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => onToggleExpansion(group.user.userId)}
    >
      <div
        className="rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow"
        data-user-id={group.user.userId}
      >
        <CollapsibleTrigger asChild>
          <div className="p-2.5 sm:p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                )}
                <UserAvatar
                  userId={group.user.userId}
                  username={group.user.username}
                  avatarUrl={group.user.preference?.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate text-sm">
                    {group.user.username || group.user.userId}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {group.devices.length} device
                    {group.devices.length !== 1 ? "s" : ""}
                    {group.pendingCount > 0 && (
                      <span className="text-yellow-600 dark:text-yellow-400">
                        {" • "}
                        {group.pendingCount} pending
                      </span>
                    )}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  {group.user.preference &&
                    getUserPreferenceBadge(group.user.preference.defaultBlock)}
                  {hasTimeSchedules && (
                    <Badge variant="outline" className="text-xs">
                      <Timer className="w-3 h-3 mr-1" />
                      Scheduled
                    </Badge>
                  )}
                  {hasIPPolicies && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      IP Policy
                    </Badge>
                  )}
                  {group.user.preference?.concurrentStreamLimit !== null &&
                    group.user.preference?.concurrentStreamLimit !==
                      undefined && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {group.user.preference.concurrentStreamLimit === 0
                          ? "Unlimited"
                          : `${group.user.preference.concurrentStreamLimit} Stream${group.user.preference.concurrentStreamLimit !== 1 ? "s" : ""}`}
                      </Badge>
                    )}
                  {excludedFromLimitCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <UserMinus className="w-3 h-3 mr-1" />
                      {excludedFromLimitCount} Excluded
                    </Badge>
                  )}
                </div>
              </div>

              {/* Mobile: Show preference badge */}
              <div className="sm:hidden flex items-center gap-1.5 ml-6">
                {group.user.preference &&
                  getUserPreferenceBadge(group.user.preference.defaultBlock)}
                {hasTimeSchedules && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5"
                  >
                    <Timer className="w-2.5 h-2.5 mr-0.5" />
                    Scheduled
                  </Badge>
                )}
                {group.user.preference?.concurrentStreamLimit !== null &&
                  group.user.preference?.concurrentStreamLimit !==
                    undefined && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0.5"
                    >
                      <Users className="w-2.5 h-2.5 mr-0.5" />
                      {group.user.preference.concurrentStreamLimit}
                    </Badge>
                  )}
                {excludedFromLimitCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5"
                  >
                    <UserMinus className="w-2.5 h-2.5 mr-0.5" />
                    {excludedFromLimitCount}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-2.5 sm:p-4 space-y-3 sm:space-y-4">
            {/* User Actions Card */}
            {(onToggleUserVisibility ||
              onShowHistory ||
              onUpdateUserIPPolicy ||
              onGrantUserTempAccess ||
              onShowTimePolicy) && (
              <div className="bg-gradient-to-r from-card to-card/50 border rounded-lg p-2.5 sm:p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:gap-4">
                  {/* Actions Label */}
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg hidden sm:block">
                      <SquareUser className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        User Actions
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Manage user visibility, history, and access policies
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center bg-muted/50 rounded-lg p-1 gap-1">
                    {onShowTimePolicy && (
                      <button
                        onClick={() => onShowTimePolicy(group.user.userId)}
                        className="text-xs px-3 py-2 rounded-md transition-all duration-200 flex items-center cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                        title="Manage time-based access policies"
                      >
                        <Timer className="w-3 h-3 mr-2" />
                        <span>Schedule</span>
                      </button>
                    )}
                    {onGrantUserTempAccess && (
                      <button
                        onClick={() => onGrantUserTempAccess(group.user.userId)}
                        className="text-xs px-3 py-2 rounded-md transition-all duration-200 flex items-center cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                        title="Grant temporary access to user devices"
                      >
                        <Timer className="w-3 h-3 mr-2" />
                        <span>Temp Access</span>
                      </button>
                    )}
                    {onUpdateUserIPPolicy && (
                      <button
                        onClick={() => setShowIPModal(true)}
                        className="text-xs px-3 py-2 rounded-md transition-all duration-200 flex items-center cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                        title="Configure IP and network access policies"
                      >
                        <Shield className="w-3 h-3 mr-2" />
                        <span>IP Policy</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowConcurrentStreamModal(true)}
                      className="text-xs px-3 py-2 rounded-md transition-all duration-200 flex items-center cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                      title="Configure concurrent stream limit for this user"
                    >
                      <Users className="w-3 h-3 mr-2" />
                      <span>Stream Limit</span>
                    </button>
                    {onShowHistory && (
                      <button
                        onClick={() => onShowHistory(group.user.userId)}
                        className="text-xs px-3 py-2 rounded-md transition-all duration-200 flex items-center cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                        title="Show user history"
                      >
                        <History className="w-3 h-3 mr-2" />
                        <span>History</span>
                      </button>
                    )}
                    {onToggleUserVisibility && (
                      <button
                        onClick={() =>
                          onToggleUserVisibility(group.user.userId)
                        }
                        className="text-xs px-3 py-2 rounded-md transition-all duration-200 flex items-center cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                        title={
                          group.user.preference?.hidden
                            ? "Show user"
                            : "Hide user"
                        }
                      >
                        {group.user.preference?.hidden ? (
                          <>
                            <Eye className="w-3 h-3 mr-2" />
                            <span>Show</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 mr-2" />
                            <span>Hide</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Device Policy Card */}
            <div className="bg-gradient-to-r from-card to-card/50 border rounded-lg p-2.5 sm:p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Policy Label */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg hidden sm:block">
                    <Settings className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">
                      Default Device Policy
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      How pending devices should be handled
                    </p>
                  </div>
                </div>

                {/* Policy Toggle Buttons */}
                <div className="flex items-center bg-muted/50 rounded-lg p-1 gap-1">
                  <button
                    onClick={() =>
                      onUpdateUserPreference(group.user.userId, null)
                    }
                    disabled={updatingUserPreference === group.user.userId}
                    className={`flex-1 text-xs px-3 py-2.5 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer ${
                      !group.user.preference ||
                      group.user.preference.defaultBlock === null
                        ? "bg-gray-200 text-black shadow-sm font-medium hover:bg-gray-100"
                        : "text-foreground hover:bg-accent"
                    } ${updatingUserPreference === group.user.userId ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {updatingUserPreference === group.user.userId ? (
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                    ) : (
                      <Settings className="w-3 h-3 mr-2" />
                    )}
                    <span>
                      Global{" "}
                      {!configLoading &&
                        `(${getGlobalDefaultBlock() ? "Block" : "Allow"})`}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      onUpdateUserPreference(group.user.userId, false)
                    }
                    disabled={updatingUserPreference === group.user.userId}
                    className={`flex-1 text-xs px-3 py-2.5 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer ${
                      group.user.preference?.defaultBlock === false
                        ? "bg-green-600 text-white shadow-sm font-medium hover:bg-green-600"
                        : "text-foreground hover:bg-accent"
                    } ${updatingUserPreference === group.user.userId ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {updatingUserPreference === group.user.userId ? (
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-3 h-3 mr-2" />
                    )}
                    Allow
                  </button>
                  <button
                    onClick={() =>
                      onUpdateUserPreference(group.user.userId, true)
                    }
                    disabled={updatingUserPreference === group.user.userId}
                    className={`flex-1 text-xs px-3 py-2.5 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer ${
                      group.user.preference?.defaultBlock === true
                        ? "bg-red-600 dark:bg-red-700 text-white shadow-sm font-medium hover:bg-red-700 dark:hover:bg-red-800"
                        : "text-foreground hover:bg-accent"
                    } ${updatingUserPreference === group.user.userId ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {updatingUserPreference === group.user.userId ? (
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-2" />
                    )}
                    Block
                  </button>
                </div>
              </div>
            </div>

            {/* Devices List */}
            {group.devices.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 sm:py-8">
                <Monitor className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                <p className="text-xs sm:text-sm">
                  No devices found for this user
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {group.devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    settingsData={settingsData}
                    actionLoading={actionLoading}
                    editingDevice={editingDevice}
                    newDeviceName={newDeviceName}
                    onEdit={onEdit}
                    onCancelEdit={onCancelEdit}
                    onRename={onRename}
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelete={onDelete}
                    onToggleApproval={onToggleApproval}
                    onRevokeTempAccess={onRevokeTempAccess}
                    onShowDetails={onShowDetails}
                    onNewDeviceNameChange={onNewDeviceNameChange}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>

      {/* IP Access Modal */}
      {onUpdateUserIPPolicy && (
        <IPAccessModal
          isOpen={showIPModal}
          onClose={() => setShowIPModal(false)}
          user={group.user}
          userDevices={group.devices}
          onSave={onUpdateUserIPPolicy}
        />
      )}

      {/* Concurrent Stream Modal */}
      <ConcurrentStreamModal
        isOpen={showConcurrentStreamModal}
        onClose={() => setShowConcurrentStreamModal(false)}
        userId={group.user.userId}
        username={group.user.username}
      />
    </Collapsible>
  );
};
