import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  ActionBar,
  EntityCard,
  EntityHeader,
  StatusPill,
} from "@/components/ui/entity";
import { getContentTitle } from "./SharedComponents";
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
  const thumbnailUrl = stream.thumbnailUrl || "";
  const artUrl = stream.artUrl || "";
  const overArt = Boolean(artUrl);

  const canSeeUser = Boolean(stream.User?.id);
  const canSeeDevice = Boolean(
    stream.User?.id && stream.Player?.machineIdentifier,
  );
  const canRevoke = canSeeDevice && !isRevoking;

  const openInPlex = async (e: React.MouseEvent) => {
    e.stopPropagation();

    let ratingKey = stream.ratingKey;
    if (stream.type === "track" && stream.parentRatingKey) {
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

    const newWindow = window.open("about:blank", "_blank");

    try {
      const response = await fetch(`${config.api.baseUrl}/plex/web-url`);
      const data = await response.json();

      if (!data.webUrl) {
        console.warn("No Plex web URL available");
        newWindow?.close();
        return;
      }

      const plexUrl = `${data.webUrl}/web/index.html#!/server/${serverIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;
      if (newWindow) {
        newWindow.location.href = plexUrl;
      }
    } catch (error) {
      console.error("Failed to get Plex web URL:", error);
      newWindow?.close();
    }
  };

  const secondary = overArt
    ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
    : "";

  return (
    <EntityCard
      key={stream.sessionKey || index}
      tone="info"
      className={overArt ? "border-transparent text-white" : ""}
      style={
        overArt
          ? {
              backgroundImage: `url(${artUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {overArt && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50"
        />
      )}

      <div className="relative z-10 space-y-5 p-4 pl-5 sm:space-y-6 sm:p-6 sm:pl-7">
        <div className="flex gap-4">
          {thumbnailUrl && (
            <div className="hidden shrink-0 sm:block">
              <div className="relative h-24 w-16 overflow-hidden rounded-lg border border-white/10 bg-muted shadow-md">
                <img
                  src={thumbnailUrl}
                  alt={getContentTitle(stream)}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-4">
            <EntityHeader
              className={overArt ? "[&_h4]:text-white [&_p]:text-white/70" : ""}
              title={
                <button
                  type="button"
                  onClick={openInPlex}
                  className="max-w-full truncate text-left hover:underline"
                  title={
                    stream.type === "track"
                      ? "Click to open album in Plex"
                      : "Click to open in Plex"
                  }
                >
                  {getContentTitle(stream)}
                </button>
              }
              subtitle={
                [stream.User?.title || "Unknown", stream.Player?.title]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              status={
                <StatusPill
                  tone="info"
                  dot
                  className={
                    overArt ? "border-white/25 bg-white/10 text-white" : ""
                  }
                >
                  Streaming
                </StatusPill>
              }
            />

            <StreamQuality session={stream} inline hasArt={overArt} />
          </div>
        </div>

        <StreamProgress session={stream} hasArt={overArt} />

        <ActionBar className={overArt ? "border-white/20" : ""}>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              stream.User?.id && onNavigateToUser?.(stream.User.id)
            }
            disabled={!canSeeUser}
            title="See User"
            className={`flex-1 sm:flex-none ${secondary}`}
          >
            See User
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              stream.User?.id &&
              stream.Player?.machineIdentifier &&
              onNavigateToDevice?.(
                stream.User.id,
                stream.Player.machineIdentifier,
              )
            }
            disabled={!canSeeDevice}
            title="See Device"
            className={`flex-1 sm:flex-none ${secondary}`}
          >
            See Device
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleExpand}
            className={`flex-1 sm:flex-none ${secondary}`}
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </Button>
          {stream.Player?.product !== "Plexamp" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => canRevoke && onRemoveAccess()}
              disabled={!canRevoke}
              title={isRevoking ? "Removing access..." : "Remove access"}
              className={`flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 sm:ml-auto sm:flex-none ${
                overArt
                  ? "border-rose-300/40 text-rose-200 hover:bg-rose-500/25"
                  : ""
              }`}
            >
              {isRevoking ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                "Remove Access"
              )}
            </Button>
          )}
        </ActionBar>

        {isExpanded && (
          <div className="animate-in fade-in slide-in-from-top-2 space-y-4 duration-200 motion-reduce:animate-none">
            <StreamQualityDetails session={stream} hasArt={overArt} />
            <StreamDeviceInfo session={stream} hasArt={overArt} />
          </div>
        )}
      </div>
    </EntityCard>
  );
};
