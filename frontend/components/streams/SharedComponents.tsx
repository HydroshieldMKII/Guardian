export { ClickableIP } from "@/components/ui/clickable-ip";

export const getProgressPercentage = (
  viewOffset: number = 0,
  duration: number = 0,
) => {
  if (!duration) return 0;
  return Math.min(100, (viewOffset / duration) * 100);
};

export const getContentTitle = (session: any) => {
  if (session.type === "episode" && session.grandparentTitle) {
    return `${session.grandparentTitle} - ${session.parentTitle}: ${session.title}`;
  }
  if (session.type === "movie") {
    return `${session.title} (${session.year})`;
  }
  if (session.type === "track") {
    let title = session.grandparentTitle
      ? `${session.grandparentTitle} - ${session.title}`
      : session.title;

    if (session.parentYear) {
      title += ` (${session.parentYear})`;
    }

    return title;
  }
  return session.title || "Unknown Title";
};

export const getDetailedQuality = (session: any) => {
  const media = session.Media?.[0];
  if (!media) return null;

  return {
    resolution: media.videoResolution?.toUpperCase() || "Unknown",
    bitrate: media.bitrate
      ? `${Math.round(media.bitrate / 1000)} Mbps`
      : "Unknown",
    videoCodec: media.videoCodec?.toUpperCase() || "Unknown",
    audioCodec: media.audioCodec?.toUpperCase() || "Unknown",
    container: media.container?.toUpperCase() || "Unknown",
    bandwidth: session.Session?.bandwidth
      ? `${Math.round(session.Session.bandwidth / 1000)} Mbps`
      : "Unknown",
  };
};
