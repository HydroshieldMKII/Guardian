import { useEffect, useRef, useState } from "react";

export interface ScrollEdges {
  above: boolean;
  below: boolean;
}

export function useScrollEdges<T extends HTMLElement>(contentKey?: unknown) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollEdges>({
    above: false,
    below: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const above = el.scrollTop > 1;
      const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((prev) =>
        prev.above === above && prev.below === below ? prev : { above, below },
      );
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [contentKey]);

  return { ref, edges };
}

export function scrollEdgeMask({ above, below }: ScrollEdges) {
  if (above && below) {
    return "[mask-image:linear-gradient(to_bottom,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]";
  }
  if (below) {
    return "[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]";
  }
  if (above) {
    return "[mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]";
  }
  return "";
}
