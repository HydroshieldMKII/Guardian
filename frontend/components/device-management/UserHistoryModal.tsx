import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useToast } from "@/hooks/use-toast";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";
import { useSessionHistory } from "@/hooks/device-management/useSessionHistory";
import type { AppFilter, SessionHistoryEntry } from "@/lib/session-history";
import { sessionHistoryApi } from "@/lib/session-history-api";
import { SessionHistoryCard } from "./SessionHistoryCard";
import { SessionHistoryFilters } from "./SessionHistoryFilters";

interface UserHistoryModalProps {
  userId: string | null;
  username?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  scrollToSessionId?: number | null;
}

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
  const scrolledToRef = useRef<number | null>(null);
  const deepLinkRef = useRef({ id: null as number | null, pages: 0 });
  const { toast } = useToast();

  useEffect(() => {
    const timeout = setTimeout(
      () => setActiveSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const filter = useMemo(
    () => ({ search: activeSearch, terminatedOnly, app: appFilter }),
    [activeSearch, terminatedOnly, appFilter],
  );
  const {
    sessions,
    firstLoad,
    switching,
    hasMore,
    loadingMore,
    loadMore,
    refreshing,
    refresh,
    removeSession,
  } = useSessionHistory(userId, filter, isOpen);
  const latestLoadMore = useRef(loadMore);

  useEffect(() => {
    latestLoadMore.current = loadMore;
  });

  useEffect(() => {
    if (isOpen) return;

    setSearchTerm("");
    setActiveSearch("");
    setShowTerminatedOnly(false);
    setAppFilter("all");
    scrolledToRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    const trigger = loadMoreRef.current;
    if (!trigger || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          latestLoadMore.current();
        }
      },
      { root: sessionsListRef.current },
    );
    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore]);

  useEffect(() => {
    if (!scrollToSessionId || firstLoad || !sessionsListRef.current) return;
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
        loadMore();
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
  }, [scrollToSessionId, sessions, firstLoad, hasMore, loadingMore, loadMore]);

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
      if (await sessionHistoryApi.remove(sessionToDelete.id)) {
        removeSession(sessionToDelete.id);
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
            refreshDisabled={firstLoad || switching}
            onRefresh={() => void refresh()}
            appFilter={appFilter}
            onAppFilterChange={setAppFilter}
            terminatedOnly={terminatedOnly}
            onTerminatedOnlyChange={setShowTerminatedOnly}
          />
        </ModalHeader>

        <ModalBody className="min-h-96 space-y-3" ref={sessionsListRef}>
          {firstLoad ? (
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
                  onClick={loadMore}
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
            {firstLoad
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
