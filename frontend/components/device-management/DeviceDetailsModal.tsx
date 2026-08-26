import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CollapsibleSection,
  Meta,
  MetaGrid,
  Panel,
  StatusPill,
  ToggleRow,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { RefreshCw } from "lucide-react";
import { UserDevice, AppSetting } from "@/types";
import { ClickableIP, DeviceStatus } from "./SharedComponents";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
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
}) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();
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

  // Collapsible section states
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [identifierOpen, setIdentifierOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [tempAccessOpen, setTempAccessOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [userNoteOpen, setUserNoteOpen] = useState(false);

  // Tooltip state for strict mode disabled button
  const [strictModeTooltipOpen, setStrictModeTooltipOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check if device is Plexamp
  const isPlexampDevice =
    device?.deviceProduct?.toLowerCase().includes("plexamp") ||
    device?.deviceName?.toLowerCase().includes("plexamp");

  // Check if strict mode is enabled
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
        title: "Note deleted",
        description: "The user note has been permanently deleted.",
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
        description: `Device ${exclude ? "excluded from" : "included in"} concurrent stream limit`,
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
            : "Failed to update device setting",
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
          title: "Device set to pending",
          description: "The device has been moved back to pending status.",
          variant: "success",
        });
        // Update parent state
        if (onDeviceUpdate) {
          onDeviceUpdate({ ...device, status: "pending" });
        }
        onClose();
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

  if (!device) return null;

  const renaming = editingDevice === device.id;
  const busy = actionLoading === device.id;
  const spinner = <RefreshCw className="size-4 animate-spin" />;

  const formatGrantedDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return (
        `${hours} hour${hours === 1 ? "" : "s"}` +
        (rest > 0 ? ` ${rest} minute${rest === 1 ? "" : "s"}` : "")
      );
    }
    const days = Math.floor(minutes / 1440);
    const rest = Math.floor((minutes % 1440) / 60);
    return (
      `${days} day${days === 1 ? "" : "s"}` +
      (rest > 0 ? ` ${rest} hour${rest === 1 ? "" : "s"}` : "")
    );
  };

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title="Device Details"
        description={`Managed device for ${device.username || device.userId}.`}
      />

      <ModalBody className="space-y-3">
        <CollapsibleSection
          title="Basic Information"
          open={basicInfoOpen}
          onOpenChange={setBasicInfoOpen}
          status={<DeviceStatus device={device} compact />}
        >
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Device Name
              </p>
              {renaming ? (
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    value={newDeviceName}
                    onChange={(e) => onNewDeviceNameChange(e.target.value)}
                    className="flex-1"
                    placeholder="Enter device name"
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
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {device.deviceName || "Unknown"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(device)}
                    title="Rename device"
                  >
                    Rename
                  </Button>
                </div>
              )}
            </div>

            <MetaGrid className="sm:grid-cols-3">
              <Meta label="User">{device.username || device.userId}</Meta>
              <Meta label="Platform">{device.devicePlatform || "Unknown"}</Meta>
              <Meta label="Product">{device.deviceProduct || "Unknown"}</Meta>
              <Meta label="Version">{device.deviceVersion || "Unknown"}</Meta>
              <Meta label="IP Address">
                <ClickableIP ipAddress={device.ipAddress} />
              </Meta>
              <Meta label="Streams Started">{device.sessionCount}</Meta>
            </MetaGrid>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Device Identifier"
          open={identifierOpen}
          onOpenChange={setIdentifierOpen}
        >
          <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            {device.deviceIdentifier}
          </p>
        </CollapsibleSection>

        <CollapsibleSection
          title="Activity"
          open={activityOpen}
          onOpenChange={setActivityOpen}
        >
          <MetaGrid className="sm:grid-cols-2">
            <Meta label="First Seen">
              {new Date(device.firstSeen).toLocaleString()}
            </Meta>
            <Meta label="Last Seen">
              {new Date(device.lastSeen).toLocaleString()}
            </Meta>
          </MetaGrid>
        </CollapsibleSection>

        {device.requestDescription &&
          device.requestSubmittedAt &&
          noteReadAt && (
            <CollapsibleSection
              title="User Note"
              open={userNoteOpen}
              onOpenChange={setUserNoteOpen}
            >
              <div className="space-y-4">
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
              </div>
            </CollapsibleSection>
          )}

        {(device.temporaryAccessUntil ||
          device.temporaryAccessGrantedAt ||
          device.temporaryAccessDurationMinutes) && (
          <CollapsibleSection
            title="Temporary Access"
            open={tempAccessOpen}
            onOpenChange={setTempAccessOpen}
          >
            <MetaGrid className="sm:grid-cols-2">
              {device.temporaryAccessDurationMinutes && (
                <Meta label="Original Duration Granted">
                  {formatGrantedDuration(device.temporaryAccessDurationMinutes)}
                </Meta>
              )}
              {device.temporaryAccessGrantedAt && (
                <Meta label="Access Granted At">
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
              <Meta label="Bypass Policies">
                <StatusPill
                  tone={
                    device.temporaryAccessBypassPolicies ? "warning" : "danger"
                  }
                >
                  {device.temporaryAccessBypassPolicies ? "Yes" : "No"}
                </StatusPill>
              </Meta>
            </MetaGrid>
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="Device Settings"
          open={deviceSettingsOpen}
          onOpenChange={setDeviceSettingsOpen}
        >
          <div className="space-y-4">
            {!isPlexampDevice && (
              <ToggleRow
                id="exclude-concurrent-limit"
                label="Exclude from concurrent stream limit"
                hint="When enabled, streams from this device won't count towards the user's concurrent stream limit."
                checked={excludeFromConcurrentLimit}
                onCheckedChange={handleExcludeFromConcurrentLimitChange}
                disabled={excludeLoading}
              />
            )}

            {!isPlexampDevice &&
              device.status !== "pending" &&
              onSetPending && (
                <Panel className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Revert to pending status
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Move this device back to pending status. The device will
                      need to be approved again.
                    </p>
                  </div>
                  {isStrictModeEnabled ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip
                        open={strictModeTooltipOpen}
                        onOpenChange={(open) => {
                          if (!isMobile) {
                            setStrictModeTooltipOpen(open);
                          }
                        }}
                      >
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-full cursor-not-allowed items-center justify-center whitespace-nowrap rounded-md border border-dashed bg-background px-3 text-sm font-medium text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isMobile) {
                                setStrictModeTooltipOpen((prev) => !prev);
                              }
                            }}
                            onMouseEnter={() => {
                              if (!isMobile) setStrictModeTooltipOpen(true);
                            }}
                            onMouseLeave={() => {
                              if (!isMobile) setStrictModeTooltipOpen(false);
                            }}
                          >
                            Set to Pending
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          onPointerDownOutside={(e) => {
                            e.preventDefault();
                            setStrictModeTooltipOpen(false);
                          }}
                        >
                          <p className="max-w-xs">
                            Strict mode is enabled. Devices cannot be set to
                            pending as they will be automatically approved or
                            rejected based on the default policy.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

            {isPlexampDevice && (
              <Panel>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  PlexAmp devices are automatically excluded from all policy
                  checks including concurrent stream limits.
                </p>
              </Panel>
            )}
          </div>
        </CollapsibleSection>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
