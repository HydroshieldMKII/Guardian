import React from "react";
import { Video, Signal, Wifi, Headphones, HardDrive } from "lucide-react";
import { getDetailedQuality } from "./SharedComponents";
import { PillRow, StatusPill, type Tone } from "@/components/ui/entity";

interface StreamQualityProps {
  session: any;
  inline?: boolean;
  hasArt?: boolean;
}

export const StreamQuality: React.FC<StreamQualityProps> = ({
  session,
  inline = false,
  hasArt = false,
}) => {
  const quality = getDetailedQuality(session);

  if (!quality) {
    return null;
  }

  // For music tracks, only show if we have bitrate
  const isMusic = session.type === "track";
  if (isMusic) {
    if (quality.bitrate === "Unknown") {
      return null;
    }
  } else {
    // For video content, require at least resolution or video codec
    if (quality.resolution === "Unknown" && quality.videoCodec === "Unknown") {
      return null;
    }
  }

  // Inline mode - returns fragments for parent to arrange
  if (inline) {
    const pill = (
      value: string,
      tone: Tone,
      className = "",
    ): React.ReactNode => (
      <StatusPill
        tone={tone}
        className={`${className} ${
          hasArt ? "border-white/25 bg-white/10 text-white" : ""
        }`}
      >
        {value}
      </StatusPill>
    );

    return (
      <PillRow>
        {!isMusic &&
          quality.resolution !== "Unknown" &&
          pill(quality.resolution, "info")}
        {!isMusic &&
          quality.videoCodec !== "Unknown" &&
          pill(quality.videoCodec, "positive", "hidden sm:inline-flex")}
        {quality.container !== "Unknown" &&
          pill(
            quality.container,
            "neutral",
            isMusic ? "" : "hidden sm:inline-flex",
          )}
        {quality.bitrate !== "Unknown" && pill(quality.bitrate, "accent")}
      </PillRow>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
      {!isMusic && quality.resolution !== "Unknown" && (
        <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
          <span>{quality.resolution}</span>
        </div>
      )}
      {!isMusic && quality.videoCodec !== "Unknown" && (
        <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
          <span>{quality.videoCodec}</span>
        </div>
      )}
      {/* music container */}
      {quality.container !== "Unknown" && (
        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
          <span>{quality.container}</span>
        </div>
      )}

      {quality.bitrate !== "Unknown" && (
        <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
          <span>{quality.bitrate}</span>
        </div>
      )}
    </div>
  );
};

interface StreamQualityDetailsProps {
  session: any;
  hasArt?: boolean;
}

export const StreamQualityDetails: React.FC<StreamQualityDetailsProps> = ({
  session,
  hasArt = false,
}) => {
  const quality = getDetailedQuality(session);

  if (!quality) return null;

  const isMusic = session.type === "track";

  return (
    <div
      className={`space-y-2 p-3 rounded-md border ${
        hasArt
          ? "bg-black/60 border-white/30"
          : "bg-muted/30 dark:bg-muted/20 border-border/50"
      }`}
    >
      <h4
        className={`text-sm font-semibold mb-2 ${
          hasArt ? "text-white" : "text-foreground/90 dark:text-foreground"
        }`}
      >
        Stream Quality
      </h4>
      <div
        className={`grid gap-2 text-xs ${isMusic ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {!isMusic && (
          <>
            <div
              className={`flex items-center gap-2 p-2 rounded-md border min-w-0 ${
                hasArt
                  ? "bg-black/40 border-white/20"
                  : "bg-card border-border/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold ${
                    hasArt
                      ? "text-white/80"
                      : "text-foreground/80 dark:text-foreground/70"
                  }`}
                >
                  Resolution
                </div>
                <div
                  className={`truncate font-medium ${
                    hasArt
                      ? "text-white/60"
                      : "text-foreground/60 dark:text-foreground/50"
                  }`}
                >
                  {quality.resolution}
                </div>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 p-2 rounded-md border min-w-0 ${
                hasArt
                  ? "bg-black/40 border-white/20"
                  : "bg-card border-border/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold ${
                    hasArt
                      ? "text-white/80"
                      : "text-foreground/80 dark:text-foreground/70"
                  }`}
                >
                  Bandwidth
                </div>
                <div
                  className={`truncate font-medium ${
                    hasArt
                      ? "text-white/60"
                      : "text-foreground/60 dark:text-foreground/50"
                  }`}
                >
                  {quality.bandwidth}
                </div>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 p-2 rounded-md border min-w-0 ${
                hasArt
                  ? "bg-black/40 border-white/20"
                  : "bg-card border-border/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold ${
                    hasArt
                      ? "text-white/80"
                      : "text-foreground/80 dark:text-foreground/70"
                  }`}
                >
                  Video Codec
                </div>
                <div
                  className={`truncate font-medium ${
                    hasArt
                      ? "text-white/60"
                      : "text-foreground/60 dark:text-foreground/50"
                  }`}
                >
                  {quality.videoCodec}
                </div>
              </div>
            </div>
          </>
        )}
        <div
          className={`flex items-center gap-2 p-2 rounded-md border min-w-0 ${
            hasArt ? "bg-black/40 border-white/20" : "bg-card border-border/30"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div
              className={`font-semibold ${
                hasArt
                  ? "text-white/80"
                  : "text-foreground/80 dark:text-foreground/70"
              }`}
            >
              Bitrate
            </div>
            <div
              className={`truncate font-medium ${
                hasArt
                  ? "text-white/60"
                  : "text-foreground/60 dark:text-foreground/50"
              }`}
            >
              {quality.bitrate}
            </div>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 p-2 rounded-md border min-w-0 ${
            hasArt ? "bg-black/40 border-white/20" : "bg-card border-border/30"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div
              className={`font-semibold ${
                hasArt
                  ? "text-white/80"
                  : "text-foreground/80 dark:text-foreground/70"
              }`}
            >
              Audio Codec
            </div>
            <div
              className={`truncate font-medium ${
                hasArt
                  ? "text-white/60"
                  : "text-foreground/60 dark:text-foreground/50"
              }`}
            >
              {quality.audioCodec}
            </div>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 p-2 rounded-md border min-w-0 ${
            hasArt ? "bg-black/40 border-white/20" : "bg-card border-border/30"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div
              className={`font-semibold ${
                hasArt
                  ? "text-white/80"
                  : "text-foreground/80 dark:text-foreground/70"
              }`}
            >
              Container
            </div>
            <div
              className={`truncate font-medium ${
                hasArt
                  ? "text-white/60"
                  : "text-foreground/60 dark:text-foreground/50"
              }`}
            >
              {quality.container}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
