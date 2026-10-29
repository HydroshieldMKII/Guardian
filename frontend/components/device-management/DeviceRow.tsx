import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMenu, type Action } from "@/components/ui/action-menu";
import { Ban, Check, Info, RefreshCw, ShieldOff, Trash2 } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/entity";
import {
  hasTemporaryAccess,
  isPlexampDevice,
  isWaitingDevice,
  type PolicyBadge,
} from "@/lib/device-policies";
import { formatAgo } from "@/lib/duration";
import { UserDevice } from "@/types";
import { ClickableIP } from "./SharedComponents";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DeviceRowProps {
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

const STATUS: Record<string, { tone: Tone; label: string }> = {
  approved: { tone: "positive", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  pending: { tone: "warning", label: "Pending" },
};

const Fact = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="after:mx-1.5 after:text-muted-foreground/50 after:content-['·'] last:after:content-none">
    <dt className="sr-only">{label}</dt>
    <dd className="inline">{children}</dd>
  </div>
);

export const DeviceRow: React.FC<DeviceRowProps> = ({
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
      const readAt = new Date().toISOString();
      setNoteReadAt(readAt);
      onDeviceUpdate?.({ ...device, requestNoteReadAt: readAt });
      toast({
        title: "Note marked as read",
        description: "The user will see that you have read their note.",
        variant: "success",
      });
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
  const status = STATUS[device.status] ?? STATUS.pending;
  const pending = isWaitingDevice(device);
  const showsNote =
    Boolean(device.requestDescription) &&
    Boolean(device.requestSubmittedAt) &&
    !noteReadAt;
  const streams = device.sessionCount ?? 0;

  const actions: Action[] = [
    {
      label: "View details",
      icon: Info,
      tone: "neutral",
      onSelect: () => onShowDetails(device),
    },
  ];
  if (!plexAmp && device.status === "rejected") {
    actions.push({
      label: "Approve",
      icon: Check,
      tone: "positive",
      onSelect: () => onToggleApproval(device),
    });
  }
  if (!plexAmp && device.status === "approved") {
    actions.push({
      label: "Reject",
      icon: Ban,
      tone: "danger",
      onSelect: () => onToggleApproval(device),
    });
  }
  if (hasTemporaryAccess(device) && !plexAmp && device.status !== "approved") {
    actions.push({
      label: "Remove temporary access",
      icon: ShieldOff,
      tone: "warning",
      onSelect: () => onRemoveTemporaryAccess(device),
    });
  }

  return (
    <div
      id={`device-${device.id}`}
      data-device-identifier={device.deviceIdentifier}
      className="px-4 py-3.5 transition-shadow first:rounded-t-2xl last:rounded-b-2xl sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={() => onShowDetails(device)}
                className="min-w-0 cursor-pointer truncate text-left text-sm font-semibold text-foreground underline-offset-4 hover:underline"
              >
                {device.deviceName || "Unknown"}
              </button>
              {plexAmp && (
                <StatusPill
                  tone="accent"
                  size="sm"
                  hint="Plexamp devices are always allowed to stream"
                >
                  Plexamp
                </StatusPill>
              )}
              {!plexAmp && device.status !== "approved" && (
                <StatusPill
                  tone={status.tone}
                  size="sm"
                  hint={
                    status === STATUS.pending
                      ? "Waiting for your decision. Until then, this user's New devices rule applies."
                      : "This device is not allowed to stream"
                  }
                >
                  {status.label}
                </StatusPill>
              )}
              {policies.map(({ policy, label, tone, hint }) => (
                <StatusPill key={policy} tone={tone} size="sm" hint={hint}>
                  {label}
                </StatusPill>
              ))}
              {device.excludeFromConcurrentLimit && (
                <StatusPill
                  tone="neutral"
                  size="sm"
                  hint="Streams from this device are not counted towards the concurrent stream limit"
                >
                  Not counted in limit
                </StatusPill>
              )}
            </div>
            <dl className="mt-1 flex flex-wrap items-center gap-y-0.5 text-xs text-muted-foreground">
              <Fact label="Product">{device.deviceProduct || "Unknown"}</Fact>
              <Fact label="Platform">{device.devicePlatform || "Unknown"}</Fact>
              <Fact label="IP address">
                <ClickableIP ipAddress={device.ipAddress} />
              </Fact>
              <Fact label="Streams">
                {streams} {streams === 1 ? "stream" : "streams"}
              </Fact>
              <Fact label="Last seen">Seen {formatAgo(device.lastSeen)}</Fact>
            </dl>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {pending && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onReject(device)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onApprove(device)}
              >
                Approve
              </Button>
            </>
          )}
          <ActionMenu
            busy={busy}
            actions={actions}
            className="border-transparent bg-transparent shadow-none hover:border-input"
            destructive={{
              label: "Delete",
              icon: Trash2,
              tone: "danger",
              onSelect: () => onDelete(device),
            }}
          />
        </div>
      </div>

      {showsNote && (
        <div className="mt-3 rounded-lg bg-waiting/10 px-3 py-2.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-waiting">Note from user</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
                {device.requestDescription}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleMarkNoteAsRead()}
              disabled={markingAsRead}
              className="-ml-2.5 self-start text-xs text-waiting hover:bg-waiting/15 hover:text-waiting sm:ml-0 sm:shrink-0"
            >
              {markingAsRead ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                "Mark as read"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
