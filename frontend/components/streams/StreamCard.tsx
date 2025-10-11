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
  // Separate thumbnail and art URLs
  const thumbnailUrl = stream.thumbnailUrl || '';
  const artUrl = stream.artUrl || '';
  
  return (
    <div
      key={stream.sessionKey || index}
      className="relative p-3 sm:p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      style={{
        backgroundImage: artUrl ? `url(${artUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Background overlay for better text readability */}
      {artUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30 backdrop-blur-[0.5px]" />
      )}
      {/* Responsive header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3">
        <div className="flex gap-3 flex-1 min-w-0">
          {/* Thumbnail */}
          <div className="flex-shrink-0 relative z-10">
            <div className="relative w-16 h-24 sm:w-20 sm:h-30 rounded-md overflow-hidden bg-muted border shadow-lg">
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
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
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
          
          {/* Content info */}
          <div className="flex-1 min-w-0 relative z-10">
            <h3 className={`font-semibold mb-1 text-sm sm:text-base break-words leading-tight ${artUrl ? 'text-white' : 'text-foreground'}`}>
              {getContentTitle(stream)}
            </h3>

          {/* Primary info row */}
          <div className="flex items-center gap-2 text-xs sm:text-sm my-2 flex-wrap">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full min-w-0 ${artUrl ? 'bg-black/30 text-white' : 'bg-muted text-muted-foreground'}`}>
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[150px]">
                {stream.User?.title || "Unknown"}
              </span>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full min-w-0 ${artUrl ? 'bg-black/30 text-white' : 'bg-muted text-muted-foreground'}`}>
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
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto order-first sm:order-last relative z-10">
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
              className={`h-6 w-6 p-0 ${artUrl ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}
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
              className={`h-6 w-6 p-0 ${artUrl ? 'text-blue-400 hover:text-blue-300' : 'text-muted-foreground hover:text-blue-600'}`}
              title="View device details"
            >
              <UserRoundSearch className="w-3 h-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className={`h-6 w-6 p-0 ${artUrl ? 'text-white hover:text-gray-200' : 'text-muted-foreground hover:text-foreground'}`}
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
      <div className="relative z-10">
        <StreamProgress session={stream} />
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className={`space-y-3 pt-3 border-t animate-in slide-in-from-top-2 duration-200 relative z-10 ${artUrl ? 'border-white/30' : 'border-border'}`}>
          <StreamQualityDetails session={stream} />
          <StreamDeviceInfo session={stream} />
        </div>
      )}
    </div>
  );
};