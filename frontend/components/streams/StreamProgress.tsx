import React from 'react';
import { formatDuration, getProgressPercentage } from './SharedComponents';

interface StreamProgressProps {
  session: any;
}

export const StreamProgress: React.FC<StreamProgressProps> = ({ session }) => {
  if (!session.duration || session.viewOffset === undefined) {
    return null;
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 gap-2">
        <span className="flex-shrink-0">
          {formatDuration(session.viewOffset)}
        </span>
        <span className="flex-shrink-0">
          {formatDuration(session.duration)}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 relative overflow-hidden"
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