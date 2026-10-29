import React from "react";
import { EntityCard, EntityHeader } from "@/components/ui/entity";
import { useLoadableImage } from "@/hooks/useLoadableImage";
import { openInPlex } from "@/lib/open-in-plex";
import { cn } from "@/lib/utils";
import { PlexSession } from "@/types";
import { getContentLines } from "./SharedComponents";
import { StreamQualityDetails } from "./StreamQuality";
import { StreamDeviceInfo } from "./StreamDeviceInfo";
import { StreamProgress } from "./StreamProgress";
import { StreamBackdrop } from "./stream-card/StreamBackdrop";
import { StreamCardControls } from "./stream-card/StreamCardControls";
import { StreamPoster } from "./stream-card/StreamPoster";
import { StreamUserLine } from "./stream-card/StreamUserLine";
import type { StreamNavigation } from "./stream-card/stream-actions";

interface StreamCardProps extends StreamNavigation {
  stream: PlexSession;
  isExpanded: boolean;
  isRevoking: boolean;
  onToggleExpand: () => void;
  onRemoveAccess: () => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  isExpanded,
  isRevoking,
  onToggleExpand,
  onRemoveAccess,
  onNavigateToDevice,
  onNavigateToUser,
}) => {
  const art = useLoadableImage(stream.artUrl || "");
  const overArt = Boolean(art.url);
  const lines = getContentLines(stream);

  return (
    <EntityCard
      rail={false}
      className={cn(
        overArt &&
          "border-transparent bg-neutral-900 text-white shadow-lg shadow-black/10 dark:bg-black dark:shadow-none",
      )}
    >
      <StreamBackdrop stream={stream} art={art} />

      <div className="relative z-10 space-y-4 p-4 sm:space-y-5 sm:p-5">
        <div className="flex gap-3.5 sm:min-h-[6.75rem] sm:gap-5">
          <StreamPoster stream={stream} overArt={overArt} />

          <div className="min-w-0 flex-1 space-y-2.5">
            <EntityHeader
              className={overArt ? "[&_h4]:text-white [&_p]:text-white/70" : ""}
              title={
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void openInPlex(stream);
                  }}
                  className="max-w-full cursor-pointer truncate text-left decoration-1 underline-offset-4 hover:underline"
                  title={
                    stream.type === "track"
                      ? "Open this album in Plex"
                      : "Open this in Plex"
                  }
                >
                  {lines.primary}
                </button>
              }
              subtitle={lines.secondary}
              status={
                <StreamCardControls
                  stream={stream}
                  overArt={overArt}
                  isExpanded={isExpanded}
                  isRevoking={isRevoking}
                  onToggleExpand={onToggleExpand}
                  onRemoveAccess={onRemoveAccess}
                  onNavigateToDevice={onNavigateToDevice}
                  onNavigateToUser={onNavigateToUser}
                />
              }
            />

            <StreamUserLine
              stream={stream}
              overArt={overArt}
              onNavigateToUser={onNavigateToUser}
            />
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
