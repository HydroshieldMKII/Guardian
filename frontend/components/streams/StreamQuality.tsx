import React from "react";
import { getDetailedQuality } from "./SharedComponents";
import { Meta, MetaGrid } from "@/components/ui/entity";
import type { PlexSession } from "@/types";

type QualitySession = Pick<PlexSession, "type" | "Media" | "Session">;

interface StreamQualityDetailsProps {
  session: QualitySession;
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
      className={`rounded-lg border p-4 ${
        hasArt ? "border-white/20 bg-black/50" : "border-border/60 bg-muted/30"
      }`}
    >
      <h4
        className={`mb-4 text-[11px] font-semibold uppercase tracking-wide ${
          hasArt ? "text-white/70" : "text-muted-foreground"
        }`}
      >
        Stream quality
      </h4>
      <MetaGrid
        className={
          hasArt ? "[&_dt]:text-white/60 [&_dd]:text-white" : undefined
        }
      >
        {!isMusic && <Meta label="Resolution">{quality.resolution}</Meta>}
        {!isMusic && <Meta label="Video codec">{quality.videoCodec}</Meta>}
        <Meta label="Audio codec">{quality.audioCodec}</Meta>
        <Meta label="Container">{quality.container}</Meta>
        <Meta label="Bitrate">{quality.bitrate}</Meta>
        {!isMusic && <Meta label="Bandwidth">{quality.bandwidth}</Meta>}
      </MetaGrid>
    </div>
  );
};
