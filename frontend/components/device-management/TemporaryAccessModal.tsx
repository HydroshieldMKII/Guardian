import React, { useState, useEffect } from 'react';
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
} from "lucide-react";
import { UserDevice } from '@/types';
import { getDeviceIcon } from './SharedComponents';
import { useDeviceUtils } from '@/hooks/device-management/useDeviceUtils';

interface TemporaryAccessModalProps {
  device: UserDevice | null;
  isOpen: boolean;
  onClose: () => void;
  onGrantAccess: (deviceId: number, durationMinutes: number) => void;
  actionLoading: number | null;
}

export const TemporaryAccessModal: React.FC<TemporaryAccessModalProps> = ({
  device,
  isOpen,
  onClose,
  onGrantAccess,
  actionLoading,
}) => {
  const [durationValue, setDurationValue] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks'>('hours');
  const { convertToMinutes, isValidDuration } = useDeviceUtils();

  // Reset duration values when modal opens
  useEffect(() => {
    if (isOpen) {
      setDurationValue(1);
      setDurationUnit('hours');
    }
  }, [isOpen]);

  const handleGrantAccess = () => {
    if (device && isValidDuration(durationValue, durationUnit)) {
      const totalMinutes = convertToMinutes(durationValue, durationUnit);
      onGrantAccess(device.id, totalMinutes);
    }
  };

  if (!device) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Grant Temporary Access
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Allow this device to stream temporarily. After the time expires, the device will revert to its default policy.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-3 sm:p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {device.deviceName || device.deviceIdentifier}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {device.username || device.userId}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Platform: {device.devicePlatform || "Unknown"} • Product: {device.deviceProduct || "Unknown"}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Duration</label>
            <div className="mt-2 flex gap-2">
              <Input
                type="text"
                value={durationValue === 0 ? '' : durationValue.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setDurationValue(0);
                  } else if (/^\d+$/.test(value)) {
                    const numValue = parseInt(value);
                    if (numValue >= 1 && numValue <= 999) {
                      setDurationValue(numValue);
                    }
                  }
                }}
                className="flex-1"
                placeholder="Enter duration"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[100px]">
                    {durationUnit}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setDurationUnit('minutes')}>
                    minutes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDurationUnit('hours')}>
                    hours
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDurationUnit('days')}>
                    days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDurationUnit('weeks')}>
                    weeks
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Quick preset buttons */}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Quick presets:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDurationValue(30); setDurationUnit('minutes'); }}
                  className="text-xs"
                >
                  30m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDurationValue(1); setDurationUnit('hours'); }}
                  className="text-xs"
                >
                  1h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDurationValue(3); setDurationUnit('hours'); }}
                  className="text-xs"
                >
                  3h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDurationValue(6); setDurationUnit('hours'); }}
                  className="text-xs"
                >
                  6h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDurationValue(1); setDurationUnit('days'); }}
                  className="text-xs"
                >
                  1d
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDurationValue(1); setDurationUnit('weeks'); }}
                  className="text-xs"
                >
                  1w
                </Button>
              </div>
            </div>
            
            <div className="mt-3">
              {!isValidDuration(durationValue, durationUnit) && durationValue > 0 && (
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
            disabled={actionLoading !== null || !isValidDuration(durationValue, durationUnit)}
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