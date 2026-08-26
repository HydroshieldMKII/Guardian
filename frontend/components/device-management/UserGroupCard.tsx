import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PillRow, StatusPill } from "@/components/ui/entity";
import { UserDevice, UserPreference } from "@/types";
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
  actionLoading: number | null;
  hasTimeSchedules?: boolean;
  hasIPPolicies?: boolean;
  updatingUserPreference?: string | null; // Track which user's preference is being updated
  onToggleExpansion: (userId: string) => void;
  onUpdateUserPreference: (
    userId: string,
    defaultBlock: boolean | null,
  ) => void;
  onUpdateUserIPPolicy?: (
    userId: string,
    updates: Partial<UserPreference>,
  ) => void;
  onToggleUserVisibility?: (userId: string) => void;
  onShowHistory?: (userId: string) => void;
  onGrantUserTempAccess?: (userId: string) => void;
  onShowTimePolicy?: (userId: string, deviceIdentifier?: string) => void;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onRevokeTempAccess: (deviceId: number) => void;
  onShowDetails: (device: UserDevice) => void;
}

export const UserGroupCard: React.FC<UserGroupCardProps> = ({
  group,
  isExpanded,
  actionLoading,
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
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onRevokeTempAccess,
  onShowDetails,
}) => {
  const [showIPModal, setShowIPModal] = useState(false);
  const [showConcurrentStreamModal, setShowConcurrentStreamModal] =
    useState(false);
  const { getGlobalDefaultBlock, loading: configLoading } = useSettings();

  // Count devices excluded from concurrent limit
  const excludedFromLimitCount = group.devices.filter(
    (device) => device.excludeFromConcurrentLimit,
  ).length;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => onToggleExpansion(group.user.userId)}
    >
      <div
        className="overflow-hidden rounded-xl border bg-card"
        data-user-id={group.user.userId}
      >
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer border-b p-4 transition-colors hover:bg-muted/40 sm:p-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
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
                  <h3 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground">
                    {group.user.username || group.user.userId}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    {group.devices.length} device
                    {group.devices.length !== 1 ? "s" : ""}
                    {group.pendingCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" · "}
                        {group.pendingCount} pending
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <PillRow className="hidden shrink-0 justify-end sm:flex">
                {group.user.preference &&
                  getUserPreferenceBadge(group.user.preference.defaultBlock)}
                {hasTimeSchedules && (
                  <StatusPill tone="info">Scheduled</StatusPill>
                )}
                {hasIPPolicies && (
                  <StatusPill tone="info">IP Policy</StatusPill>
                )}
                {group.user.preference?.concurrentStreamLimit !== null &&
                  group.user.preference?.concurrentStreamLimit !==
                    undefined && (
                    <StatusPill tone="neutral">
                      {group.user.preference.concurrentStreamLimit === 0
                        ? "Unlimited"
                        : `${group.user.preference.concurrentStreamLimit} Stream${
                            group.user.preference.concurrentStreamLimit !== 1
                              ? "s"
                              : ""
                          }`}
                    </StatusPill>
                  )}
                {excludedFromLimitCount > 0 && (
                  <StatusPill tone="neutral">
                    {excludedFromLimitCount} Excluded
                  </StatusPill>
                )}
              </PillRow>
            </div>

            <PillRow className="mt-3 pl-11 sm:hidden">
              {group.user.preference &&
                getUserPreferenceBadge(group.user.preference.defaultBlock)}
              {hasTimeSchedules && (
                <StatusPill tone="info">Scheduled</StatusPill>
              )}
              {hasIPPolicies && <StatusPill tone="info">IP Policy</StatusPill>}
            </PillRow>
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
                <div className="flex flex-col gap-3 sm:gap-0">
                  {/* Header with buttons inline on desktop */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Actions Label */}
                    <div className="flex items-center space-x-3">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          User Actions
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Manage user visibility, history, and access policies
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons - inline on desktop, stacked on mobile */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center bg-muted/50 rounded-lg p-1.5 sm:p-1 gap-1 sm:ml-auto">
                      {onShowTimePolicy && (
                        <button
                          onClick={() => onShowTimePolicy(group.user.userId)}
                          className="text-xs px-2 sm:px-3 py-2 rounded-md transition-all duration-200 flex items-center justify-center sm:justify-start cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                          title="Manage time-based access policies"
                        >
                          <span className="text-[11px] sm:text-xs">
                            Time Schedule
                          </span>
                        </button>
                      )}
                      {onGrantUserTempAccess && (
                        <button
                          onClick={() =>
                            onGrantUserTempAccess(group.user.userId)
                          }
                          className="text-xs px-2 sm:px-3 py-2 rounded-md transition-all duration-200 flex items-center justify-center sm:justify-start cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                          title="Grant temporary access to user devices"
                        >
                          <span className="text-[11px] sm:text-xs">
                            Temporary Access
                          </span>
                        </button>
                      )}
                      {onUpdateUserIPPolicy && (
                        <button
                          onClick={() => setShowIPModal(true)}
                          className="text-xs px-2 sm:px-3 py-2 rounded-md transition-all duration-200 flex items-center justify-center sm:justify-start cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                          title="Configure IP and network access policies"
                        >
                          <span className="text-[11px] sm:text-xs">
                            IP Access
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowConcurrentStreamModal(true)}
                        className="text-xs px-2 sm:px-3 py-2 rounded-md transition-all duration-200 flex items-center justify-center sm:justify-start cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                        title="Configure concurrent stream limit for this user"
                      >
                        <span className="text-[11px] sm:text-xs">
                          Stream Limit
                        </span>
                      </button>
                      {onShowHistory && (
                        <button
                          onClick={() => onShowHistory(group.user.userId)}
                          className="text-xs px-2 sm:px-3 py-2 rounded-md transition-all duration-200 flex items-center justify-center sm:justify-start cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                          title="Show user history"
                        >
                          <span className="text-[11px] sm:text-xs">
                            Stream History
                          </span>
                        </button>
                      )}
                      {onToggleUserVisibility && (
                        <button
                          onClick={() =>
                            onToggleUserVisibility(group.user.userId)
                          }
                          className="text-xs px-2 sm:px-3 py-2 rounded-md transition-all duration-200 flex items-center justify-center sm:justify-start cursor-pointer text-foreground hover:bg-accent whitespace-nowrap"
                          title={
                            group.user.preference?.hidden
                              ? "Show user"
                              : "Hide user"
                          }
                        >
                          {group.user.preference?.hidden ? (
                            <>
                              <span className="text-[11px] sm:text-xs">
                                Show User
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] sm:text-xs">
                                Hide User
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Device Policy Card */}
            <div className="bg-gradient-to-r from-card to-card/50 border rounded-lg p-2.5 sm:p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:gap-0">
                {/* Header with buttons inline on desktop */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Policy Label */}
                  <div className="flex items-center space-x-3">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Default Device Policy
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        How new devices should be handled
                      </p>
                    </div>
                  </div>

                  {/* Policy Toggle Buttons - inline on desktop, stacked on mobile */}
                  <div className="flex items-center bg-muted/50 rounded-lg p-1 gap-1 sm:ml-auto sm:min-w-[400px]">
                    <button
                      onClick={() =>
                        onUpdateUserPreference(group.user.userId, null)
                      }
                      disabled={updatingUserPreference === group.user.userId}
                      className={`flex-1 text-xs px-3 py-2.5 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer whitespace-nowrap ${
                        !group.user.preference ||
                        group.user.preference.defaultBlock === null
                          ? "bg-gray-200 text-black shadow-sm font-medium hover:bg-gray-100"
                          : "text-foreground hover:bg-accent"
                      } ${updatingUserPreference === group.user.userId ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {updatingUserPreference === group.user.userId ? (
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                      ) : null}
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
                      ) : null}
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
                      ) : null}
                      Block
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Devices List */}
            {group.devices.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 sm:py-8">
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
                    actionLoading={actionLoading}
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelete={onDelete}
                    onToggleApproval={onToggleApproval}
                    onRevokeTempAccess={onRevokeTempAccess}
                    onShowDetails={onShowDetails}
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
