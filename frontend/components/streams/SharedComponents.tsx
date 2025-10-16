import React from 'react';
import { 
  Smartphone, 
  Tablet, 
  Laptop, 
  Monitor,
  ExternalLink 
} from "lucide-react";

// Clickable IP component for external IP lookup
export const ClickableIP = ({ ipAddress }: { ipAddress: string | null }) => {
  if (!ipAddress || ipAddress === "Unknown IP" || ipAddress === "Unknown") {
    return <span className="truncate">{ipAddress || "Unknown"}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    window.open(
      `https://ipinfo.io/${ipAddress}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <button
      onClick={handleClick}
      className="truncate text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors"
      title={`Look up ${ipAddress} on ipinfo.io`}
    >
      <span className="truncate">{ipAddress}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
    </button>
  );
};

// Device icon component based on platform
export const getDeviceIcon = (platform: string = "") => {
  const platformLower = platform.toLowerCase();
  if (platformLower.includes("android") || platformLower.includes("ios")) {
    return <Smartphone className="w-4 h-4" />;
  }
  if (platformLower.includes("tablet") || platformLower.includes("ipad")) {
    return <Tablet className="w-4 h-4" />;
  }
  if (
    platformLower.includes("windows") ||
    platformLower.includes("macos") ||
    platformLower.includes("linux")
  ) {
    return <Laptop className="w-4 h-4" />;
  }
  return <Monitor className="w-4 h-4" />;
};

// Utility function to format duration in milliseconds to readable time
export const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(
      seconds % 60
    )
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
};

// Utility function to get progress percentage
export const getProgressPercentage = (
  viewOffset: number = 0,
  duration: number = 0
) => {
  if (!duration) return 0;
  return Math.min(100, (viewOffset / duration) * 100);
};

// Utility function to get formatted content title
export const getContentTitle = (session: any) => {
  if (session.type === "episode" && session.grandparentTitle) {
    return `${session.grandparentTitle} - ${session.parentTitle}: ${session.title}`;
  }
  if (session.type === "movie") {
    return `${session.title} (${session.year})`;
  }
  if (session.type === "track") {
    // For music tracks: Artist - Album - Song Title (Year)
    let title = "";
    
    if (session.grandparentTitle) {
      // Artist - Song Title
      title = `${session.grandparentTitle} - ${session.title}`;
    } else {
      // Fallback to just the song title
      title = session.title;
    }
    
    if (session.parentYear) {
      title += ` (${session.parentYear})`;
    }
    
    return title;
  }
  return session.title || "Unknown Title";
};

// Utility function to get detailed quality information
export const getDetailedQuality = (session: any) => {
  const media = session.Media?.[0];
  if (!media) return null;

  return {
    resolution: media.videoResolution?.toUpperCase() || "Unknown",
    bitrate: media.bitrate ? `${Math.round(media.bitrate / 1000)} Mbps` : "Unknown",
    videoCodec: media.videoCodec?.toUpperCase() || "Unknown",
    audioCodec: media.audioCodec?.toUpperCase() || "Unknown", 
    container: media.container?.toUpperCase() || "Unknown",
    bandwidth: session.Session?.bandwidth ? `${Math.round(session.Session.bandwidth / 1000)} Mbps` : "Unknown"
  };
};