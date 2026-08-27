import React, { useEffect, useRef, useState } from "react";
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
  SegmentedControl,
  StatusPill,
  type Tone,
} from "@/components/ui/entity";
import { cn } from "@/lib/utils";
import { UserDevice, UserPreference, UserTimeRule } from "@/types";
import { devicePolicyBadges, groupPolicyBadges } from "@/lib/device-policies";
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
  timeRules?: UserTimeRule[];
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
  onGrantUserTemporaryAccess?: (userId: string) => void;
  onShowTimePolicy?: (userId: string, deviceIdentifier?: string) => void;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onRemoveTemporaryAccess: (device: UserDevice) => void;
  onShowDetails: (device: UserDevice) => void;
}

export const UserGroupCard: React.FC<UserGroupCardProps> = ({
  group,
  isExpanded,
  actionLoading,
  timeRules,
  updatingUserPreference,
  onToggleExpansion,
  onUpdateUserPreference,
  onUpdateUserIPPolicy,
  onToggleUserVisibility,
  onShowHistory,
  onGrantUserTemporaryAccess,
  onShowTimePolicy,
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onRemoveTemporaryAccess,
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

  const preference = group.user.preference;
  const policyBadges = groupPolicyBadges(group.devices, preference, timeRules);

  const savingPolicy = updatingUserPreference === group.user.userId;
  const storedPolicy = group.user.preference?.defaultBlock ?? null;
  const [pendingPolicy, setPendingPolicy] = useState<{
    value: boolean | null;
  } | null>(null);
  const wasSavingPolicy = useRef(false);

  useEffect(() => {
    if (wasSavingPolicy.current && !savingPolicy) {
      setPendingPolicy(null);
    }
    wasSavingPolicy.current = savingPolicy;
  }, [savingPolicy]);

  useEffect(() => {
    setPendingPolicy(null);
  }, [storedPolicy]);

  const policyValue = pendingPolicy ? pendingPolicy.value : storedPolicy;

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
                {policyBadges.map(({ policy, label, tone, title }) => (
                  <StatusPill key={policy} tone={tone} title={title}>
                    {label}
                  </StatusPill>
                ))}
                {group.user.preference?.concurrentStreamLimit !== null &&
                  group.user.preference?.concurrentStreamLimit !==
                    undefined && (
                    <StatusPill
                      tone="neutral"
                      title="How many streams this user can run at the same time"
                    >
                      {group.user.preference.concurrentStreamLimit === 0
                        ? "Unlimited Streams"
                        : `${group.user.preference.concurrentStreamLimit} Stream${
                            group.user.preference.concurrentStreamLimit !== 1
                              ? "s"
                              : ""
                          } at Once`}
                    </StatusPill>
                  )}
                {excludedFromLimitCount > 0 && (
                  <StatusPill
                    tone="neutral"
                    title="Streams from these devices are not counted towards the concurrent stream limit"
                  >
                    {excludedFromLimitCount} Excluded
                  </StatusPill>
                )}
              </PillRow>
            </div>

            <PillRow className="mt-3 pl-11 sm:hidden">
              {group.user.preference &&
                getUserPreferenceBadge(group.user.preference.defaultBlock)}
              {policyBadges.map(({ policy, label, tone, title }) => (
                <StatusPill key={policy} tone={tone} title={title}>
                  {label}
                </StatusPill>
              ))}
            </PillRow>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-2.5 sm:p-4 space-y-3 sm:space-y-4">
            {(onToggleUserVisibility ||
              onShowHistory ||
              onUpdateUserIPPolicy ||
              onGrantUserTemporaryAccess ||
              onShowTimePolicy) && (
              <Panel className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      User Actions
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Policies here apply to every device this user owns
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {onShowTimePolicy && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onShowTimePolicy(group.user.userId)}
                        title="Choose the hours this user is blocked from streaming"
                      >
                        Time Schedule
                      </Button>
                    )}
                    {onGrantUserTemporaryAccess && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onGrantUserTemporaryAccess(group.user.userId)
                        }
                        title="Let blocked devices stream for a limited time"
                      >
                        Temporary Access
                      </Button>
                    )}
                    {onUpdateUserIPPolicy && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowIPModal(true)}
                        title="Choose which networks and IP addresses this user can stream from"
                      >
                        IP Access
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConcurrentStreamModal(true)}
                      title="Set how many streams this user can run at once"
                    >
                      Stream Limit
                    </Button>
                    {onShowHistory && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onShowHistory(group.user.userId)}
                        title="Browse everything this user has streamed"
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
                            ? "Move this user back into the main list"
                            : "Move this user to the hidden section at the bottom of the list"
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
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    Default Device Policy
                    {savingPolicy && (
                      <RefreshCw
                        aria-label="Saving the default device policy"
                        className="size-3 animate-spin text-muted-foreground"
                      />
                    )}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    What happens the first time this user streams from a device
                    Guardian has not seen before
                  </p>
                </div>

                <SegmentedControl
                  className="w-full sm:w-auto sm:min-w-[360px]"
                  size="md"
                  busy={savingPolicy}
                  value={policyValue}
                  onChange={(next) => {
                    setPendingPolicy({ value: next });
                    onUpdateUserPreference(group.user.userId, next);
                  }}
                  options={POLICY_CHOICES.map((choice) => ({
                    value: choice.value,
                    tone: choice.tone,
                    label:
                      choice.value === null
                        ? `Global${configLoading ? "" : ` (${getGlobalDefaultBlock() ? "Block" : "Allow"})`}`
                        : choice.label,
                  }))}
                />
              </div>
            </Panel>

            {/* Devices List */}
            {group.devices.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 sm:py-8">
                <p className="text-xs sm:text-sm">
                  No devices yet. They appear here the first time this user
                  streams.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {group.devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    policies={devicePolicyBadges(device, preference, timeRules)}
                    actionLoading={actionLoading}
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelete={onDelete}
                    onToggleApproval={onToggleApproval}
                    onRemoveTemporaryAccess={onRemoveTemporaryAccess}
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
