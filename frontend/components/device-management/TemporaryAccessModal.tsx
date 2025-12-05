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
  Calendar as CalendarIcon,
} from "lucide-react";
import { UserDevice } from "@/types";
import { getDeviceIcon } from "./SharedComponents";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TemporaryAccessModalProps {
  user: {
    userId: string;
    username?: string;
  } | null;
  userDevices: UserDevice[];
  isOpen: boolean;
  onClose: () => void;
  onGrantAccess: (
    deviceIds: number[],
    durationMinutes: number,
    bypassPolicies?: boolean
  ) => void;
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
  const [bypassPolicies, setBypassPolicies] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<"duration" | "calendar">(
    "duration"
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const { convertToMinutes, isValidDuration, hasTemporaryAccess } =
    useDeviceUtils();

  // Check if the calculated expiry date is valid
  const getExpiryDate = (): Date | null => {
    if (inputMode === "calendar") {
      if (!selectedDate) return null;
      // Ensure the selected date is in the future
      if (selectedDate.getTime() <= Date.now()) return null;
      return selectedDate;
    }

    if (durationValue <= 0 || !isValidDuration(durationValue, durationUnit)) {
      return null;
    }
    const totalMinutes = convertToMinutes(durationValue, durationUnit);
    const expiryDate = new Date(Date.now() + totalMinutes * 60 * 1000);
    // Check if the date is valid (not NaN or beyond JS max date)
    if (
      isNaN(expiryDate.getTime()) ||
      expiryDate.getTime() > 8640000000000000
    ) {
      return null;
    }
    return expiryDate;
  };

  const isExpiryDateValid = getExpiryDate() !== null;

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
      setBypassPolicies(false);
      setInputMode("duration");
      setSelectedDate(undefined);
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
    if (selectedDeviceIds.length === 0 || !isExpiryDateValid) return;

    let totalMinutes: number;
    if (inputMode === "calendar" && selectedDate) {
      // Calculate minutes from now until selected date
      totalMinutes = Math.ceil(
        (selectedDate.getTime() - Date.now()) / (60 * 1000)
      );
    } else {
      totalMinutes = convertToMinutes(durationValue, durationUnit);
    }

    onGrantAccess(selectedDeviceIds, totalMinutes, bypassPolicies);
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
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center">
                  <Timer className="w-4 h-4 mr-2" />
                  Access Duration
                </h4>
                <div className="flex gap-2">
                  <Button
                    variant={inputMode === "duration" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInputMode("duration")}
                    className="text-xs"
                  >
                    <Timer className="w-3 h-3 mr-1" />
                    Duration
                  </Button>
                  <Button
                    variant={inputMode === "calendar" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInputMode("calendar")}
                    className="text-xs"
                  >
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    Calendar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {inputMode === "duration" ? (
                  <>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">
                          Duration
                        </label>
                        <Input
                          type="number"
                          value={durationValue}
                          onChange={(e) =>
                            setDurationValue(Number(e.target.value))
                          }
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
                  </>
                ) : (
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">
                      Select Expiry Date & Time
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? (
                            selectedDate.toLocaleString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          ) : (
                            <span>Pick a date and time</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            if (date) {
                              // Set time to current time + 1 hour by default
                              const now = new Date();
                              date.setHours(now.getHours() + 1);
                              date.setMinutes(now.getMinutes());
                              setSelectedDate(date);
                            } else {
                              setSelectedDate(undefined);
                            }
                          }}
                          disabled={(date) => date < new Date()}
                          autoFocus
                        />
                        {selectedDate && (
                          <div className="p-3 border-t">
                            <label className="text-xs text-muted-foreground mb-2 block">
                              Time
                            </label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                value={selectedDate.getHours()}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const newDate = new Date(selectedDate);
                                  newDate.setHours(
                                    Math.min(23, Math.max(0, hours))
                                  );
                                  setSelectedDate(newDate);
                                }}
                                className="w-16 text-center"
                                placeholder="HH"
                              />
                              <span className="self-center">:</span>
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                value={selectedDate.getMinutes()}
                                onChange={(e) => {
                                  const minutes = parseInt(e.target.value) || 0;
                                  const newDate = new Date(selectedDate);
                                  newDate.setMinutes(
                                    Math.min(59, Math.max(0, minutes))
                                  );
                                  setSelectedDate(newDate);
                                }}
                                className="w-16 text-center"
                                placeholder="MM"
                              />
                            </div>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="mt-3">
                  {inputMode === "duration" && durationValue <= 0 && (
                    <p className="text-xs text-red-600">
                      Please enter a valid duration
                    </p>
                  )}

                  {inputMode === "calendar" &&
                    selectedDate &&
                    selectedDate.getTime() <= Date.now() && (
                      <p className="text-xs text-red-600">
                        Selected date must be in the future
                      </p>
                    )}

                  {/* Expiry Preview */}
                  {((inputMode === "duration" &&
                    durationValue > 0 &&
                    isValidDuration(durationValue, durationUnit)) ||
                    (inputMode === "calendar" && selectedDate)) && (
                    <>
                      {isExpiryDateValid ? (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Access will expire at:
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {getExpiryDate()!.toLocaleString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              timeZoneName: "short",
                            })}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                          <p className="text-xs text-red-600">
                            Duration is too large. Please enter a smaller value.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Policy Bypass Option */}
          {selectedDeviceIds.length > 0 && (
            <div className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-1">
                    Policy Bypass
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Allow access even if IP restrictions, time rules, or other
                    user policies would normally block the device.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="bypass-policies"
                    checked={bypassPolicies}
                    onCheckedChange={setBypassPolicies}
                  />
                  <Label
                    htmlFor="bypass-policies"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Bypass all user policies during temporary access
                  </Label>
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
              !isValidDuration(durationValue, durationUnit) ||
              !isExpiryDateValid
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
