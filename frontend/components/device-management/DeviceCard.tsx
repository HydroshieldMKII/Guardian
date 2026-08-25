import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
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

  // Sync noteReadAt when device prop changes
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

  // Helper function to identify Plex Amp devices
  const isPlexAmpDevice = (device: UserDevice) => {
    return (
      device.deviceProduct?.toLowerCase().includes("plexamp") ||
      device.deviceName?.toLowerCase().includes("plexamp")
    );
  };

  const hasSeparateDeleteRow =
    !isPlexAmpDevice(device) && device.status === "pending";

  const renderDetailsButton = (compact: boolean) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onShowDetails(device)}
      className={`w-full font-medium shadow-sm hover:shadow-md ${
        compact
          ? "text-xs px-3 py-2 transition-shadow"
          : "text-sm px-3 py-2 transition-all"
      }`}
    >
      View Details
    </Button>
  );

  // Get device type badge
  const getDeviceTypeBadge = () => {
    if (isPlexAmpDevice(device)) {
      return (
        <Badge
          variant="outline"
          className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700"
        >
          Plex Amp
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
      >
        Plex
      </Badge>
    );
  };

  return (
    <div
      id={`device-${device.id}`}
      className="relative group bg-gradient-to-br from-card to-card/80 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden backdrop-blur-sm"
      data-device-identifier={device.deviceIdentifier}
    >
      {/* Status indicator stripe */}
      <div
        className={`absolute top-0 left-0 w-full h-1 ${
          isPlexAmpDevice(device)
            ? "bg-gradient-to-r from-purple-500 to-violet-500"
            : device.status === "approved"
              ? "bg-gradient-to-r from-green-500 to-emerald-500"
              : device.status === "rejected"
                ? "bg-gradient-to-r from-red-500 to-rose-500"
                : "bg-gradient-to-r from-yellow-500 to-amber-500"
        }`}
      />

      {/* Mobile-first layout */}
      <div className="space-y-3 sm:space-y-0">
        {/* Mobile: Stacked layout */}
        <div className="sm:hidden p-3 pt-4 space-y-3">
          {/* Device Header */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0 mt-0.5"></div>
                <div className="flex-1 min-w-0 max-w-[180px]">
                  <h4 className="font-semibold text-foreground truncate text-sm">
                    {device.deviceName || "Unknown"}
                  </h4>
                </div>
              </div>
            </div>

            {/* Badges - Mobile */}
            <div className="flex justify-start gap-1.5 flex-wrap">
              {getDeviceTypeBadge()}
              {hasTemporaryAccess(device) && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700"
                >
                  {getTemporaryAccessTimeLeft(device)}
                </Badge>
              )}
              {hasTemporaryAccess(device) &&
                device.temporaryAccessBypassPolicies && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                  >
                    Bypass
                  </Badge>
                )}
              {device.status === "approved" &&
                device.excludeFromConcurrentLimit && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700"
                  >
                    No Limit
                  </Badge>
                )}
            </div>
          </div>{" "}
          {/* Device Info Grid - Mobile */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 bg-muted/70 rounded-lg">
              <span className="truncate text-foreground">
                {device.devicePlatform || "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-muted/70 rounded-lg">
              <div className="truncate">
                <ClickableIP ipAddress={device.ipAddress} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-muted/70 rounded-lg">
              <span className="text-foreground">
                {device.sessionCount} streams
              </span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-muted/70 rounded-lg">
              <span className="text-foreground">
                {new Date(device.lastSeen).toLocaleDateString()}
              </span>
            </div>
          </div>
          {/* User Note - Mobile (only show unread notes) */}
          {device.requestDescription &&
            device.requestSubmittedAt &&
            !noteReadAt && (
              <div className="rounded-lg p-2.5 border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        User Note
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkNoteAsRead}
                        disabled={markingAsRead}
                        className="h-5 px-1.5 text-[10px] text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30"
                      >
                        {markingAsRead ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <>Mark Read</>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      {device.requestDescription}
                    </p>
                  </div>
                </div>
              </div>
            )}
          {/* Action Buttons - Mobile */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            {/* Action Buttons Row */}
            {isPlexAmpDevice(device) ? (
              // Plex Amp devices - only show delete button
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(device)}
                disabled={actionLoading === device.id}
                className="text-xs px-3 py-2 w-full border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
              >
                {actionLoading === device.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Delete</span>
                  </>
                )}
              </Button>
            ) : device.status === "pending" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApprove(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 py-1.5"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <span>Approve</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onReject(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs px-2 py-1.5 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <span>Reject</span>
                      </>
                    )}
                  </Button>
                </div>
                {renderDetailsButton(true)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="w-full text-xs px-3 py-2 border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>Delete</>
                  )}
                </Button>
                {/* Temporary Access Button */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-3 py-2 border-slate-600 text-slate-600 hover:bg-slate-100 dark:border-slate-400 dark:text-slate-400 dark:hover:bg-slate-900/20 font-medium"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Revoke Temp Access</span>
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            ) : device.status === "rejected" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onToggleApproval(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 py-1.5"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <span>Approve</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs px-2 py-1.5 border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <span>Delete</span>
                      </>
                    )}
                  </Button>
                </div>
                {/* Temporary Access Button for Rejected Devices */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-3 py-2 border-slate-600 text-slate-600 hover:bg-slate-100 dark:border-slate-400 dark:text-slate-400 dark:hover:bg-slate-900/20 font-medium"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Revoke Temp Access</span>
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onToggleApproval(device)}
                  disabled={actionLoading === device.id}
                  className="text-xs px-2 py-1.5 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Reject</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="text-xs px-2 py-1.5 border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Delete</span>
                    </>
                  )}
                </Button>
              </div>
            )}
            {!hasSeparateDeleteRow && renderDetailsButton(true)}
          </div>
        </div>

        {/* Desktop: Side-by-side layout */}
        <div className="hidden sm:flex sm:items-start sm:justify-between sm:gap-6 p-4 pt-5">
          <div className="flex-1 min-w-0">
            {/* Device Header */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0"></div>
                <div className="flex-1 min-w-0 max-w-[180px]">
                  <h4 className="font-semibold text-foreground truncate text-base">
                    {device.deviceName || "Unknown"}
                  </h4>
                </div>
              </div>
              {/* Badges - Desktop */}
              <div className="flex-shrink-0 flex gap-2 flex-wrap">
                {getDeviceTypeBadge()}
                {hasTemporaryAccess(device) && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700"
                  >
                    {getTemporaryAccessTimeLeft(device)}
                  </Badge>
                )}
                {hasTemporaryAccess(device) &&
                  device.temporaryAccessBypassPolicies && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                    >
                      Policy Bypass
                    </Badge>
                  )}
                {device.status === "approved" &&
                  device.excludeFromConcurrentLimit && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700"
                    >
                      No Stream Limit
                    </Badge>
                  )}
              </div>
            </div>
            {/* Device Info Grid - Desktop */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 p-2 bg-muted/70 rounded-lg">
                <span className="truncate font-medium text-foreground">
                  {device.devicePlatform || "Unknown Platform"}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/70 rounded-lg">
                <ClickableIP ipAddress={device.ipAddress} />
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/70 rounded-lg">
                <span className="font-medium text-foreground">
                  {device.sessionCount} streams
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/70 rounded-lg">
                <span className="font-medium text-foreground">
                  {new Date(device.lastSeen).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* User Note - Desktop (only show unread notes) */}
            {device.requestDescription &&
              device.requestSubmittedAt &&
              !noteReadAt && (
                <div className="mt-3 rounded-lg p-3 border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          User Note
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleMarkNoteAsRead}
                          disabled={markingAsRead}
                          className="h-6 px-2 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30"
                        >
                          {markingAsRead ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <>Mark as Read</>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {device.requestDescription}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Action Buttons - Desktop (Right side) */}
          <div className="flex flex-col gap-3 min-w-0 w-52">
            {/* Action Buttons Row */}
            {isPlexAmpDevice(device) ? (
              // Plex Amp devices - only show delete button
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(device)}
                disabled={actionLoading === device.id}
                className="text-sm px-3 py-2 w-full border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
              >
                {actionLoading === device.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>Delete</>
                )}
              </Button>
            ) : device.status === "pending" ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApprove(device)}
                    disabled={actionLoading === device.id}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 py-1 flex-1"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>Approve</>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onReject(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs px-2 py-1 flex-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>Reject</>
                    )}
                  </Button>
                </div>
                {renderDetailsButton(false)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="w-full text-sm px-4 py-2.5 border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Delete</>
                  )}
                </Button>
                {/* Temporary Access Button */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-2 py-1 border-slate-600 text-slate-600 hover:bg-slate-100 dark:border-slate-400 dark:text-slate-400 dark:hover:bg-slate-900/20"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>Revoke temporary Access</>
                    )}
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
                      <>Approve</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(device)}
                    disabled={actionLoading === device.id}
                    className="text-xs px-2 py-1 border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>Delete</>
                    )}
                  </Button>
                </div>
                {/* Temporary Access Button for Rejected Devices */}
                {hasTemporaryAccess(device) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRevokeTempAccess(device.id)}
                    disabled={actionLoading === device.id}
                    className="w-full text-xs px-2 py-1 border-slate-600 text-slate-600 hover:bg-slate-100 dark:border-slate-400 dark:text-slate-400 dark:hover:bg-slate-900/20"
                  >
                    {actionLoading === device.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>Revoke temporary Access</>
                    )}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onToggleApproval(device)}
                  disabled={actionLoading === device.id}
                  className="text-xs px-2 py-1 flex-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>Reject</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(device)}
                  disabled={actionLoading === device.id}
                  className="text-xs px-2 py-1 border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                >
                  {actionLoading === device.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>Delete</>
                  )}
                </Button>
              </div>
            )}
            {!hasSeparateDeleteRow && renderDetailsButton(false)}
          </div>
        </div>
      </div>
    </div>
  );
};
