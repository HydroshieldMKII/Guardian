import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  User,
  RefreshCw,
  X,
  UserRound,
  Monitor,
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
  onNavigateToUser?: (userId: string) => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  index,
  isExpanded,
  isRevoking,
  onToggleExpand,
  onRemoveAccess,
  onNavigateToDevice,
  onNavigateToUser,
}) => {
  // Separate thumbnail and art URLs
  const thumbnailUrl = stream.thumbnailUrl || "";
  const artUrl = stream.artUrl || "";

  // Function to open content in Plex
  const openInPlex = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expand on mobile

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

    const serverIdentifier = stream.serverMachineIdentifier;

    if (!serverIdentifier) {
      console.error("No server machine identifier available");
      return;
    }

    // Open a blank window immediately to avoid popup blockers on mobile
    // Mobile browsers block window.open() if it's not called directly in the click handler
    const newWindow = window.open("about:blank", "_blank");

    try {
      // Get the proper Plex web URL from backend
      const response = await fetch(`${config.api.baseUrl}/plex/web-url`);
      const data = await response.json();

      if (!data.webUrl) {
        console.warn("No Plex web URL available");
        newWindow?.close();
        return;
      }

      // Use the server-specific URL format
      const plexUrl = `${data.webUrl}/web/index.html#!/server/${serverIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;

      // Navigate the already-opened window to the Plex URL
      if (newWindow) {
        newWindow.location.href = plexUrl;
      }
    } catch (error) {
      console.error("Failed to get Plex web URL:", error);
      newWindow?.close();
    }
  };

  return (
    <div
      key={stream.sessionKey || index}
      className={`relative rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden p-3 sm:p-4 cursor-pointer sm:cursor-default ${artUrl ? "" : "border"}`}
      style={{
        backgroundImage: artUrl ? `url(${artUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      onClick={(e) => {
        // Only toggle expand on mobile when clicking the card background
        // Check if click is on the card itself, not on interactive elements
        const target = e.target as HTMLElement;
        const isInteractive =
          target.closest('button, [role="button"], a, [onclick]') ||
          target.tagName === "BUTTON" ||
          target.closest("[title]");
        if (!isInteractive && window.innerWidth < 640) {
          onToggleExpand();
        }
      }}
    >
      {/* Background overlay for better text readability */}
      {artUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30 backdrop-blur-[0.5px]" />
      )}

      {/* Main content layout */}
      <div className="relative z-10">
        {/* Desktop: 2-column layout, Mobile: stacked rows */}
        <div className="flex gap-2 sm:gap-4">
          {/* Left column: Poster (desktop only) */}
          {thumbnailUrl && (
            <div className="hidden sm:block flex-shrink-0">
              <div className="relative w-16 h-24 rounded-md overflow-hidden bg-muted border border-white/10 shadow-lg">
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

          {/* Middle column: Title + User/Device/Quality */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Title (+ Action icons on desktop, + User badge on mobile) */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              {/* Title */}
              <div
                className={`inline-block px-2 py-0.5 rounded-md cursor-pointer transition-all duration-200 min-w-0 flex-shrink ${
                  artUrl
                    ? "bg-black/60 text-white hover:bg-black/70"
                    : "bg-gray-200/80 dark:bg-muted/50 text-gray-900 dark:text-foreground hover:bg-gray-300/80 dark:hover:bg-muted/70"
                }`}
              >
                <h3
                  onClick={openInPlex}
                  className="font-semibold text-xs sm:text-sm leading-tight truncate"
                  title={
                    stream.type === "track"
                      ? "Click to open album in Plex"
                      : "Click to open in Plex"
                  }
                >
                  {getContentTitle(stream)}
                </h3>
              </div>

              {/* Spacer to push items to the right */}
              <div className="flex-1" />

              {/* Mobile only: User badge */}
              <div
                className={`flex sm:hidden items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                  artUrl
                    ? "bg-black/60 text-white"
                    : "bg-gray-200/80 dark:bg-muted/50 text-gray-900 dark:text-foreground"
                }`}
              >
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[80px]">
                  {stream.User?.title || "Unknown"}
                </span>
              </div>

              {/* Desktop only: Action Icons */}
              <div className="hidden sm:flex items-center gap-1.5">
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
                          ? "bg-red-600/80 text-white hover:bg-red-500"
                          : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50"
                    }`}
                    title={isRevoking ? "Removing access..." : "Remove access"}
                  >
                    {isRevoking ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </div>
                )}
                <div
                  onClick={() => {
                    if (onNavigateToUser && stream.User?.id) {
                      onNavigateToUser(stream.User.id);
                    }
                  }}
                  className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                    !stream.User?.id
                      ? "opacity-50 cursor-not-allowed"
                      : artUrl
                        ? "bg-black/60 text-white hover:bg-purple-500/50"
                        : "bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950/50"
                  }`}
                  title="Scroll to user"
                >
                  <UserRound className="w-3.5 h-3.5" />
                </div>
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
                        ? "bg-black/60 text-white hover:bg-blue-500/50"
                        : "bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950/50"
                  }`}
                  title="Scroll to device"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <div
                  onClick={onToggleExpand}
                  className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                    artUrl
                      ? "bg-black/60 text-white hover:bg-black/70"
                      : "bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-950/50"
                  }`}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: User (desktop only), Device, Quality specs */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2 mt-2">
              {/* User - hidden on mobile, shown on desktop */}
              <div
                className={`hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                  artUrl
                    ? "bg-black/60 text-white"
                    : "bg-gray-200/80 dark:bg-muted/50 text-gray-900 dark:text-foreground"
                }`}
              >
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px]">
                  {stream.User?.title || "Unknown"}
                </span>
              </div>

              {/* Device */}
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                  artUrl
                    ? "bg-black/60 text-white"
                    : "bg-gray-200/80 dark:bg-muted/50 text-gray-900 dark:text-foreground"
                }`}
              >
                {getDeviceIcon(stream.Player?.platform)}
                <span className="truncate max-w-[60px] sm:max-w-[100px]">
                  {stream.Player?.title || "Device"}
                </span>
              </div>

              {/* Separator dot - hidden on mobile */}
              <span
                className={`text-xs hidden sm:inline ${artUrl ? "text-white/50" : "text-gray-400 dark:text-gray-500"}`}
              >
                •
              </span>

              {/* Inline Quality */}
              <StreamQuality session={stream} inline hasArt={!!artUrl} />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10">
        <StreamProgress session={stream} hasArt={!!artUrl} />
      </div>

      {/* Mobile Navigation Buttons */}
      <div className="flex sm:hidden gap-2 mt-2 relative z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onNavigateToUser && stream.User?.id) {
              onNavigateToUser(stream.User.id);
            }
          }}
          disabled={!stream.User?.id}
          className={`flex-1 h-8 text-xs ${
            artUrl
              ? "!bg-black/60 !border-white/30 !text-white hover:!bg-black/70"
              : ""
          }`}
        >
          <UserRound className="w-3.5 h-3.5 mr-1.5" />
          Go to User
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
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
          disabled={!stream.User?.id || !stream.Player?.machineIdentifier}
          className={`flex-1 h-8 text-xs ${
            artUrl
              ? "!bg-black/60 !border-white/30 !text-white hover:!bg-black/70"
              : ""
          }`}
        >
          <Monitor className="w-3.5 h-3.5 mr-1.5" />
          Go to Device
        </Button>
        {stream.Player?.product !== "Plexamp" && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (
                !isRevoking &&
                stream.User?.id &&
                stream.Player?.machineIdentifier
              ) {
                onRemoveAccess();
              }
            }}
            disabled={
              isRevoking ||
              !stream.User?.id ||
              !stream.Player?.machineIdentifier
            }
            className={`h-8 w-8 p-0 ${
              artUrl
                ? "!bg-black/60 !border-white/30 !text-white hover:!bg-red-500/70"
                : "hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-950/30 dark:hover:text-red-300 dark:hover:border-red-800"
            }`}
          >
            {isRevoking ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div
          className={`space-y-2 sm:space-y-3 mt-2 sm:mt-0 pt-2 sm:pt-3 border-t animate-in slide-in-from-top-2 duration-200 relative z-10 ${artUrl ? "border-white/30" : "border-border"}`}
        >
          <StreamQualityDetails session={stream} hasArt={!!artUrl} />
          <StreamDeviceInfo session={stream} hasArt={!!artUrl} />
        </div>
      )}
    </div>
  );
};
