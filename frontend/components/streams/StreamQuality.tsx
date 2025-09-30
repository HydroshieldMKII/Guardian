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
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground mb-2">Stream Quality</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Video className="w-3 h-3 flex-shrink-0 text-blue-500" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Resolution</div>
            <div className="truncate">{quality.resolution}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Signal className="w-3 h-3 flex-shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Bitrate</div>
            <div className="truncate">{quality.bitrate}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Wifi className="w-3 h-3 flex-shrink-0 text-purple-500" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Bandwidth</div>
            <div className="truncate">{quality.bandwidth}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Video className="w-3 h-3 flex-shrink-0 text-orange-500" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Video Codec</div>
            <div className="truncate">{quality.videoCodec}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Headphones className="w-3 h-3 flex-shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Audio Codec</div>
            <div className="truncate">{quality.audioCodec}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <HardDrive className="w-3 h-3 flex-shrink-0 text-gray-500" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Container</div>
            <div className="truncate">{quality.container}</div>
          </div>
        </div>
      </div>
    </div>
  );
};