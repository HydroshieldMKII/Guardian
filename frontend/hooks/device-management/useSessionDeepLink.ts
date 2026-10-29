import { useEffect, useRef, type RefObject } from "react";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";
import type { SessionHistoryEntry } from "@/lib/session-history";

const DEEP_LINK_MAX_PAGES = 4;
const HIGHLIGHT_MS = 2000;

interface SessionDeepLinkOptions {
  listRef: RefObject<HTMLElement | null>;
  sessionId?: number | null;
  isOpen: boolean;
  sessions: SessionHistoryEntry[];
  firstLoad: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

export function useSessionDeepLink({
  listRef,
  sessionId,
  isOpen,
  sessions,
  firstLoad,
  hasMore,
  loadingMore,
  loadMore,
}: SessionDeepLinkOptions) {
  const scrolledToRef = useRef<number | null>(null);
  const pagesRef = useRef({ id: null as number | null, pages: 0 });

  useEffect(() => {
    if (!isOpen) scrolledToRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    const list = listRef.current;
    if (!sessionId || firstLoad || !list) return;
    if (scrolledToRef.current === sessionId) return;

    if (pagesRef.current.id !== sessionId) {
      pagesRef.current = { id: sessionId, pages: 0 };
    }

    if (!sessions.some((session) => session.id === sessionId)) {
      if (
        hasMore &&
        !loadingMore &&
        pagesRef.current.pages < DEEP_LINK_MAX_PAGES
      ) {
        pagesRef.current.pages += 1;
        loadMore();
      }
      return;
    }

    const element = list.querySelector(`[data-session-id="${sessionId}"]`);
    if (!element) return;

    scrolledToRef.current = sessionId;
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    element.classList.add(...HIGHLIGHT_CLASSES);

    const timeout = setTimeout(
      () => element.classList.remove(...HIGHLIGHT_CLASSES),
      HIGHLIGHT_MS,
    );
    return () => clearTimeout(timeout);
  }, [listRef, sessionId, sessions, firstLoad, hasMore, loadingMore, loadMore]);
}
