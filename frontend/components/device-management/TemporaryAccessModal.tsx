import React, { useState, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Timer,
  RefreshCw,
  ChevronDown,
  Monitor,
  CheckCircle,
} from "lucide-react";
import { UserDevice } from "@/types";
import { getDeviceIcon } from "./SharedComponents";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import { Card, CardContent } from "@/components/ui/card";

interface TemporaryAccessModalProps {
  user: {
    userId: string;
    username?: string;
  } | null;
  userDevices: UserDevice[];
  isOpen: boolean;
  onClose: () => void;
  onGrantAccess: (deviceIds: number[], durationMinutes: number) => void;
  actionLoading: number | null;
  shouldShowGrantTempAccess: (device: UserDevice) => boolean;
}

export const TemporaryAccessModal: React.FC<TemporaryAccessModalProps> = ({
  user,
  userDevices,
  isOpen,
  onClose,
  onGrantAccess,
  actionLoading,
  shouldShowGrantTempAccess,
}) => {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [durationValue, setDurationValue] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<
    "minutes" | "hours" | "days" | "weeks"
  >("hours");
  const { convertToMinutes, isValidDuration, hasTemporaryAccess } =
    useDeviceUtils();

  // Get eligible devices for temporary access
  const eligibleDevices = userDevices.filter((device) =>
    shouldShowGrantTempAccess(device)
  );

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedDeviceIds([]);
      setDurationValue(1);
      setDurationUnit("hours");
    }
  }, [isOpen]);

  const handleDeviceToggle = (deviceId: number) => {
    setSelectedDeviceIds((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.length === eligibleDevices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(eligibleDevices.map((device) => device.id));
    }
  };

  const handleGrantAccess = () => {
    if (
      selectedDeviceIds.length > 0 &&
      isValidDuration(durationValue, durationUnit)
    ) {
      const totalMinutes = convertToMinutes(durationValue, durationUnit);
      onGrantAccess(selectedDeviceIds, totalMinutes);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Temporary Access
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Grant temporary streaming access to{" "}
            <span className="font-medium">{user.username || user.userId}</span>
            's devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Device Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-foreground flex items-center">
                <Monitor className="w-4 h-4 mr-2" />
                Select Devices ({selectedDeviceIds.length} selected)
              </h4>
              {eligibleDevices.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedDeviceIds.length === eligibleDevices.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              )}
            </div>

            {eligibleDevices.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-muted-foreground">
                  <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    No devices eligible for temporary access
                  </p>
                  <p className="text-xs mt-1">
                    Devices must be pending or rejected to grant temporary
                    access
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {eligibleDevices.map((device) => (
                  <Card
                    key={device.id}
                    className={`cursor-pointer transition-all border ${
                      selectedDeviceIds.includes(device.id)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm"
                        : "border-border hover:bg-muted/50 hover:border-muted-foreground/20"
                    }`}
                    onClick={() => handleDeviceToggle(device.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                              selectedDeviceIds.includes(device.id)
                                ? "border-blue-500 bg-blue-500"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {selectedDeviceIds.includes(device.id) && (
                              <CheckCircle className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                        {getDeviceIcon(
                          device.devicePlatform,
                          device.deviceProduct
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {device.deviceName || device.deviceIdentifier}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {device.devicePlatform} • {device.status}
                            {hasTemporaryAccess(device) && (
                              <span className="ml-2 text-blue-600 font-medium">
                                Has temporary access
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Duration Settings - Only show when devices are selected */}
          {selectedDeviceIds.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center">
                <Timer className="w-4 h-4 mr-2" />
                Access Duration
              </h4>

              <div className="space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">
                      Duration
                    </label>
                    <Input
                      type="number"
                      value={durationValue}
                      onChange={(e) => setDurationValue(Number(e.target.value))}
                      min="1"
                      max="999"
                      className="text-sm"
                      placeholder="Enter duration"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground">
                      Unit
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between text-sm"
                        >
                          {durationUnit}
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setDurationUnit("minutes")}
                        >
                          minutes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDurationUnit("hours")}
                        >
                          hours
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDurationUnit("days")}
                        >
                          days
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDurationUnit("weeks")}
                        >
                          weeks
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Quick Duration Buttons */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    Quick Select
                  </label>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDurationValue(1);
                        setDurationUnit("hours");
                      }}
                      className="text-xs"
                    >
                      1h
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDurationValue(3);
                        setDurationUnit("hours");
                      }}
                      className="text-xs"
                    >
                      3h
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDurationValue(6);
                        setDurationUnit("hours");
                      }}
                      className="text-xs"
                    >
                      6h
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDurationValue(1);
                        setDurationUnit("days");
                      }}
                      className="text-xs"
                    >
                      1d
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDurationValue(1);
                        setDurationUnit("weeks");
                      }}
                      className="text-xs"
                    >
                      1w
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  {!isValidDuration(durationValue, durationUnit) &&
                    durationValue > 0 && (
                      <p className="text-xs text-red-600">
                        Duration is too long (maximum: 1 year)
                      </p>
                    )}
                  {durationValue <= 0 && (
                    <p className="text-xs text-red-600">
                      Please enter a valid duration
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading !== null}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGrantAccess}
            disabled={
              actionLoading !== null ||
              selectedDeviceIds.length === 0 ||
              !isValidDuration(durationValue, durationUnit)
            }
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            {actionLoading ? (
              <>
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                Granting Access...
              </>
            ) : (
              <>
                <Timer className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Grant Access
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
