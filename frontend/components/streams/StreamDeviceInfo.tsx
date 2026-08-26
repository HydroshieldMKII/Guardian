import React from "react";
import { Meta, MetaGrid } from "@/components/ui/entity";
import { ClickableIP } from "./SharedComponents";

interface StreamDeviceInfoProps {
  session: {
    Player?: { platform?: string; product?: string; address?: string };
    Session?: { sessionCount?: number };
  };
  hasArt?: boolean;
}

export const StreamDeviceInfo: React.FC<StreamDeviceInfoProps> = ({
  session,
  hasArt = false,
}) => {
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
        Device Information
      </h4>
      <MetaGrid
        className={hasArt ? "[&_dt]:text-white/60 [&_dd]:text-white" : ""}
      >
        <Meta label="Platform">{session.Player?.platform || "Unknown"}</Meta>
        <Meta label="Product">{session.Player?.product || "Unknown"}</Meta>
        <Meta label="IP Address">
          <ClickableIP ipAddress={session.Player?.address || null} />
        </Meta>
        <Meta label="Streams">{session.Session?.sessionCount ?? 0}</Meta>
      </MetaGrid>
    </div>
  );
};
