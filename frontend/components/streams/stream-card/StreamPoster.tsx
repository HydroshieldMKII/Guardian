import { useState } from "react";
import { useLoadableImage } from "@/hooks/useLoadableImage";
import { cn } from "@/lib/utils";
import type { PlexSession } from "@/types";
import { getContentTitle } from "../SharedComponents";
import {
  expectedShape,
  measuredShape,
  POSTER_FRAME,
  type PosterShape,
} from "./poster-shape";

export function StreamPoster({
  stream,
  overArt,
}: {
  stream: PlexSession;
  overArt: boolean;
}) {
  const poster = useLoadableImage(stream.thumbnailUrl || "");
  const [shape, setShape] = useState<PosterShape>(() =>
    expectedShape(stream.type),
  );

  if (!poster.url) return null;

  return (
    <div
      className={cn(
        "relative shrink-0 self-start overflow-hidden rounded-md bg-muted shadow-sm",
        POSTER_FRAME[shape],
        overArt && "bg-white/10 shadow-lg shadow-black/40",
      )}
    >
      <img
        src={poster.url}
        alt={getContentTitle(stream)}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth && naturalHeight) {
            setShape(measuredShape(naturalWidth, naturalHeight));
          }
          poster.markLoaded();
        }}
        onError={poster.markFailed}
        className={cn(
          "size-full object-cover opacity-0 transition-opacity duration-500 motion-reduce:transition-none",
          poster.loaded && "opacity-100",
        )}
      />
    </div>
  );
}
