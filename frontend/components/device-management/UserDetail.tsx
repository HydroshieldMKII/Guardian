import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  History,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import {
  PillRow,
  SegmentedControl,
  StatusPill,
  type Tone,
} from "@/components/ui/entity";
import { UserDevice, UserPreference, UserTimeRule } from "@/types";
import {
  devicePolicyBadges,
  groupPolicyBadges,
  hasIPPolicy,
  hasTemporaryAccess,
  isPlexampDevice,
  isWaitingDevice,
} from "@/lib/device-policies";
import { formatAgo, pluralize } from "@/lib/duration";
import { UserAvatar } from "./SharedComponents";
import { DeviceRow } from "./DeviceRow";
import { IPAccessModal } from "./IPAccessModal";
import { ConcurrentStreamModal } from "./ConcurrentStreamModal";
import { groupName, type UserDeviceGroup } from "./user-group";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

const POLICY_CHOICES: {
  label: string;
  value: boolean | null;
  tone: Tone;
}[] = [
  { label: "Global", value: null, tone: "neutral" },
  { label: "Allow", value: false, tone: "positive" },
  { label: "Block", value: true, tone: "danger" },
];

const NETWORK_LABEL: Record<UserPreference["networkPolicy"], string> = {
  both: "Any network",
  lan: "Local network only",
  wan: "Internet only",
};

const DEVICE_PREVIEW = 5;
const MIN_HIDDEN_DEVICES = 3;

export interface DeviceFocus {
  deviceIdentifier: string;
}

const streamLimitLabel = (limit?: number | null) => {
  if (limit === null || limit === undefined) return "Global default";
  if (limit === 0) return "Unlimited";
  return String(limit);
};

const networkLabel = (preference?: UserPreference) => {
  if (!preference || !hasIPPolicy(preference)) return "Anywhere";
  const network = NETWORK_LABEL[preference.networkPolicy];
  return preference.ipAccessPolicy === "restricted"
    ? `${network}, listed addresses`
    : network;
};

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
        {children}
      </div>
    </section>
  );
}

function RuleRow({
  title,
  description,
  value,
  onClick,
  active = false,
}: {
  title: string;
  description: string;
  value: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-accent/60 sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-sm",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

interface UserDetailProps {
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
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onRemoveTemporaryAccess: (device: UserDevice) => void;
  onShowDetails: (device: UserDevice) => void;
  onDeviceUpdate?: (device: UserDevice) => void;
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
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onRemoveTemporaryAccess,
  onShowDetails,
  onDeviceUpdate,
}) => {
  const [showIPModal, setShowIPModal] = useState(false);
  const [showConcurrentStreamModal, setShowConcurrentStreamModal] =
    useState(false);
  const { getGlobalDefaultBlock, loading: configLoading } = useSettings();

  const { userId } = group.user;
  const preference = group.user.preference;
  const name = groupName(group);
  const policyBadges = groupPolicyBadges(group.devices, preference, timeRules);

  const excludedFromLimitCount = group.devices.filter(
    (device) => device.excludeFromConcurrentLimit,
  ).length;
  const scheduleCount = (timeRules ?? []).filter((rule) => rule.enabled).length;
  const temporaryCount = group.devices.filter(
    (device) => hasTemporaryAccess(device) && !isPlexampDevice(device),
  ).length;

  const savingPolicy = updatingUserPreference === userId;
  const storedPolicy = preference?.defaultBlock ?? null;
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
    setPendingPolicy((current) =>
      current && !Object.is(current.value, storedPolicy) ? current : null,
    );
  }, [storedPolicy]);

  const policyValue = pendingPolicy ? pendingPolicy.value : storedPolicy;

  const [showAllDevices, setShowAllDevices] = useState(false);
  const overflowDevices = group.devices.slice(DEVICE_PREVIEW);
  const devicesCollapsible =
    overflowDevices.length >= MIN_HIDDEN_DEVICES &&
    !overflowDevices.some(isWaitingDevice);
  const visibleDevices =
    devicesCollapsible && !showAllDevices
      ? group.devices.slice(0, DEVICE_PREVIEW)
      : group.devices;
  const focusedDeviceHidden = overflowDevices.some(
    (device) => device.deviceIdentifier === deviceFocus?.deviceIdentifier,
  );

  useEffect(() => {
    if (focusedDeviceHidden) setShowAllDevices(true);
  }, [deviceFocus, focusedDeviceHidden]);

  const summary = [
    pluralize(group.devices.length, "device"),
    group.pendingCount > 0 ? `${group.pendingCount} waiting` : null,
    group.lastSeen ? `last seen ${formatAgo(group.lastSeen)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8" data-user-id={userId}>
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <UserAvatar
            userId={userId}
            username={group.user.username}
            avatarUrl={preference?.avatarUrl}
            className="size-14 text-sm"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-[-0.01em] text-foreground">
              {name}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {summary.join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowHistory(userId)}
              title="Browse everything this user has streamed"
            >
              <History />
              History
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="size-8 px-0">
                  <span className="sr-only">More for {name}</span>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => onToggleUserVisibility(userId)}
                >
                  <EyeOff />
                  Hide user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {policyBadges.length > 0 && (
          <PillRow>
            {policyBadges.map(({ policy, label, tone, hint }) => (
              <StatusPill key={policy} tone={tone} hint={hint}>
                {label}
              </StatusPill>
            ))}
          </PillRow>
        )}
      </div>

      <Group title="Devices">
        {group.devices.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No devices yet. They appear here the first time this user streams.
          </p>
        ) : (
          visibleDevices.map((device) => (
            <DeviceRow
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
              onDeviceUpdate={onDeviceUpdate}
            />
          ))
        )}
        {devicesCollapsible && (
          <button
            type="button"
            aria-expanded={showAllDevices}
            onClick={() => setShowAllDevices((value) => !value)}
            className="w-full cursor-pointer rounded-b-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent/60 hover:text-foreground sm:px-5"
          >
            {showAllDevices
              ? "Show fewer"
              : `Show all ${group.devices.length} devices`}
          </button>
        )}
      </Group>

      <Group
        title="Rules"
        description="These apply to every device this user owns."
      >
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              New devices
              {savingPolicy && (
                <RefreshCw
                  aria-label="Saving the New devices rule"
                  className="size-3 animate-spin text-muted-foreground"
                />
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              What happens the first time this user streams from a device that
              has not been seen before
            </p>
          </div>
          <SegmentedControl
            className="w-full sm:w-auto sm:min-w-[300px]"
            busy={savingPolicy}
            value={policyValue}
            onChange={(next) => {
              if (Object.is(next, policyValue)) return;
              setPendingPolicy({ value: next });
              onUpdateUserPreference(userId, next);
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
        <RuleRow
          title="Streams at once"
          description={
            excludedFromLimitCount > 0
              ? `How many streams this user can run at the same time. ${pluralize(excludedFromLimitCount, "device")} ${excludedFromLimitCount === 1 ? "is" : "are"} not counted.`
              : "How many streams this user can run at the same time"
          }
          value={streamLimitLabel(preference?.concurrentStreamLimit)}
          active={
            preference?.concurrentStreamLimit !== null &&
            preference?.concurrentStreamLimit !== undefined
          }
          onClick={() => setShowConcurrentStreamModal(true)}
        />
        <RuleRow
          title="Schedule"
          description="Hours when this user is blocked from streaming"
          value={scheduleCount > 0 ? pluralize(scheduleCount, "rule") : "None"}
          active={scheduleCount > 0}
          onClick={() => onShowTimePolicy(userId)}
        />
        <RuleRow
          title="Networks"
          description="Where this user can stream from"
          value={networkLabel(preference)}
          active={hasIPPolicy(preference)}
          onClick={() => setShowIPModal(true)}
        />
        <RuleRow
          title="Temporary access"
          description="Let blocked devices stream for a limited time"
          value={
            temporaryCount > 0 ? pluralize(temporaryCount, "device") : "None"
          }
          active={temporaryCount > 0}
          onClick={() => onGrantUserTemporaryAccess(userId)}
        />
      </Group>

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
        username={group.user.username}
        onUpdate={(changes) => onUserPreferenceChange?.(userId, changes)}
      />
    </div>
  );
};
