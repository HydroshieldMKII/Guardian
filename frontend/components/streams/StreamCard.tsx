import React, { useState } from "react";
import { ActionMenu, type Action } from "@/components/ui/action-menu";
import {
  ChevronDown,
  Disc3,
  LogOut,
  MonitorSmartphone,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityCard, EntityHeader } from "@/components/ui/entity";
import { getContentLines, getContentTitle } from "./SharedComponents";
import { StreamQualityDetails } from "./StreamQuality";
import { StreamDeviceInfo } from "./StreamDeviceInfo";
import { StreamProgress } from "./StreamProgress";
import { PlexSession } from "@/types";
import { cn } from "@/lib/utils";
import { config } from "../../lib/config";

interface PlexWebUrlResponse {
  webUrl?: string;
}

type PosterShape = "portrait" | "square" | "landscape";

const POSTER_FRAME: Record<PosterShape, string> = {
  portrait: "aspect-[2/3] w-16 sm:w-[4.5rem]",
  square: "aspect-square w-16 sm:w-[6.75rem]",
  landscape: "aspect-video w-28 sm:w-40",
};

const expectedShape = (type?: string): PosterShape => {
  if (type === "track") return "square";
  if (type === "episode") return "landscape";
  return "portrait";
};

const measuredShape = (width: number, height: number): PosterShape => {
  const ratio = width / height;
  if (ratio < 0.85) return "portrait";
  if (ratio > 1.2) return "landscape";
  return "square";
};

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
  const backdropUrl = stream.artUrl || "";
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const [loadedPoster, setLoadedPoster] = useState<string | null>(null);
  const [posterShape, setPosterShape] = useState<PosterShape>(() =>
    expectedShape(stream.type),
  );
  const [failedArt, setFailedArt] = useState<string | null>(null);
  const [loadedArt, setLoadedArt] = useState<string | null>(null);

  const posterUrl = failedPoster === thumbnailUrl ? "" : thumbnailUrl;
  const posterLoaded = loadedPoster === thumbnailUrl;
  const artUrl = failedArt === backdropUrl ? "" : backdropUrl;
  const artLoaded = loadedArt === backdropUrl;
  const overArt = Boolean(artUrl);
  const isMusic = stream.type === "track";
  const showDisc = isMusic && !overArt;
  const lines = getContentLines(stream);

  const userName = stream.User?.title || "Unknown";
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
      const data = (await response.json()) as PlexWebUrlResponse;

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
    ? "border-white/20 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white dark:bg-black/50 dark:hover:bg-black/70"
    : "";

  const actions: Action[] = [
    {
      label: "Go to user",
      icon: User,
      disabled: !canSeeUser,
      onSelect: () => stream.User?.id && onNavigateToUser?.(stream.User.id),
    },
    {
      label: "Go to device",
      icon: MonitorSmartphone,
      disabled: !canSeeDevice,
      onSelect: () =>
        stream.User?.id &&
        stream.Player?.machineIdentifier &&
        onNavigateToDevice?.(stream.User.id, stream.Player.machineIdentifier),
    },
  ];

  const detailsLabel = isExpanded ? "Hide details" : "Show details";

  return (
    <EntityCard
      key={stream.sessionKey || index}
      rail={false}
      className={cn(
        overArt &&
          "border-transparent bg-neutral-900 text-white shadow-lg shadow-black/10 dark:bg-black dark:shadow-none",
      )}
    >
      {overArt && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <img
            src={artUrl}
            alt=""
            data-testid="stream-ambient"
            className={cn(
              "absolute inset-0 size-full scale-125 object-cover opacity-0 blur-3xl saturate-150 transition-opacity duration-700 motion-reduce:transition-none",
              artLoaded && "opacity-70 dark:opacity-40",
            )}
          />
          <div className="absolute inset-0 bg-black/50 dark:bg-black/55" />
        </div>
      )}

      {overArt && (
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 sm:h-64">
          <img
            src={artUrl}
            alt=""
            data-testid="stream-art"
            onLoad={() => setLoadedArt(artUrl)}
            onError={() => setFailedArt(artUrl)}
            className={cn(
              "absolute inset-y-0 right-0 h-full w-auto max-w-full object-cover object-right opacity-0 transition-opacity duration-700 [mask-image:linear-gradient(to_right,transparent,black_65%),linear-gradient(to_top,transparent,black_60%)] [mask-composite:intersect] motion-reduce:transition-none",
              artLoaded && "opacity-45 sm:opacity-75",
            )}
          />
        </div>
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

      <div className="relative z-10 space-y-4 p-4 sm:space-y-5 sm:p-5">
        <div className="flex gap-3.5 sm:min-h-[6.75rem] sm:gap-5">
          {posterUrl && (
            <div
              className={cn(
                "relative shrink-0 self-start overflow-hidden rounded-md bg-muted shadow-sm",
                POSTER_FRAME[posterShape],
                overArt && "bg-white/10 shadow-lg shadow-black/40",
              )}
            >
              <img
                src={posterUrl}
                alt={getContentTitle(stream)}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalWidth && naturalHeight) {
                    setPosterShape(measuredShape(naturalWidth, naturalHeight));
                  }
                  setLoadedPoster(posterUrl);
                }}
                onError={() => setFailedPoster(posterUrl)}
                className={cn(
                  "size-full object-cover opacity-0 transition-opacity duration-500 motion-reduce:transition-none",
                  posterLoaded && "opacity-100",
                )}
              />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2.5">
            <EntityHeader
              className={overArt ? "[&_h4]:text-white [&_p]:text-white/70" : ""}
              title={
                <button
                  type="button"
                  onClick={(e) => void openInPlex(e)}
                  className="max-w-full cursor-pointer truncate text-left decoration-1 underline-offset-4 hover:underline"
                  title={
                    isMusic ? "Open this album in Plex" : "Open this in Plex"
                  }
                >
                  {lines.primary}
                </button>
              }
              subtitle={lines.secondary}
              status={
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleExpand}
                    aria-expanded={isExpanded}
                    aria-label={detailsLabel}
                    title={detailsLabel}
                    className={cn("size-8 px-0", secondary)}
                  >
                    <ChevronDown
                      className={cn(
                        "transition-transform duration-200 motion-reduce:transition-none",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </Button>
                  <ActionMenu
                    busy={isRevoking}
                    actions={actions}
                    destructive={
                      stream.Player?.product === "Plexamp"
                        ? undefined
                        : {
                            label: "Remove access",
                            icon: LogOut,
                            tone: "danger",
                            disabled: !canRevoke,
                            onSelect: onRemoveAccess,
                          }
                    }
                    className={secondary}
                  />
                </div>
              }
            />

            <p
              className={cn(
                "truncate text-xs sm:text-sm",
                overArt ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {canSeeUser && onNavigateToUser ? (
                <button
                  type="button"
                  onClick={() =>
                    stream.User?.id && onNavigateToUser(stream.User.id)
                  }
                  title="Show this user"
                  className={cn(
                    "cursor-pointer font-medium decoration-1 underline-offset-4 hover:underline",
                    overArt ? "text-white" : "text-foreground",
                  )}
                >
                  {userName}
                </button>
              ) : (
                <span
                  className={cn(
                    "font-medium",
                    overArt ? "text-white" : "text-foreground",
                  )}
                >
                  {userName}
                </span>
              )}
              {stream.Player?.title && <> on {stream.Player.title}</>}
            </p>
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
