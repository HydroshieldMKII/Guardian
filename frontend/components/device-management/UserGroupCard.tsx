import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
  Panel,
  PillRow,
  StatusPill,
  toneButton,
  type Tone,
} from "@/components/ui/entity";
import { cn } from "@/lib/utils";
import { UserDevice, UserPreference } from "@/types";
import { UserAvatar, getUserPreferenceBadge } from "./SharedComponents";
import { DeviceCard } from "./DeviceCard";
import { IPAccessModal } from "./IPAccessModal";
import { ConcurrentStreamModal } from "./ConcurrentStreamModal";
import { useSettings } from "@/contexts/settings-context";

const POLICY_CHOICES: {
  label: string;
  value: boolean | null;
  tone: Tone;
}[] = [
  { label: "Global", value: null, tone: "neutral" },
  { label: "Allow", value: false, tone: "positive" },
  { label: "Block", value: true, tone: "danger" },
];

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

  const savingPolicy = updatingUserPreference === group.user.userId;
  const policyValue = group.user.preference?.defaultBlock ?? null;

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
            {(onToggleUserVisibility ||
              onShowHistory ||
              onUpdateUserIPPolicy ||
              onGrantUserTempAccess ||
              onShowTimePolicy) && (
              <Panel className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      User Actions
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Manage user visibility, history, and access policies
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {onShowTimePolicy && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onShowTimePolicy(group.user.userId)}
                        title="Manage time-based access policies"
                      >
                        Time Schedule
                      </Button>
                    )}
                    {onGrantUserTempAccess && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGrantUserTempAccess(group.user.userId)}
                        title="Grant temporary access to user devices"
                      >
                        Temporary Access
                      </Button>
                    )}
                    {onUpdateUserIPPolicy && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowIPModal(true)}
                        title="Configure IP and network access policies"
                      >
                        IP Access
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConcurrentStreamModal(true)}
                      title="Configure concurrent stream limit for this user"
                    >
                      Stream Limit
                    </Button>
                    {onShowHistory && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onShowHistory(group.user.userId)}
                        title="Show user history"
                      >
                        Stream History
                      </Button>
                    )}
                    {onToggleUserVisibility && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onToggleUserVisibility(group.user.userId)
                        }
                        title={
                          group.user.preference?.hidden
                            ? "Show user"
                            : "Hide user"
                        }
                      >
                        {group.user.preference?.hidden
                          ? "Show User"
                          : "Hide User"}
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            )}

            <Panel className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Default Device Policy
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    How new devices should be handled
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 sm:min-w-[360px]">
                  {POLICY_CHOICES.map((choice) => {
                    const active = policyValue === choice.value;
                    return (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() =>
                          onUpdateUserPreference(
                            group.user.userId,
                            choice.value,
                          )
                        }
                        disabled={savingPolicy}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium",
                          "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? choice.tone === "neutral"
                              ? "bg-background text-foreground shadow-sm"
                              : toneButton(choice.tone, "solid")
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {savingPolicy && (
                          <RefreshCw className="size-3 animate-spin" />
                        )}
                        {choice.value === null ? (
                          <span>
                            Global{" "}
                            {!configLoading &&
                              `(${getGlobalDefaultBlock() ? "Block" : "Allow"})`}
                          </span>
                        ) : (
                          choice.label
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>

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
