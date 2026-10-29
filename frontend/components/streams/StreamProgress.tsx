import React from "react";
import { getProgressPercentage } from "./SharedComponents";
import { formatClock } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { PlexSession } from "@/types";

interface StreamProgressProps {
  session: Pick<PlexSession, "duration" | "viewOffset" | "Player">;
  hasArt?: boolean;
}

const STATE_LABEL: Record<string, string> = {
  playing: "Playing",
  paused: "Paused",
  buffering: "Buffering",
};

const fillClass = (state: string, hasArt: boolean) => {
  if (state === "buffering") return "bg-waiting";
  if (state === "playing") return hasArt ? "bg-white" : "bg-foreground";
  return hasArt ? "bg-white/50" : "bg-muted-foreground/60";
};

export const StreamProgress: React.FC<StreamProgressProps> = ({
  session,
  hasArt = false,
}) => {
  if (!session.duration || session.viewOffset === undefined) {
    return null;
  }

  const playerState = session.Player?.state || "unknown";
  const percent = getProgressPercentage(session.viewOffset, session.duration);

  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className={cn(
          "h-1 w-full overflow-hidden rounded-full",
          hasArt ? "bg-white/20" : "bg-muted",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-700 ease-out motion-reduce:transition-none",
            fillClass(playerState, hasArt),
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className={cn(
          "flex items-center justify-between text-xs tabular-nums",
          hasArt ? "text-white/70" : "text-muted-foreground",
        )}
      >
        <span>
          {formatClock(session.viewOffset)}
          <span className="opacity-60"> / {formatClock(session.duration)}</span>
        </span>
        <span
          className={cn(
            "font-medium",
            playerState === "buffering" && !hasArt && "text-waiting",
          )}
        >
          {STATE_LABEL[playerState] ?? "Unknown"}
        </span>
      </div>
    </div>
  );
};
