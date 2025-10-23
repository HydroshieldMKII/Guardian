import React from "react";
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
  Image,
} from "lucide-react";
import { getContentTitle, getDeviceIcon } from "./SharedComponents";
import { StreamQuality, StreamQualityDetails } from "./StreamQuality";
import { StreamDeviceInfo } from "./StreamDeviceInfo";
import { StreamProgress } from "./StreamProgress";
import { PlexSession } from "@/types";
import { config } from "../../lib/config";

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
  const thumbnailUrl = stream.thumbnailUrl || "";
  const artUrl = stream.artUrl || "";

  // Function to open content in Plex
  const openInPlex = async () => {
    // For music tracks, use the album's ratingKey (parentRatingKey) instead of the track's ratingKey
    let ratingKey = stream.ratingKey;

    if (stream.type === "track" && stream.parentRatingKey) {
      // Use album's rating key for music tracks if present
      ratingKey = stream.parentRatingKey;
    }

    if (!ratingKey) {
      console.warn("No rating key found for stream");
      return;
    }

    try {
      // Get the proper Plex web URL from backend
      const response = await fetch(`${config.api.baseUrl}/plex/web-url`);
      const data = await response.json();

      if (!data.webUrl) {
        console.warn("No Plex web URL available");
        return;
      }

      const serverIdentifier = stream.serverMachineIdentifier;

      if (!serverIdentifier) {
        console.error("No server machine identifier available");
        return;
      }

      // Use the server-specific URL format
      const plexUrl = `${data.webUrl}/web/index.html#!/server/${serverIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;

      // Open in new tab
      window.open(plexUrl, "_blank");
    } catch (error) {
      console.error("Failed to get Plex web URL:", error);
    }
  };

  return (
    <div
      key={stream.sessionKey || index}
      className={`relative p-3 sm:p-4 rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden ${artUrl ? "" : "border"}`}
      style={{
        backgroundImage: artUrl ? `url(${artUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Background overlay for better text readability */}
      {artUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30 backdrop-blur-[0.5px]" />
      )}
      {/* Responsive header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3">
        <div className={`flex flex-1 min-w-0 ${thumbnailUrl ? "gap-3" : ""}`}>
          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="flex-shrink-0 relative z-10">
              <div className="relative w-16 h-24 sm:w-20 sm:h-30 rounded-md overflow-hidden bg-muted border shadow-lg">
                <img
                  src={thumbnailUrl}
                  alt={getContentTitle(stream)}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const fallback = target.parentElement?.querySelector(
                      ".thumbnail-fallback"
                    ) as HTMLElement;
                    if (fallback) {
                      fallback.style.display = "flex";
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
          <div className="flex-1 min-w-0 relative z-10">
            <div
              className={`inline-block px-2 py-1 rounded-md cursor-pointer transition-all duration-200 bg-black/20 text-white hover:bg-black/30`}
            >
              <h3
                onClick={openInPlex}
                className="font-semibold text-sm sm:text-base break-words leading-tight"
                title={
                  stream.type === "track"
                    ? "Click to open album in Plex"
                    : "Click to open in Plex"
                }
              >
                {getContentTitle(stream)}
              </h3>
            </div>

            {/* Primary info row */}
            <div className="flex items-center gap-2 text-xs sm:text-sm my-2 flex-wrap">
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full min-w-0 transition-colors ${artUrl ? "bg-black/30 text-white" : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"}`}
              >
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-[150px]">
                  {stream.User?.title || "Unknown"}
                </span>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full min-w-0 transition-colors ${artUrl ? "bg-black/30 text-white" : "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300"}`}
              >
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
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all duration-200 ${
              stream.Player?.state === "playing"
                ? artUrl
                  ? "bg-black/30 text-white"
                  : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                : artUrl
                  ? "bg-black/30 text-white"
                  : "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300"
            }`}
          >
            {stream.Player?.state === "playing" ? (
              <Play className="w-3 h-3" />
            ) : (
              <Pause className="w-3 h-3" />
            )}
            <span>{stream.Player?.state || "unknown"}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Only show Remove Access button for non-Plexamp streams */}
            {stream.Player?.product !== "Plexamp" && (
              <div
                onClick={
                  !isRevoking &&
                  stream.User?.id &&
                  stream.Player?.machineIdentifier
                    ? onRemoveAccess
                    : undefined
                }
                className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                  isRevoking ||
                  !stream.User?.id ||
                  !stream.Player?.machineIdentifier
                    ? "opacity-50 cursor-not-allowed"
                    : artUrl
                      ? "bg-black/30 text-white hover:bg-red-500/30"
                      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50"
                }`}
                title={isRevoking ? "Removing access..." : "Remove access"}
              >
                {isRevoking ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </div>
            )}

            <div
              onClick={() => {
                if (
                  onNavigateToDevice &&
                  stream.User?.id &&
                  stream.Player?.machineIdentifier
                ) {
                  onNavigateToDevice(
                    stream.User.id,
                    stream.Player.machineIdentifier
                  );
                }
              }}
              className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                !stream.User?.id || !stream.Player?.machineIdentifier
                  ? "opacity-50 cursor-not-allowed"
                  : artUrl
                    ? "bg-black/30 text-white hover:bg-blue-500/30"
                    : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50"
              }`}
              title="View device details"
            >
              <UserRoundSearch className="w-3 h-3" />
            </div>

            <div
              onClick={onToggleExpand}
              className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${artUrl ? "bg-black/30 text-white hover:bg-white/20" : "bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950/50"}`}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10">
        <StreamProgress session={stream} />
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div
          className={`space-y-3 pt-3 border-t animate-in slide-in-from-top-2 duration-200 relative z-10 ${artUrl ? "border-white/30" : "border-border"}`}
        >
          <StreamQualityDetails session={stream} />
          <StreamDeviceInfo session={stream} />
        </div>
      )}
    </div>
  );
};
