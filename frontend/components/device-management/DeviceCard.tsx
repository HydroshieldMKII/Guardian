import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  XCircle, 
  Trash2,
  RefreshCw,
  Timer,
  Eye,
  Monitor,
  MapPin,
  Activity,
  Clock
} from "lucide-react";
import { UserDevice, AppSetting } from '@/types';
import { getDeviceIcon, ClickableIP } from './SharedComponents';
import { useDeviceUtils } from '@/hooks/device-management/useDeviceUtils';

interface DeviceCardProps {
  device: UserDevice;
  settingsData?: AppSetting[];
  actionLoading: number | null;
  editingDevice: number | null;
  newDeviceName: string;
  onEdit: (device: UserDevice) => void;
  onCancelEdit: () => void;
  onRename: (deviceId: number, newName: string) => void;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onGrantTempAccess: (deviceId: number) => void;
  onRevokeTempAccess: (deviceId: number) => void;
  onShowDetails: (device: UserDevice) => void;
  onNewDeviceNameChange: (name: string) => void;
  shouldShowGrantTempAccess: (device: UserDevice) => boolean;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  settingsData,
  actionLoading,
  editingDevice,
  newDeviceName,
  onEdit,
  onCancelEdit,
  onRename,
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onGrantTempAccess,
  onRevokeTempAccess,
  onShowDetails,
  onNewDeviceNameChange,
  shouldShowGrantTempAccess,
}) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();

  return (
    <div
      className="relative group bg-gradient-to-br from-card to-card/80 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden backdrop-blur-sm"
      data-device-identifier={device.deviceIdentifier}
    >
      {/* Status indicator stripe */}
      <div className={`absolute top-0 left-0 w-full h-1 ${
        device.status === 'approved' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
        device.status === 'rejected' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
        'bg-gradient-to-r from-yellow-500 to-amber-500'
      }`} />
      

      {/* Mobile-first layout */}
      <div className="space-y-4 sm:space-y-0">
        {/* Mobile: Stacked layout */}
        <div className="sm:hidden p-4 pt-5 space-y-4">
          {/* Device Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 mt-0.5">
                {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h4 className="font-semibold text-foreground truncate text-base">
                    {device.deviceName || device.deviceIdentifier}
                  </h4>
                </div>
              </div>
            </div>
          </div>

          {/* Device Info Grid - Mobile */}
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Platform</span>
              </div>
              <span className="text-muted-foreground truncate ml-2">
                {device.devicePlatform || "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">IP Address</span>
              </div>
              <div className="ml-2">
                <ClickableIP ipAddress={device.ipAddress} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col p-2.5 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Streams</span>
                </div>
                <span className="font-semibold text-foreground">{device.sessionCount}</span>
              </div>
              <div className="flex flex-col p-2.5 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Last Seen</span>
                </div>
                <span className="font-semibold text-foreground text-xs">
                  {new Date(device.lastSeen).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Mobile */}
          <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
            {/* Details Button - Full width on mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowDetails(device)}
              className="text-sm px-4 py-2.5 w-full font-medium shadow-sm hover:shadow-md transition-shadow"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>

            {/* Action Buttons Row */}
            {device.status === "pending" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApprove(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm px-4 py-2.5 font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        <span>Approve</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onReject(device)}
                    disabled={actionLoading === device.id}
                    className="bg-red-600 text-white hover:bg-red-700 text-sm px-4 py-2.5 font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-1.5" />
                        <span>Reject</span>
                      </>
                    )}
                  </Button>
                </div>
                {/* Temporary Access Button */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-sm px-4 py-2.5 bg-orange-600 text-white hover:bg-orange-700 font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Timer className="w-4 h-4 mr-1.5" />
                        <span>Revoke temporary Access</span>
                      </>
                    )}
                  </Button>
                ) : shouldShowGrantTempAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGrantTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-sm px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    <Timer className="w-4 h-4 mr-1.5" />
                    <span>Grant Temporary Access</span>
                  </Button>
                ) : null}
              </div>
            ) : device.status === "rejected" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onToggleApproval(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-3 py-2"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        <span>Approve</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs px-3 py-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3 mr-1" />
                        <span>Delete</span>
                      </>
                    )}
                  </Button>
                </div>
                {/* Temporary Access Button for Rejected Devices */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-sm px-4 py-2.5 bg-orange-600 text-white hover:bg-orange-700 font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Timer className="w-4 h-4 mr-1.5" />
                        <span>Revoke temporary Access</span>
                      </>
                    )}
                  </Button>
                ) : shouldShowGrantTempAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGrantTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-sm px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    <Timer className="w-4 h-4 mr-1.5" />
                    <span>Grant Temporary Access</span>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleApproval(device)}
                  disabled={actionLoading === device.id}
                  className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-3 py-2"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      <span>Reject</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="text-xs px-3 py-2 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3 mr-1" />
                      <span>Delete</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Side-by-side layout */}
        <div className="hidden sm:flex sm:items-start sm:justify-between sm:gap-6 p-4 pt-5">
          <div className="flex-1 min-w-0">
            {/* Device Header */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground truncate text-base">
                    {device.deviceName || device.deviceIdentifier}
                  </h4>
                </div>
              </div>
            </div>
            {/* Device Info Grid - Desktop */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate font-medium text-foreground">
                  {device.devicePlatform || "Unknown Platform"}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <ClickableIP ipAddress={device.ipAddress} />
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {device.sessionCount} streams
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {new Date(device.lastSeen).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Desktop (Right side) */}
          <div className="flex flex-col gap-3 min-w-0 w-52">
            {/* Details Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowDetails(device)}
              className="text-sm px-3 py-2 w-full font-medium shadow-sm hover:shadow-md transition-all"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>

            {/* Action Buttons Row */}
            {device.status === "pending" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApprove(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm px-3 py-2 flex-1 font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onReject(device)}
                    disabled={actionLoading === device.id}
                    className="bg-red-600 text-white hover:bg-red-700 text-sm px-3 py-2 flex-1 font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
                {/* Temporary Access Button */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-2 py-1 bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Timer className="w-3 h-3 mr-1" />
                        Revoke temporary Access
                      </>
                    )}
                  </Button>
                ) : shouldShowGrantTempAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGrantTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                  >
                    <Timer className="w-3 h-3 mr-1" />
                    Temporary Access
                  </Button>
                ) : null}
              </div>
            ) : device.status === "rejected" ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onToggleApproval(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 py-1 flex-1"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs px-2 py-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
                {/* Temporary Access Button for Rejected Devices */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-2 py-1 bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Timer className="w-3 h-3 mr-1" />
                        Revoke temporary Access
                      </>
                    )}
                  </Button>
                ) : shouldShowGrantTempAccess(device) ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGrantTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                  >
                    <Timer className="w-3 h-3 mr-1" />
                    Temporary Access
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleApproval(device)}
                  disabled={actionLoading === device.id}
                  className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs px-2 py-1 flex-1"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="text-xs px-2 py-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};