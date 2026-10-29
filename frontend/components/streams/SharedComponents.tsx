import type { PlexSession } from "@/types";

export { ClickableIP } from "@/components/ui/clickable-ip";

export const getProgressPercentage = (
  viewOffset: number = 0,
  duration: number = 0,
) => {
  if (!duration) return 0;
  return Math.min(100, (viewOffset / duration) * 100);
};

type ContentTitleSource = Pick<
  PlexSession,
  "type" | "title" | "grandparentTitle" | "parentTitle" | "year" | "parentYear"
>;

export interface ContentLines {
  primary: string;
  secondary?: string;
}

const joinParts = (...parts: (string | number | undefined)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;

export const getContentLines = (session: ContentTitleSource): ContentLines => {
  if (session.type === "episode" && session.grandparentTitle) {
    return {
      primary: session.grandparentTitle,
      secondary: joinParts(session.parentTitle, session.title),
    };
  }
  if (session.type === "movie") {
    return {
      primary: session.title || "Unknown title",
      secondary: joinParts(session.year),
    };
  }
  if (session.type === "track") {
    const album =
      session.parentTitle && session.parentYear
        ? `${session.parentTitle} (${session.parentYear})`
        : session.parentTitle;
    return {
      primary: session.title || "Unknown title",
      secondary: joinParts(session.grandparentTitle, album),
    };
  }
  return { primary: session.title || "Unknown title" };
};

type QualitySource = Pick<PlexSession, "Media" | "Session">;

export const getContentTitle = (session: ContentTitleSource) => {
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
  return session.title || "Unknown title";
};

export const formatBitrate = (kbps: number) => {
  if (kbps < 1000) return `${Math.round(kbps)} kbps`;
  const mbps = kbps / 1000;
  return `${mbps < 10 ? Number(mbps.toFixed(1)) : Math.round(mbps)} Mbps`;
};

export const getDetailedQuality = (session: QualitySource) => {
  const media = session.Media?.[0];
  if (!media) return null;

  return {
    resolution: media.videoResolution?.toUpperCase() || "Unknown",
    bitrate: media.bitrate ? formatBitrate(media.bitrate) : "Unknown",
    videoCodec: media.videoCodec?.toUpperCase() || "Unknown",
    audioCodec: media.audioCodec?.toUpperCase() || "Unknown",
    container: media.container?.toUpperCase() || "Unknown",
    bandwidth: session.Session?.bandwidth
      ? formatBitrate(session.Session.bandwidth)
      : "Unknown",
  };
};
