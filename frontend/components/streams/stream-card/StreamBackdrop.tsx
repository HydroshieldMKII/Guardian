import type { LoadableImage } from "@/hooks/useLoadableImage";
import { cn } from "@/lib/utils";

export function StreamBackdrop({
  art,
  backdrop,
}: {
  art: LoadableImage;
  backdrop: LoadableImage;
}) {
  if (!art.url && backdrop.url) {
    return (
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <img
          src={backdrop.url}
          alt=""
          data-testid="stream-ambient"
          onLoad={backdrop.markLoaded}
          onError={backdrop.markFailed}
          className={cn(
            "absolute inset-0 size-full scale-150 object-cover opacity-0 blur-3xl saturate-150 transition-opacity duration-700 motion-reduce:transition-none",
            backdrop.loaded && "opacity-70 dark:opacity-40",
          )}
        />
        <div className="absolute inset-0 bg-black/50 dark:bg-black/55" />
      </div>
    );
  }

  if (!art.url) return null;

  return (
    <>
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <img
          src={art.url}
          alt=""
          data-testid="stream-ambient"
          className={cn(
            "absolute inset-0 size-full scale-125 object-cover opacity-0 blur-3xl saturate-150 transition-opacity duration-700 motion-reduce:transition-none",
            art.loaded && "opacity-70 dark:opacity-40",
          )}
        />
        <div className="absolute inset-0 bg-black/50 dark:bg-black/55" />
      </div>

      <div aria-hidden className="absolute inset-x-0 top-0 h-56 sm:h-64">
        <img
          src={art.url}
          alt=""
          data-testid="stream-art"
          onLoad={art.markLoaded}
          onError={art.markFailed}
          className={cn(
            "absolute inset-y-0 right-0 h-full w-auto max-w-full object-cover object-right opacity-0 transition-opacity duration-700 [mask-image:linear-gradient(to_right,transparent,black_65%),linear-gradient(to_top,transparent,black_60%)] [mask-composite:intersect] motion-reduce:transition-none",
            art.loaded && "opacity-45 sm:opacity-75",
          )}
        />
      </div>
    </>
  );
}
