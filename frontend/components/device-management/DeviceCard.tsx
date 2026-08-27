import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMenu, type Action } from "@/components/ui/action-menu";
import { Ban, Check, Info, RefreshCw, ShieldOff, Trash2 } from "lucide-react";
import { EntityCard, StatusPill, type Tone } from "@/components/ui/entity";
import { isPlexampDevice, type PolicyBadge } from "@/lib/device-policies";
import { UserDevice } from "@/types";
import { ClickableIP } from "./SharedComponents";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DeviceCardProps {
  device: UserDevice;
  policies?: PolicyBadge[];
  actionLoading: number | null;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onRemoveTemporaryAccess: (device: UserDevice) => void;
  onShowDetails: (device: UserDevice) => void;
  onDeviceUpdate?: (device: UserDevice) => void;
}

const STATUS_TONE: Record<string, Tone> = {
  approved: "positive",
  rejected: "danger",
  pending: "warning",
};

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
  policies = [],
  actionLoading,
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onRemoveTemporaryAccess,
  onShowDetails,
  onDeviceUpdate,
}) => {
  const { hasTemporaryAccess } = useDeviceUtils();
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
        title: "Note Marked as Read",
        description: "The user will see that you have read their note.",
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
            : "Failed to mark the note as read",
        variant: "destructive",
      });
    } finally {
      setMarkingAsRead(false);
    }
  };

  const plexAmp = isPlexampDevice(device);
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

  const decisions: Action[] = plexAmp
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

  const actions: Action[] = [
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
      label: "Remove Temporary Access",
      icon: ShieldOff,
      tone: "warning",
      onSelect: () => onRemoveTemporaryAccess(device),
    });
  }

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
              {plexAmp && (
                <StatusPill
                  tone="accent"
                  size="sm"
                  hint="Plexamp devices are always allowed to stream"
                >
                  Plexamp
                </StatusPill>
              )}
              {!plexAmp && device.status === "pending" && (
                <StatusPill
                  tone="warning"
                  size="sm"
                  hint="This device is waiting for your decision"
                >
                  Pending
                </StatusPill>
              )}
              {!plexAmp && device.status === "rejected" && (
                <StatusPill
                  tone="danger"
                  size="sm"
                  hint="This device is not allowed to stream"
                >
                  Rejected
                </StatusPill>
              )}
              {policies.map(({ policy, label, tone: pillTone, hint }) => (
                <StatusPill key={policy} tone={pillTone} size="sm" hint={hint}>
                  {label}
                </StatusPill>
              ))}
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

          <ActionMenu
            trigger="responsive"
            busy={busy}
            actions={actions}
            destructive={{
              label: "Delete",
              icon: Trash2,
              tone: "danger",
              onSelect: () => onDelete(device),
            }}
          />
        </div>

        {showsNote && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Note From User
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
                {markingAsRead ? spinner : "Mark as Read"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </EntityCard>
  );
};
