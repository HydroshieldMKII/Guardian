import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { RefreshCw } from "lucide-react";
import { config } from "@/lib/config";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useToast } from "@/hooks/use-toast";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";
import type { SessionHistoryEntry } from "@/lib/session-history";
import { SessionHistoryCard } from "./SessionHistoryCard";
import { SessionHistoryFilters, type AppFilter } from "./SessionHistoryFilters";

interface UserHistoryModalProps {
  userId: string | null;
  username?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  scrollToSessionId?: number | null;
}

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const DEEP_LINK_MAX_PAGES = 4;

export const UserHistoryModal: React.FC<UserHistoryModalProps> = ({
  userId,
  username,
  isOpen,
  onClose,
  onNavigateToDevice,
  scrollToSessionId,
}) => {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [showTerminatedOnly, setShowTerminatedOnly] = useState(false);
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const canFilterTerminated = appFilter !== "plexamp";
  const terminatedOnly = showTerminatedOnly && canFilterTerminated;
  const [sessionToDelete, setSessionToDelete] =
    useState<SessionHistoryEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const sessionsListRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const loadedCountRef = useRef(0);
  const scrolledToRef = useRef<number | null>(null);
  const deepLinkRef = useRef({ id: null as number | null, pages: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadedCountRef.current = sessions.length;
  }, [sessions]);

  useEffect(() => {
    const timeout = setTimeout(
      () => setActiveSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        includeActive: "true",
      });
      if (activeSearch) {
        params.set("search", activeSearch);
      }
      if (terminatedOnly) {
        params.set("terminatedOnly", "true");
      }
      if (appFilter !== "all") {
        params.set("app", appFilter);
      }

      const response = await fetch(
        `${config.api.baseUrl}/sessions/history/${userId}?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch user history");
      }
      const data: unknown = await response.json();
      return (Array.isArray(data) ? data : []) as SessionHistoryEntry[];
    },
    [userId, activeSearch, terminatedOnly, appFilter],
  );

  const currentQueryRef = useRef(fetchPage);
  useEffect(() => {
    currentQueryRef.current = fetchPage;
  }, [fetchPage]);

  const loadFirstPage = useCallback(async () => {
    if (!userId) return;

    const isCurrent = () => currentQueryRef.current === fetchPage;
    setLoading(true);
    try {
      const page = await fetchPage(0, PAGE_SIZE);
      if (!isCurrent()) return;
      setSessions(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching user history:", error);
      if (!isCurrent()) return;
      setSessions([]);
      setHasMore(false);
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [userId, fetchPage]);

  const refreshLoaded = useCallback(
    async (showIndicator: boolean) => {
      if (!userId) return;

      if (showIndicator) {
        setRefreshing(true);
      }
      try {
        const limit = Math.max(loadedCountRef.current, PAGE_SIZE);
        const page = await fetchPage(0, limit);
        if (currentQueryRef.current !== fetchPage) return;
        setSessions(page);
        setHasMore(page.length === limit);
      } catch (error) {
        console.error("Error refreshing user history:", error);
      } finally {
        if (showIndicator) {
          setRefreshing(false);
        }
      }
    },
    [userId, fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!userId) return;

    setLoadingMore(true);
    try {
      const page = await fetchPage(loadedCountRef.current, PAGE_SIZE);
      if (currentQueryRef.current !== fetchPage) return;
      setSessions((prev) => {
        const known = new Set(prev.map((session) => session.id));
        return [...prev, ...page.filter((session) => !known.has(session.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error loading more user history:", error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, fetchPage]);

  useEffect(() => {
    if (isOpen && userId) {
      void loadFirstPage();
    }
  }, [isOpen, userId, loadFirstPage]);

  useEffect(() => {
    if (isOpen) return;

    setSearchTerm("");
    setActiveSearch("");
    setShowTerminatedOnly(false);
    setAppFilter("all");
    setLoaded(false);
    scrolledToRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const hasActiveSessions = sessions.some((session) => !session.endedAt);
    if (!hasActiveSessions) return;

    const intervalId = setInterval(() => void refreshLoaded(false), 10000);
    return () => clearInterval(intervalId);
  }, [isOpen, sessions, refreshLoaded]);

  useEffect(() => {
    const trigger = loadMoreRef.current;
    if (!trigger || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { root: sessionsListRef.current },
    );
    observer.observe(trigger);

    return () => observer.disconnect();
  }, [loadMore, hasMore, loadingMore]);

  useEffect(() => {
    if (!scrollToSessionId || loading || !sessionsListRef.current) return;
    if (scrolledToRef.current === scrollToSessionId) return;

    if (deepLinkRef.current.id !== scrollToSessionId) {
      deepLinkRef.current = { id: scrollToSessionId, pages: 0 };
    }

    const sessionExistsInData = sessions.some(
      (session) => session.id === scrollToSessionId,
    );
    if (!sessionExistsInData) {
      if (
        hasMore &&
        !loadingMore &&
        deepLinkRef.current.pages < DEEP_LINK_MAX_PAGES
      ) {
        deepLinkRef.current.pages += 1;
        void loadMore();
      }
      return;
    }

    const sessionElement = sessionsListRef.current.querySelector(
      `[data-session-id="${scrollToSessionId}"]`,
    );
    if (!sessionElement) return;

    scrolledToRef.current = scrollToSessionId;
    sessionElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    sessionElement.classList.add(...HIGHLIGHT_CLASSES);

    const timeout = setTimeout(
      () => sessionElement.classList.remove(...HIGHLIGHT_CLASSES),
      2000,
    );
    return () => clearTimeout(timeout);
  }, [scrollToSessionId, sessions, loading, hasMore, loadingMore, loadMore]);

  const handleDeviceClick = (session: SessionHistoryEntry) => {
    onClose();

    if (onNavigateToDevice && userId && session.userDevice?.deviceIdentifier) {
      onNavigateToDevice(userId, session.userDevice.deviceIdentifier);
    } else if (userId && session.userDevice?.deviceIdentifier) {
      router.push(
        `/?userId=${encodeURIComponent(userId)}&deviceId=${encodeURIComponent(session.userDevice.deviceIdentifier)}`,
      );
    }
  };

  const handleDeleteClick = (session: SessionHistoryEntry) => {
    setSessionToDelete(session);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(
        `${config.api.baseUrl}/sessions/history/${sessionToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
        setSessionToDelete(null);
        toast({
          title: "Session deleted",
          description: "That entry is gone from this user's stream history.",
          variant: "success",
        });
      } else {
        toast({
          title: "Delete failed",
          description: "Could not delete that entry. Try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Delete failed",
        description: "Something went wrong while deleting that entry.",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelDelete = () => {
    setSessionToDelete(null);
  };

  const filtered = Boolean(
    activeSearch || terminatedOnly || appFilter !== "all",
  );

  return (
    <>
      <Modal open={isOpen} onOpenChange={onClose} size="xl">
        <ModalHeader
          title="Stream history"
          description={
            <>
              View and manage streaming session history for{" "}
              <span className="font-medium text-foreground">
                {username || userId}
              </span>
              .
            </>
          }
        >
          <SessionHistoryFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            refreshing={refreshing}
            refreshDisabled={loading}
            onRefresh={() => void refreshLoaded(true)}
            appFilter={appFilter}
            onAppFilterChange={setAppFilter}
            terminatedOnly={terminatedOnly}
            onTerminatedOnlyChange={setShowTerminatedOnly}
          />
        </ModalHeader>

        <ModalBody className="min-h-96 space-y-3" ref={sessionsListRef}>
          {loading && !loaded ? (
            <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-5 animate-spin" />
              <span>Loading history...</span>
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              className="min-h-80"
              title={
                filtered
                  ? "No streams match your search"
                  : "This user has not streamed anything yet"
              }
            />
          ) : (
            <>
              {sessions.map((session) => (
                <SessionHistoryCard
                  key={session.id}
                  session={session}
                  onSeeDevice={() => handleDeviceClick(session)}
                  onDelete={() => handleDeleteClick(session)}
                />
              ))}

              {hasMore && (
                <Button
                  ref={loadMoreRef}
                  variant="outline"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="w-full"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    "Load older sessions"
                  )}
                </Button>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter className="flex-row items-center justify-between [&>button]:w-auto">
          <p className="text-xs text-muted-foreground">
            {loading && !loaded
              ? ""
              : `Showing ${sessions.length} session${
                  sessions.length === 1 ? "" : "s"
                }${filtered ? " matching your filters" : ""}`}
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={cancelDelete}
        onConfirm={() => void confirmDelete()}
        title="Delete session history"
        description="Are you sure you want to delete this session history? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={deleteLoading}
      />
    </>
  );
};
