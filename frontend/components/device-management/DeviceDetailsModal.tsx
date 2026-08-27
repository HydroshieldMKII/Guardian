import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import {
  Meta,
  MetaGrid,
  Panel,
  PillRow,
  Section,
  StatusPill,
  ToggleRow,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Pencil, RefreshCw } from "lucide-react";
import { UserDevice, AppSetting } from "@/types";
import {
  BYPASSED_BY_TEMPORARY_ACCESS,
  hasTemporaryAccess,
  isPlexampDevice,
  type PolicyBadge,
} from "@/lib/device-policies";
import { formatMinutes } from "@/lib/duration";
import { ClickableIP, DeviceStatus } from "./SharedComponents";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DeviceDetailsModalProps {
  device: UserDevice | null;
  isOpen: boolean;
  onClose: () => void;
  editingDevice: number | null;
  newDeviceName: string;
  actionLoading: number | null;
  onEdit: (device: UserDevice) => void;
  onCancelEdit: () => void;
  onRename: (deviceId: number, newName: string) => void;
  onNewDeviceNameChange: (name: string) => void;
  onDeviceUpdate?: (device: UserDevice) => void;
  onSetPending?: (deviceId: number) => Promise<boolean>;
  settingsData?: AppSetting[];
  policies?: PolicyBadge[];
}

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
  device,
  isOpen,
  onClose,
  editingDevice,
  newDeviceName,
  actionLoading,
  onEdit,
  onCancelEdit,
  onRename,
  onNewDeviceNameChange,
  onDeviceUpdate,
  onSetPending,
  settingsData,
  policies = [],
}) => {
  const { toast } = useToast();
  const [excludeLoading, setExcludeLoading] = useState(false);
  const [deletingNote, setDeletingNote] = useState(false);
  const [setPendingLoading, setSetPendingLoading] = useState(false);
  const [excludeFromConcurrentLimit, setExcludeFromConcurrentLimit] = useState(
    device?.excludeFromConcurrentLimit ?? false,
  );
  const [noteReadAt, setNoteReadAt] = useState<string | undefined>(
    device?.requestNoteReadAt,
  );

  const plexamp = device ? isPlexampDevice(device) : false;

  const isStrictModeEnabled =
    settingsData?.find((s) => s.key === "PLEX_GUARD_STRICT_MODE")?.value ===
    "true";

  // Sync local state when device prop changes
  React.useEffect(() => {
    if (device) {
      setExcludeFromConcurrentLimit(device.excludeFromConcurrentLimit ?? false);
      setNoteReadAt(device.requestNoteReadAt);
    }
  }, [
    device?.id,
    device?.excludeFromConcurrentLimit,
    device?.requestNoteReadAt,
  ]);

  if (!device) return null;

  const handleDeleteNote = async () => {
    setDeletingNote(true);
    try {
      await apiClient.deleteDeviceNote(device.id);
      setNoteReadAt(undefined);
      toast({
        title: "Note Deleted",
        description: "The note this user left on the device is gone for good.",
        variant: "success",
      });
      // Update parent state if callback provided
      if (onDeviceUpdate) {
        onDeviceUpdate({
          ...device,
          requestDescription: undefined,
          requestSubmittedAt: undefined,
          requestNoteReadAt: undefined,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete note",
        variant: "destructive",
      });
    } finally {
      setDeletingNote(false);
    }
  };

  const handleExcludeFromConcurrentLimitChange = async (exclude: boolean) => {
    setExcludeLoading(true);
    try {
      await apiClient.updateDeviceExcludeFromConcurrentLimit(
        device.id,
        exclude,
      );
      // Update local state immediately
      setExcludeFromConcurrentLimit(exclude);
      toast({
        title: "Success",
        description: exclude
          ? "Streams from this device no longer count towards the user's concurrent stream limit"
          : "Streams from this device now count towards the user's concurrent stream limit",
        variant: "success",
      });
      // Update the parent device state
      if (onDeviceUpdate) {
        onDeviceUpdate({ ...device, excludeFromConcurrentLimit: exclude });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update this device's settings",
        variant: "destructive",
      });
    } finally {
      setExcludeLoading(false);
    }
  };

  const handleSetPending = async () => {
    if (!onSetPending || !device) return;

    setSetPendingLoading(true);
    try {
      const success = await onSetPending(device.id);
      if (success) {
        toast({
          title: "Device Set to Pending",
          description:
            "This device is waiting for approval again and follows the user's default device policy until you decide.",
          variant: "success",
        });
        // Update parent state
        if (onDeviceUpdate) {
          onDeviceUpdate({ ...device, status: "pending" });
        }
        handleClose();
      } else {
        toast({
          title: "Error",
          description: "Failed to set device to pending",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to set device to pending",
        variant: "destructive",
      });
    } finally {
      setSetPendingLoading(false);
    }
  };

  const renaming = editingDevice === device.id;
  const busy = actionLoading === device.id;
  const spinner = <RefreshCw className="size-4 animate-spin" />;

  const handleClose = () => {
    if (renaming) {
      onCancelEdit();
    }
    onClose();
  };

  return (
    <Modal open={isOpen} onOpenChange={handleClose} size="lg">
      <ModalHeader
        title={device.deviceName || "Unknown"}
        titleHidden={renaming}
        titleSuffix={
          renaming ? (
            <>
              <Input
                value={newDeviceName}
                onChange={(e) => onNewDeviceNameChange(e.target.value)}
                className="h-8 min-w-40 flex-1"
                placeholder="Device name"
                aria-label="Device name"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => onRename(device.id, newDeviceName)}
                disabled={!newDeviceName.trim() || busy}
              >
                {busy ? spinner : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                disabled={busy}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(device)}
              aria-label="Rename"
              className="size-7 shrink-0 px-0 text-muted-foreground"
            >
              <Pencil className="size-3.5" />
            </Button>
          )
        }
      />

      <ModalBody>
        <MetaGrid className="sm:grid-cols-3">
          <Meta label="User">{device.username || device.userId}</Meta>
          <Meta label="Platform">{device.devicePlatform || "Unknown"}</Meta>
          <Meta label="Product">{device.deviceProduct || "Unknown"}</Meta>
          <Meta label="Version">{device.deviceVersion || "Unknown"}</Meta>
          <Meta label="IP Address">
            <ClickableIP ipAddress={device.ipAddress} />
          </Meta>
          <Meta label="Streams Started">{device.sessionCount}</Meta>
          <Meta label="First Seen">
            {new Date(device.firstSeen).toLocaleString()}
          </Meta>
          <Meta label="Last Seen">
            {new Date(device.lastSeen).toLocaleString()}
          </Meta>
          <Meta label="Status">
            <DeviceStatus device={device} />
          </Meta>
          <Meta label="Enforced Policies" wrap className="sm:col-span-3">
            {policies.length === 0 ? (
              <span className="text-muted-foreground">
                None. This device streams without restriction.
              </span>
            ) : (
              <PillRow>
                {policies.map(({ policy, label, tone, hint }) => (
                  <StatusPill key={policy} tone={tone} hint={hint}>
                    {label}
                  </StatusPill>
                ))}
              </PillRow>
            )}
          </Meta>
          <Meta label="Identifier" wrap className="sm:col-span-3">
            <span className="font-mono text-xs">{device.deviceIdentifier}</span>
          </Meta>
        </MetaGrid>

        {device.requestDescription &&
          device.requestSubmittedAt &&
          noteReadAt && (
            <Section title="User Note">
              <Panel>
                <p className="text-sm leading-relaxed text-foreground">
                  {device.requestDescription}
                </p>
              </Panel>
              <MetaGrid className="sm:grid-cols-2">
                <Meta label="Submitted">
                  {new Date(device.requestSubmittedAt).toLocaleString()}
                </Meta>
                <Meta label="Read">
                  {new Date(noteReadAt).toLocaleString()}
                </Meta>
              </MetaGrid>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteNote}
                disabled={deletingNote}
                className="w-full border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              >
                {deletingNote && spinner}
                Delete Note
              </Button>
            </Section>
          )}

        {(device.temporaryAccessUntil ||
          device.temporaryAccessGrantedAt ||
          device.temporaryAccessDurationMinutes) && (
          <Section title="Temporary Access">
            <MetaGrid className="sm:grid-cols-2">
              {device.temporaryAccessDurationMinutes && (
                <Meta label="Duration Granted">
                  {formatMinutes(device.temporaryAccessDurationMinutes)}
                </Meta>
              )}
              {device.temporaryAccessGrantedAt && (
                <Meta label="Granted At">
                  {new Date(device.temporaryAccessGrantedAt).toLocaleString()}
                </Meta>
              )}
              {device.temporaryAccessUntil && (
                <Meta
                  label={
                    hasTemporaryAccess(device) ? "Expires At" : "Expired At"
                  }
                >
                  {new Date(device.temporaryAccessUntil).toLocaleString()}
                </Meta>
              )}
              <Meta label="Policy Bypass">
                <StatusPill
                  tone={
                    device.temporaryAccessBypassPolicies ? "warning" : "neutral"
                  }
                  hint={
                    device.temporaryAccessBypassPolicies
                      ? `While this grant lasts, ${BYPASSED_BY_TEMPORARY_ACCESS} are not enforced against this device`
                      : "This grant does not lift any of the user's other policies"
                  }
                >
                  {device.temporaryAccessBypassPolicies
                    ? "Policies Bypassed"
                    : "Policies Enforced"}
                </StatusPill>
              </Meta>
            </MetaGrid>
          </Section>
        )}

        <Section title="Device Settings">
          {!plexamp && (
            <ToggleRow
              id="exclude-concurrent-limit"
              label="Exclude from concurrent stream limit"
              hint="Streams from this device stop counting towards the user's concurrent stream limit, and never block another device from starting."
              checked={excludeFromConcurrentLimit}
              onCheckedChange={handleExcludeFromConcurrentLimitChange}
              disabled={excludeLoading}
            />
          )}

          {!plexamp && device.status !== "pending" && onSetPending && (
            <Panel className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Set back to pending
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Undo your decision on this device. It follows the user's
                  default device policy until you approve or reject it again.
                </p>
              </div>
              {isStrictModeEnabled ? (
                <HintTooltip
                  side="top"
                  align="center"
                  triggerClassName="h-8 w-full cursor-not-allowed items-center justify-center whitespace-nowrap rounded-md border border-dashed bg-background px-3 text-sm font-medium text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                  hint="Strict mode is on, so every device is approved or rejected automatically using the default policy. Turn strict mode off in settings to move a device back to pending."
                >
                  Set to Pending
                </HintTooltip>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetPending}
                  disabled={setPendingLoading}
                  className="w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  {setPendingLoading && spinner}
                  Set to Pending
                </Button>
              )}
            </Panel>
          )}

          {plexamp && (
            <Panel>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Plex provides no way to terminate a Plexamp stream, so nothing
                can be enforced against this device. It is exempt from every
                policy, including the concurrent stream limit.
              </p>
            </Panel>
          )}
        </Section>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
