import React from "react";
import { formatDuration, getProgressPercentage } from "./SharedComponents";

interface StreamProgressProps {
  session: any;
  hasArt?: boolean;
}

export const StreamProgress: React.FC<StreamProgressProps> = ({
  session,
  hasArt = false,
}) => {
  if (!session.duration || session.viewOffset === undefined) {
    return null;
  }

  const playerState = session.Player?.state || "unknown";

  return (
    <div className="mb-1 sm:mb-2 mt-3 sm:mt-4">
      <div className="relative flex items-center justify-between text-xs mb-1">
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded-md font-medium ${hasArt ? "bg-black/30 text-white" : "text-muted-foreground"}`}
        >
          {formatDuration(session.viewOffset)}
        </span>
        {/* Status text absolutely centered */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 text-xs ${
            hasArt ? "text-white" : "text-muted-foreground"
          }`}
        >
          {playerState}
        </span>
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded-md font-medium ${hasArt ? "bg-black/30 text-white" : "text-muted-foreground"}`}
        >
          {formatDuration(session.duration)}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 sm:h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 sm:h-2 rounded-full transition-all duration-500 relative overflow-hidden"
          style={{
            width: `${getProgressPercentage(
              session.viewOffset,
              session.duration
            )}%`,
          }}
        >
          {session.Player?.state === "playing" && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};
