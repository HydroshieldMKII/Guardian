import React from 'react';
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings,
  Edit2,
  Save,
  X,
  RefreshCw,
  Clock,
} from "lucide-react";
import { UserDevice } from '@/types';
import { ClickableIP, DeviceStatus } from './SharedComponents';
import { useDeviceUtils } from '@/hooks/device-management/useDeviceUtils';

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
}) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();

  if (!device) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base sm:text-lg text-foreground">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Device Details
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Detailed information about this device
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
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
                    disabled={!newDeviceName.trim() || actionLoading === device.id}
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
                  <p className="text-sm sm:text-base text-foreground break-words flex-1">
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
              <div><DeviceStatus device={device} /></div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground mb-2">
              Device Identifier
            </h4>
            <p className="text-xs font-mono bg-muted p-2 rounded break-all">
              {device.deviceIdentifier}
            </p>
          </div>

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

          {/* Temporary Access Section - Only show if device has or had temporary access */}
          {(device.temporaryAccessUntil || device.temporaryAccessGrantedAt || device.temporaryAccessDurationMinutes) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Temporary Access Information
                </h4>
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
                            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                          } else if (minutes < 1440) {
                            const hours = Math.floor(minutes / 60);
                            const remainingMinutes = minutes % 60;
                            let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
                            if (remainingMinutes > 0) {
                              result += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
                            }
                            return result;
                          } else {
                            const days = Math.floor(minutes / 1440);
                            const remainingHours = Math.floor((minutes % 1440) / 60);
                            let result = `${days} day${days !== 1 ? 's' : ''}`;
                            if (remainingHours > 0) {
                              result += ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
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
                        {new Date(device.temporaryAccessGrantedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  {device.temporaryAccessUntil && (
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                        {hasTemporaryAccess(device) ? "Expires At" : "Expired At"}
                      </h4>
                      <p className="text-xs sm:text-sm text-foreground">
                        {new Date(device.temporaryAccessUntil).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">
                      Current Status
                    </h4>
                    <div>
                      {hasTemporaryAccess(device) ? (
                        <Badge variant="default" className="bg-blue-600 dark:bg-blue-700 text-white">
                          <Clock className="w-3 h-3 mr-1" />
                          Active Temporary Access
                        </Badge>
                      ) : device.temporaryAccessUntil ? (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          Temporary Access Expired
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          No Temporary Access
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
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