import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings,
  Edit2,
  Save,
  X,
  RefreshCw,
  Clock,
  Users,
  ChevronDown,
  Monitor,
  Fingerprint,
  Activity,
  MessageSquare,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { UserDevice } from "@/types";
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
}) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();
  const { toast } = useToast();
  const [excludeLoading, setExcludeLoading] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [setPendingLoading, setSetPendingLoading] = useState(false);
  const [excludeFromConcurrentLimit, setExcludeFromConcurrentLimit] = useState(
    device?.excludeFromConcurrentLimit ?? false
  );
  const [noteReadAt, setNoteReadAt] = useState<string | undefined>(
    device?.requestNoteReadAt
  );

  // Collapsible section states
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [identifierOpen, setIdentifierOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [tempAccessOpen, setTempAccessOpen] = useState(true);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [userNoteOpen, setUserNoteOpen] = useState(false);

  // Check if device is Plexamp
  const isPlexampDevice =
    device?.deviceProduct?.toLowerCase().includes("plexamp") ||
    device?.deviceName?.toLowerCase().includes("plexamp");

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
      // Update parent state if callback provided
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

  const handleExcludeFromConcurrentLimitChange = async (exclude: boolean) => {
    setExcludeLoading(true);
    try {
      await apiClient.updateDeviceExcludeFromConcurrentLimit(
        device.id,
        exclude
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base sm:text-lg text-foreground text-left">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Device Details
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-left">
            Detailed information about this device
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Basic Information Section */}
          <Collapsible open={basicInfoOpen} onOpenChange={setBasicInfoOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="font-semibold text-sm">Basic Information</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  basicInfoOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 px-3">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Device Name
                  </h4>
                  {editingDevice === device.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newDeviceName}
                        onChange={(e) => onNewDeviceNameChange(e.target.value)}
                        className="text-sm flex-1"
                        placeholder="Enter device name"
                      />
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onRename(device.id, newDeviceName)}
                        disabled={
                          !newDeviceName.trim() || actionLoading === device.id
                        }
                        className="px-2"
                      >
                        {actionLoading === device.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onCancelEdit}
                        disabled={actionLoading === device.id}
                        className="px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm sm:text-base text-foreground break-words flex-1 max-w-[200px] truncate">
                        {device.deviceName || "Unknown"}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(device)}
                        className="px-2 h-6"
                        title="Rename device"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    User
                  </h4>
                  <p className="text-sm sm:text-base text-foreground break-words">
                    {device.username || device.userId}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Platform
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {device.devicePlatform || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Product
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {device.deviceProduct || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Version
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {device.deviceVersion || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    IP Address
                  </h4>
                  <div className="text-sm sm:text-base text-foreground">
                    <ClickableIP ipAddress={device.ipAddress} />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Streams Started
                  </h4>
                  <p className="text-sm sm:text-base text-foreground">
                    {device.sessionCount}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Status
                  </h4>
                  <div>
                    <DeviceStatus device={device} compact />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Device Identifier Section */}
          <Collapsible open={identifierOpen} onOpenChange={setIdentifierOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="font-semibold text-sm">Device Identifier</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  identifierOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 px-3">
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                {device.deviceIdentifier}
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Activity Section */}
          <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="font-semibold text-sm">Activity</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  activityOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 px-3">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    First Seen
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground">
                    {new Date(device.firstSeen).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                    Last Seen
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground">
                    {new Date(device.lastSeen).toLocaleString()}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* User Note Section - Only show if device has a note */}
          {device.requestDescription && device.requestSubmittedAt && (
            <Collapsible open={userNoteOpen} onOpenChange={setUserNoteOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">User Note</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    userNoteOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 px-3">
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-foreground">
                      {device.requestDescription}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Submitted:{" "}
                      {new Date(device.requestSubmittedAt).toLocaleString()}
                    </span>
                    {noteReadAt && (
                      <span>Read: {new Date(noteReadAt).toLocaleString()}</span>
                    )}
                  </div>
                  {!noteReadAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkNoteAsRead}
                      disabled={markingAsRead}
                      className="w-full border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
                    >
                      {markingAsRead ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCheck className="w-4 h-4 mr-2" />
                      )}
                      Mark as Read
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Temporary Access Section - Only show if device has or had temporary access */}
          {(device.temporaryAccessUntil ||
            device.temporaryAccessGrantedAt ||
            device.temporaryAccessDurationMinutes) && (
            <Collapsible open={tempAccessOpen} onOpenChange={setTempAccessOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    Temporary Access
                  </span>
                  {hasTemporaryAccess(device) && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-green-600 dark:border-green-700 text-green-700 dark:text-green-400"
                    >
                      Active
                    </Badge>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    tempAccessOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 px-3">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {device.temporaryAccessDurationMinutes && (
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                        Original Duration Granted
                      </h4>
                      <p className="text-sm sm:text-base text-foreground">
                        {(() => {
                          const minutes = device.temporaryAccessDurationMinutes;
                          if (minutes < 60) {
                            return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
                          } else if (minutes < 1440) {
                            const hours = Math.floor(minutes / 60);
                            const remainingMinutes = minutes % 60;
                            let result = `${hours} hour${hours !== 1 ? "s" : ""}`;
                            if (remainingMinutes > 0) {
                              result += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
                            }
                            return result;
                          } else {
                            const days = Math.floor(minutes / 1440);
                            const remainingHours = Math.floor(
                              (minutes % 1440) / 60
                            );
                            let result = `${days} day${days !== 1 ? "s" : ""}`;
                            if (remainingHours > 0) {
                              result += ` ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
                            }
                            return result;
                          }
                        })()}
                      </p>
                    </div>
                  )}

                  {device.temporaryAccessGrantedAt && (
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                        Access Granted At
                      </h4>
                      <p className="text-xs sm:text-sm text-foreground">
                        {new Date(
                          device.temporaryAccessGrantedAt
                        ).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {device.temporaryAccessUntil && (
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                        {hasTemporaryAccess(device)
                          ? "Expires At"
                          : "Expired At"}
                      </h4>
                      <p className="text-xs sm:text-sm text-foreground">
                        {new Date(device.temporaryAccessUntil).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                      Bypass Policies
                    </h4>
                    <div>
                      <Badge
                        variant="outline"
                        className={
                          device.temporaryAccessBypassPolicies
                            ? "border-amber-600 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                            : ""
                        }
                      >
                        {device.temporaryAccessBypassPolicies ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Device Settings Section */}
          <Collapsible
            open={deviceSettingsOpen}
            onOpenChange={setDeviceSettingsOpen}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="font-semibold text-sm">Device Settings</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  deviceSettingsOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 px-3 space-y-3">
              {/* Exclude from concurrent stream limit - Hide for PlexAmp devices since they're always excluded */}
              {!isPlexampDevice && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="exclude-concurrent-limit"
                        className="text-sm font-medium"
                      >
                        Exclude from concurrent stream limit
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, streams from this device won&apos;t count
                        towards the user&apos;s concurrent stream limit
                      </p>
                    </div>
                    <Switch
                      id="exclude-concurrent-limit"
                      checked={excludeFromConcurrentLimit}
                      onCheckedChange={handleExcludeFromConcurrentLimitChange}
                      disabled={excludeLoading}
                      className="cursor-pointer"
                    />
                  </div>
                )}
              {/* Set to pending - Hide for PlexAmp devices and only show if not already pending */}
              {!isPlexampDevice && device.status !== "pending" && onSetPending && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Revert to pending status
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Move this device back to pending status. The device will need to be approved again.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSetPending}
                      disabled={setPendingLoading}
                      className="w-full border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
                    >
                      {setPendingLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2" />
                      )}
                      Set to Pending
                    </Button>
                  </div>
                </div>
              )}
              {/* Show message for PlexAmp devices */}
              {isPlexampDevice && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    PlexAmp devices are automatically excluded from all policy
                    checks including concurrent stream limits.
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
