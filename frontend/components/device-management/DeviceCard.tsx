import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  ActionBar,
  EntityCard,
  EntityHeader,
  Meta,
  MetaGrid,
  PillRow,
  StatusPill,
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

  const spinner = <RefreshCw className="size-4 animate-spin" />;

  const action = (
    label: string,
    onClick: () => void,
    variant: "primary" | "danger" | "quiet" | "outline",
  ) => (
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={busy}
      className={
        variant === "primary"
          ? "flex-1 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-none"
          : variant === "danger"
            ? "flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 sm:flex-none"
            : "flex-1 sm:flex-none"
      }
    >
      {busy ? spinner : label}
    </Button>
  );

  const detailsButton = action(
    "View Details",
    () => onShowDetails(device),
    "outline",
  );
  const deleteButton = action("Delete", () => onDelete(device), "danger");
  const revokeButton = temporary
    ? action("Revoke Temp Access", () => onRevokeTempAccess(device.id), "quiet")
    : null;

  const actions = plexAmp ? (
    <>
      {deleteButton}
      {detailsButton}
    </>
  ) : device.status === "pending" ? (
    <>
      {action("Approve", () => onApprove(device), "primary")}
      {action("Reject", () => onReject(device), "danger")}
      {detailsButton}
      {deleteButton}
      {revokeButton}
    </>
  ) : device.status === "rejected" ? (
    <>
      {action("Approve", () => onToggleApproval(device), "primary")}
      {deleteButton}
      {detailsButton}
      {revokeButton}
    </>
  ) : (
    <>
      {action("Reject", () => onToggleApproval(device), "danger")}
      {deleteButton}
      {detailsButton}
    </>
  );

  return (
    <EntityCard
      id={`device-${device.id}`}
      tone={tone}
      data-device-identifier={device.deviceIdentifier}
    >
      <div className="space-y-5 p-4 pl-5 sm:space-y-6 sm:p-6 sm:pl-7">
        <EntityHeader
          title={device.deviceName || "Unknown"}
          subtitle={
            [device.deviceProduct, device.devicePlatform]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          status={
            <StatusPill tone={tone} dot>
              {plexAmp
                ? "Plex Amp"
                : (STATUS_LABEL[device.status] ?? device.status)}
            </StatusPill>
          }
        />

        {(temporary ||
          (device.status === "approved" &&
            device.excludeFromConcurrentLimit)) && (
          <PillRow>
            {temporary && (
              <StatusPill tone="info">
                {getTemporaryAccessTimeLeft(device)}
              </StatusPill>
            )}
            {temporary && device.temporaryAccessBypassPolicies && (
              <StatusPill tone="warning">Bypass</StatusPill>
            )}
            {device.status === "approved" &&
              device.excludeFromConcurrentLimit && (
                <StatusPill tone="neutral">No Limit</StatusPill>
              )}
          </PillRow>
        )}

        <MetaGrid>
          <Meta label="Platform">{device.devicePlatform || "Unknown"}</Meta>
          <Meta label="IP Address">
            <ClickableIP ipAddress={device.ipAddress} />
          </Meta>
          <Meta label="Streams">{device.sessionCount ?? 0}</Meta>
          <Meta label="Last Seen">
            {new Date(device.lastSeen).toLocaleDateString()}
          </Meta>
        </MetaGrid>

        {showsNote && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 sm:p-4">
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

        <ActionBar>{actions}</ActionBar>
      </div>
    </EntityCard>
  );
};
