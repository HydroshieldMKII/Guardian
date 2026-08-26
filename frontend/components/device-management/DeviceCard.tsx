import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Ban,
  Check,
  Info,
  MoreVertical,
  RefreshCw,
  ShieldOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  EntityCard,
  StatusPill,
  toneMenuItem,
  type Tone,
} from "@/components/ui/entity";
import { UserDevice } from "@/types";
import { ClickableIP } from "./SharedComponents";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DeviceCardProps {
  device: UserDevice;
  actionLoading: number | null;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onRevokeTempAccess: (deviceId: number) => void;
  onShowDetails: (device: UserDevice) => void;
  onDeviceUpdate?: (device: UserDevice) => void;
}

const isPlexAmp = (device: UserDevice) =>
  Boolean(
    device.deviceProduct?.toLowerCase().includes("plexamp") ||
    device.deviceName?.toLowerCase().includes("plexamp"),
  );

const STATUS_TONE: Record<string, Tone> = {
  approved: "positive",
  rejected: "danger",
  pending: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
};

interface DeviceAction {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  onSelect: () => void;
}

const Fact = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="after:mx-2 after:text-muted-foreground/40 after:content-['·'] last:after:content-none">
    <dt className="sr-only">{label}</dt>
    <dd className="inline">{children}</dd>
  </div>
);

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  actionLoading,
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onRevokeTempAccess,
  onShowDetails,
  onDeviceUpdate,
}) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();
  const { toast } = useToast();
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [noteReadAt, setNoteReadAt] = useState<string | undefined>(
    device.requestNoteReadAt,
  );

  React.useEffect(() => {
    setNoteReadAt(device.requestNoteReadAt);
  }, [device.requestNoteReadAt]);

  const handleMarkNoteAsRead = async () => {
    setMarkingAsRead(true);
    try {
      await apiClient.markDeviceNoteAsRead(device.id);
      const now = new Date().toISOString();
      setNoteReadAt(now);
      toast({
        title: "Note marked as read",
        description: "The user will be notified that their note has been read.",
        variant: "success",
      });
      if (onDeviceUpdate) {
        onDeviceUpdate({ ...device, requestNoteReadAt: now });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to mark note as read",
        variant: "destructive",
      });
    } finally {
      setMarkingAsRead(false);
    }
  };

  const plexAmp = isPlexAmp(device);
  const busy = actionLoading === device.id;
  const tone: Tone = plexAmp
    ? "accent"
    : (STATUS_TONE[device.status] ?? "neutral");
  const temporary = hasTemporaryAccess(device);
  const showsNote =
    Boolean(device.requestDescription) &&
    Boolean(device.requestSubmittedAt) &&
    !noteReadAt;

  const streams = device.sessionCount ?? 0;

  const spinner = <RefreshCw className="size-4 animate-spin" />;

  const decisions: DeviceAction[] = plexAmp
    ? []
    : device.status === "pending"
      ? [
          {
            label: "Approve",
            icon: Check,
            tone: "positive",
            onSelect: () => onApprove(device),
          },
          {
            label: "Reject",
            icon: Ban,
            tone: "danger",
            onSelect: () => onReject(device),
          },
        ]
      : device.status === "rejected"
        ? [
            {
              label: "Approve",
              icon: Check,
              tone: "positive",
              onSelect: () => onToggleApproval(device),
            },
          ]
        : [
            {
              label: "Reject",
              icon: Ban,
              tone: "danger",
              onSelect: () => onToggleApproval(device),
            },
          ];

  const actions: DeviceAction[] = [
    ...decisions,
    {
      label: "View Details",
      icon: Info,
      tone: "neutral",
      onSelect: () => onShowDetails(device),
    },
  ];

  if (temporary && !plexAmp && device.status !== "approved") {
    actions.push({
      label: "Revoke Temp Access",
      icon: ShieldOff,
      tone: "warning",
      onSelect: () => onRevokeTempAccess(device.id),
    });
  }

  const menuItem = ({
    label,
    icon: Icon,
    tone: itemTone,
    onSelect,
  }: DeviceAction) => (
    <DropdownMenuItem
      key={label}
      onSelect={onSelect}
      className={toneMenuItem(itemTone)}
    >
      <Icon />
      {label}
    </DropdownMenuItem>
  );

  return (
    <EntityCard
      id={`device-${device.id}`}
      tone={tone}
      data-device-identifier={device.deviceIdentifier}
    >
      <div className="space-y-3 p-3 pl-4 sm:p-4 sm:pl-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
                {device.deviceName || "Unknown"}
              </h4>
              <StatusPill tone={tone} size="sm">
                {plexAmp
                  ? "Plex Amp"
                  : (STATUS_LABEL[device.status] ?? device.status)}
              </StatusPill>
              {temporary && (
                <StatusPill tone="info" size="sm">
                  {getTemporaryAccessTimeLeft(device)}
                </StatusPill>
              )}
              {temporary && device.temporaryAccessBypassPolicies && (
                <StatusPill tone="warning" size="sm">
                  Bypass
                </StatusPill>
              )}
              {device.status === "approved" &&
                device.excludeFromConcurrentLimit && (
                  <StatusPill tone="neutral" size="sm">
                    No Limit
                  </StatusPill>
                )}
            </div>

            <dl className="flex flex-wrap items-center gap-y-1 text-xs text-muted-foreground">
              <Fact label="Product">{device.deviceProduct || "Unknown"}</Fact>
              <Fact label="Platform">{device.devicePlatform || "Unknown"}</Fact>
              <Fact label="IP Address">
                <ClickableIP ipAddress={device.ipAddress} />
              </Fact>
              <Fact label="Streams">
                {streams} {streams === 1 ? "stream" : "streams"}
              </Fact>
              <Fact label="Last Seen">
                Last seen {new Date(device.lastSeen).toLocaleDateString()}
              </Fact>
            </dl>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-10 w-full rounded-md lg:size-8 lg:px-0"
              >
                <span className="lg:sr-only">Actions</span>
                {busy ? spinner : <MoreVertical />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {actions.map(menuItem)}
              <DropdownMenuSeparator />
              {menuItem({
                label: "Delete",
                icon: Trash2,
                tone: "danger",
                onSelect: () => onDelete(device),
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showsNote && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  User Note
                </p>
                <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                  {device.requestDescription}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkNoteAsRead}
                disabled={markingAsRead}
                className="shrink-0 text-xs text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
              >
                {markingAsRead ? spinner : "Mark Read"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </EntityCard>
  );
};
