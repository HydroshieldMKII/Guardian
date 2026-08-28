import React from "react";
import { ActionMenu, type Action } from "@/components/ui/action-menu";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Disc3,
  LogOut,
  MonitorSmartphone,
  User,
} from "lucide-react";
import { EntityCard, EntityHeader } from "@/components/ui/entity";
import { getContentTitle } from "./SharedComponents";
import { StreamQuality, StreamQualityDetails } from "./StreamQuality";
import { StreamDeviceInfo } from "./StreamDeviceInfo";
import { StreamProgress } from "./StreamProgress";
import { PlexSession } from "@/types";
import { cn } from "@/lib/utils";
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
  const showDisc = stream.type === "track" && !overArt;

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

  const actions: Action[] = [
    {
      label: "Go to User",
      icon: User,
      disabled: !canSeeUser,
      onSelect: () => stream.User?.id && onNavigateToUser?.(stream.User.id),
    },
    {
      label: "Go to Device",
      icon: MonitorSmartphone,
      disabled: !canSeeDevice,
      onSelect: () =>
        stream.User?.id &&
        stream.Player?.machineIdentifier &&
        onNavigateToDevice?.(stream.User.id, stream.Player.machineIdentifier),
    },
    {
      label: isExpanded ? "Hide Details" : "View Details",
      icon: isExpanded ? ChevronsDownUp : ChevronsUpDown,
      onSelect: onToggleExpand,
    },
  ];

  return (
    <EntityCard
      key={stream.sessionKey || index}
      rail={false}
      className={overArt ? "bg-clip-padding text-white" : ""}
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

      {showDisc && (
        <Disc3
          aria-hidden
          data-testid="music-disc"
          className={cn(
            "pointer-events-none absolute -bottom-10 -right-8 size-44 text-muted-foreground/10",
            stream.Player?.state === "playing" &&
              "animate-spin [animation-duration:8s] motion-reduce:animate-none",
          )}
        />
      )}

      <div className="relative z-10 space-y-5 p-4 sm:space-y-6 sm:p-6">
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

          <div className="min-w-0 flex-1 space-y-2">
            <EntityHeader
              className={overArt ? "[&_h4]:text-white" : ""}
              title={
                <button
                  type="button"
                  onClick={openInPlex}
                  className="max-w-full cursor-pointer truncate text-left hover:underline"
                  title={
                    stream.type === "track"
                      ? "Open this album in Plex"
                      : "Open this in Plex"
                  }
                >
                  {getContentTitle(stream)}
                </button>
              }
              status={
                <ActionMenu
                  busy={isRevoking}
                  actions={actions}
                  destructive={
                    stream.Player?.product === "Plexamp"
                      ? undefined
                      : {
                          label: "Remove Access",
                          icon: LogOut,
                          tone: "danger",
                          disabled: !canRevoke,
                          onSelect: onRemoveAccess,
                        }
                  }
                  className={secondary}
                />
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`truncate text-xs sm:text-sm ${
                  overArt ? "text-white/70" : "text-muted-foreground"
                }`}
              >
                {[stream.User?.title || "Unknown", stream.Player?.title]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <StreamQuality session={stream} inline hasArt={overArt} />
            </div>
          </div>
        </div>

        <StreamProgress session={stream} hasArt={overArt} />

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
