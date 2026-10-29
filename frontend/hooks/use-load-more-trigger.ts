import { useEffect, useRef, type RefObject } from "react";

export function useLoadMoreTrigger<Trigger extends HTMLElement>(
  rootRef: RefObject<HTMLElement | null>,
  hasMore: boolean,
  loadMore: () => void,
) {
  const triggerRef = useRef<Trigger>(null);
  const latestLoadMore = useRef(loadMore);

  useEffect(() => {
    latestLoadMore.current = loadMore;
  });

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          latestLoadMore.current();
        }
      },
      { root: rootRef.current },
    );
    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore, rootRef]);

  return triggerRef;
}
