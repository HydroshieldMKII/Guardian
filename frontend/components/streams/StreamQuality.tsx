import React from 'react';
import { 
  Video, 
  Signal, 
  Wifi, 
  Headphones, 
  HardDrive 
} from "lucide-react";
import { getDetailedQuality } from './SharedComponents';

interface StreamQualityProps {
  session: any;
}

export const StreamQuality: React.FC<StreamQualityProps> = ({ session }) => {
  const quality = getDetailedQuality(session);

  if (!quality || (quality.resolution === "Unknown" && quality.videoCodec === "Unknown")) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
      {quality.resolution !== "Unknown" && (
        <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
          <Video className="w-3 h-3" />
          <span>{quality.resolution}</span>
        </div>
      )}
      {quality.videoCodec !== "Unknown" && (
        <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
          <span>{quality.videoCodec}</span>
        </div>
      )}
      {quality.bitrate !== "Unknown" && (
        <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
          <Signal className="w-3 h-3" />
          <span>{quality.bitrate}</span>
        </div>
      )}
    </div>
  );
};

interface StreamQualityDetailsProps {
  session: any;
}

export const StreamQualityDetails: React.FC<StreamQualityDetailsProps> = ({ session }) => {
  const quality = getDetailedQuality(session);
  
  if (!quality) return null;

  return (
    <div className="space-y-2 bg-muted/30 dark:bg-muted/20 p-3 rounded-md border border-border/50">
      <h4 className="text-sm font-semibold text-foreground/90 dark:text-foreground mb-2">Stream Quality</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Video className="w-3 h-3 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">Resolution</div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">{quality.resolution}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Signal className="w-3 h-3 flex-shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">Bitrate</div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">{quality.bitrate}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Wifi className="w-3 h-3 flex-shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">Bandwidth</div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">{quality.bandwidth}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Video className="w-3 h-3 flex-shrink-0 text-orange-600 dark:text-orange-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">Video Codec</div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">{quality.videoCodec}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Headphones className="w-3 h-3 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">Audio Codec</div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">{quality.audioCodec}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <HardDrive className="w-3 h-3 flex-shrink-0 text-gray-600 dark:text-gray-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">Container</div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">{quality.container}</div>
          </div>
        </div>
      </div>
    </div>
  );
};