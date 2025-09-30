import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, 
  XCircle, 
  Trash2,
  Edit2,
  Save,
  X,
  RefreshCw,
  Timer,
  Eye,
  Clock,
  Info,
  Monitor,
  MapPin,
  Activity
} from "lucide-react";
import { UserDevice, AppSetting } from '@/types';
import { getDeviceIcon, DeviceStatus, ClickableIP } from './SharedComponents';
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
      
      {/* Temporary access indicator */}
      {hasTemporaryAccess(device) && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/90 text-white text-xs rounded-full backdrop-blur-sm border border-blue-400/20">
            <Timer className="w-3 h-3" />
            <span className="font-medium">{getTemporaryAccessTimeLeft(device)}</span>
          </div>
        </div>
      )}

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
                  {editingDevice === device.id ? (
                    <div className="flex items-center gap-2 flex-1">
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
                    <>
                      <h4 className="font-semibold text-foreground truncate text-base">
                        {device.deviceName || device.deviceIdentifier}
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(device)}
                        className="px-1 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Rename device"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
                <DeviceStatus device={device} />
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
                        <span>Revoke Temp Access</span>
                      </>
                    )}
                  </Button>
                ) : (
                  shouldShowGrantTempAccess(device) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onGrantTempAccess(device.id)}
                      disabled={actionLoading === device.id}
                      className="w-full text-sm px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      {actionLoading === device.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Timer className="w-4 h-4 mr-1.5" />
                          <span>Grant Temp Access</span>
                        </>
                      )}
                    </Button>
                  )
                )}
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        <span>Delete</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant={device.status === "approved" ? "default" : "default"}
                  size="sm"
                  onClick={() => onToggleApproval(device)}
                  disabled={actionLoading === device.id}
                  className={`w-full text-sm px-4 py-2.5 font-medium shadow-sm hover:shadow-md transition-all ${
                    device.status === "approved" 
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : device.status === "approved" ? (
                    <>
                      <XCircle className="w-4 h-4 mr-1.5" />
                      <span>Reject</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      <span>Approve</span>
                    </>
                  )}
                </Button>
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
                        <span>Revoke Temp Access</span>
                      </>
                    )}
                  </Button>
                ) : (
                  shouldShowGrantTempAccess(device) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onGrantTempAccess(device.id)}
                      disabled={actionLoading === device.id}
                      className="w-full text-sm px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      {actionLoading === device.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Timer className="w-4 h-4 mr-1.5" />
                          <span>Grant Temp Access</span>
                        </>
                      )}
                    </Button>
                  )
                )}
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        <span>Delete</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Inline layout - TODO: Add desktop layout matching original */}
        <div className="hidden sm:block">
          {/* Keep existing desktop layout for now */}
          <div className="p-4 pb-2 sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Device identification */}
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                {getDeviceIcon(device.devicePlatform, device.deviceProduct)}
                <div className="min-w-0 flex-1">
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
                      <h4 className="font-medium text-sm sm:text-base text-foreground truncate flex-1">
                        {device.deviceName || device.deviceIdentifier}
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(device)}
                        className="px-1 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Rename device"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs sm:text-sm text-muted-foreground truncate mt-1">
                    {device.devicePlatform && device.deviceProduct ? 
                      `${device.devicePlatform} • ${device.deviceProduct}` : 
                      device.devicePlatform || device.deviceProduct || "Unknown Device"
                    }
                    {device.deviceVersion && ` • v${device.deviceVersion}`}
                  </p>
                </div>
              </div>

              {/* Status badge - Desktop */}
              <div className="flex items-center gap-2">
                <DeviceStatus device={device} />
              </div>
            </div>
          </div>

          {/* Device details - Desktop grid */}
          <div className="px-4 pb-2">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">IP Address:</span>
                <div className="font-medium truncate mt-0.5">
                  <ClickableIP ipAddress={device.ipAddress} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Sessions:</span>
                <div className="font-medium mt-0.5">{device.sessionCount}</div>
              </div>
              <div>
                <span className="text-muted-foreground">First Seen:</span>
                <div className="font-medium mt-0.5">
                  {new Date(device.firstSeen).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Last Seen:</span>
                <div className="font-medium mt-0.5">
                  {new Date(device.lastSeen).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons - Desktop */}
          <div className="px-4 pb-4">
            <div className="flex gap-2 items-center justify-between">
              {/* Primary actions */}
              <div className="flex gap-2">
                {device.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onApprove(device)}
                      disabled={actionLoading === device.id}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs"
                    >
                      {actionLoading === device.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(device)}
                      disabled={actionLoading === device.id}
                      className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20 text-xs"
                    >
                      {actionLoading === device.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      Reject
                    </Button>
                  </>
                )}

                {device.status !== "pending" && (
                  <Button
                    size="sm"
                    variant={device.status === "approved" ? "outline" : "default"}
                    onClick={() => onToggleApproval(device)}
                    disabled={actionLoading === device.id}
                    className={`text-xs ${
                      device.status === "approved"
                        ? "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : device.status === "approved" ? (
                      <XCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    )}
                    {device.status === "approved" ? "Reject" : "Approve"}
                  </Button>
                )}
              </div>

              {/* Secondary actions */}
              <div className="flex gap-1">
                {/* Temporary Access Controls */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="text-xs"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Clock className="w-3 h-3 mr-1" />
                    )}
                    Revoke Access
                  </Button>
                ) : (
                  shouldShowGrantTempAccess(device) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGrantTempAccess(device.id)}
                      disabled={actionLoading === device.id}
                      className="text-xs border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-700 dark:hover:bg-blue-900/20"
                    >
                      {actionLoading === device.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Timer className="w-3 h-3 mr-1" />
                      )}
                      Grant Temp Access
                    </Button>
                  )
                )}

                {/* Details and Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShowDetails(device)}
                  className="px-2 h-8 text-xs"
                >
                  <Eye className="w-3 h-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="px-2 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};