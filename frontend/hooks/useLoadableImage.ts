import { useState } from "react";

export function useLoadableImage(src: string) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const url = failed === src ? "" : src;

  return {
    url,
    loaded: loaded === src,
    markLoaded: () => setLoaded(url),
    markFailed: () => setFailed(url),
  };
}

export type LoadableImage = ReturnType<typeof useLoadableImage>;
