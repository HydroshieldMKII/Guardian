import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  User, 
  RefreshCw, 
  X, 
  UserRoundSearch, 
  ChevronDown, 
  ChevronUp,
  Image
} from "lucide-react";
import { getContentTitle, getDeviceIcon } from './SharedComponents';
import { StreamQuality, StreamQualityDetails } from './StreamQuality';
import { StreamDeviceInfo } from './StreamDeviceInfo';
import { StreamProgress } from './StreamProgress';
import { PlexSession } from "@/types";
interface StreamCardProps {
  stream: PlexSession;
  index: number;
  isExpanded: boolean;
  isRevoking: boolean;
  onToggleExpand: () => void;
  onRemoveAccess: () => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  index,
  isExpanded,
  isRevoking,
  onToggleExpand,
  onRemoveAccess,
  onNavigateToDevice,
}) => {
  // Thumbnail as primary, fallback to art
  const mediaUrl = stream.thumbnailUrl || stream.artUrl || '';
  return (
    <div
      key={stream.sessionKey || index}
      className="relative p-3 sm:p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Responsive header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3">
        <div className="flex gap-3 flex-1 min-w-0">
          {/* Thumbnail */}
          {mediaUrl && (
            <div className="flex-shrink-0">
              <div className="relative w-16 h-24 sm:w-20 sm:h-30 rounded-md overflow-hidden bg-muted border">
                <img
                  src={mediaUrl}
                  alt={getContentTitle(stream)}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.parentElement?.querySelector('.thumbnail-fallback') as HTMLElement;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
                <div className="thumbnail-fallback absolute inset-0 hidden items-center justify-center bg-muted">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}
          
          {/* Content info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 text-sm sm:text-base break-words leading-tight">
              {getContentTitle(stream)}
            </h3>

          {/* Primary info row */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground my-2 flex-wrap">
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full min-w-0">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[150px]">
                {stream.User?.title || "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full min-w-0">
              {getDeviceIcon(stream.Player?.platform)}
              <span className="truncate max-w-[100px] sm:max-w-[120px]">
                {stream.Player?.title || "Device"}
              </span>
            </div>
          </div>

            {/* Quality info row - compact */}
            <StreamQuality session={stream} />
          </div>
        </div>

        {/* Status and actions */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto order-first sm:order-last">
          <Badge
            variant={
              stream.Player?.state === "playing"
                ? "default"
                : "secondary"
            }
            className="flex items-center text-xs"
          >
            {stream.Player?.state === "playing" ? (
              <Play className="w-3 h-3 mr-1" />
            ) : (
              <Pause className="w-3 h-3 mr-1" />
            )}
            {stream.Player?.state || "unknown"}
          </Badge>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveAccess}
              disabled={
                isRevoking ||
                !stream.User?.id ||
                !stream.Player?.machineIdentifier
              }
              className="h-6 w-6 p-0 text-muted-foreground text-red-600"
              title={isRevoking ? "Removing access..." : "Remove access"}
            >
              {isRevoking ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onNavigateToDevice && stream.User?.id && stream.Player?.machineIdentifier) {
                  onNavigateToDevice(stream.User.id, stream.Player.machineIdentifier);
                }
              }}
              disabled={!stream.User?.id || !stream.Player?.machineIdentifier}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600"
              title="View device details"
            >
              <UserRoundSearch className="w-3 h-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <StreamProgress session={stream} />

      {/* Expandable details */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-border animate-in slide-in-from-top-2 duration-200">
          <StreamQualityDetails session={stream} />
          <StreamDeviceInfo session={stream} />
        </div>
      )}
    </div>
  );
};