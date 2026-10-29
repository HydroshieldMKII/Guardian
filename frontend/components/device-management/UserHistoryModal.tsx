import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ActionBar,
  EmptyState,
  EntityCard,
  EntityHeader,
  Meta,
  MetaGrid,
  SegmentedControl,
  StatusPill,
  type Tone,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { RefreshCw } from "lucide-react";
import { RefreshButton } from "@/components/ui/refresh-button";
import { config } from "@/lib/config";
import { ClickableIP } from "./SharedComponents";
import { formatElapsed } from "@/lib/duration";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useToast } from "@/hooks/use-toast";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";

type AppFilter = "all" | "plex" | "plexamp";

const APP_FILTERS: { value: AppFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "plex", label: "Plex" },
  { value: "plexamp", label: "Plexamp" },
];

interface UserDevice {
  id: number;
  userId: string;
  deviceIdentifier: string;
  deviceName?: string;
  devicePlatform?: string;
  deviceProduct?: string;
  deviceVersion?: string;
  status: string;
  sessionCount: number;
}

interface SessionHistoryEntry {
  id: number;
  sessionKey: string;
  userId: string;
  username?: string;
  userDevice?: UserDevice;
  deviceAddress?: string;
  contentTitle?: string;
  contentType?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  year?: number;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  viewOffset?: number;
  terminated?: boolean;
  thumb?: string;
  art?: string;
  product?: string;
}

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const formatTitle = (session: SessionHistoryEntry) => {
    if (session.contentType === "episode" && session.grandparentTitle) {
      let result = session.grandparentTitle;
      if (session.parentTitle && session.contentTitle) {
        result += ` - ${session.parentTitle}: ${session.contentTitle}`;
      } else if (session.parentTitle) {
        result += ` - ${session.parentTitle}`;
      } else if (session.contentTitle) {
        result += ` - ${session.contentTitle}`;
      }
      return result;
    }

    return session.contentTitle || "Unknown title";
  };

  const formatSubtitle = (session: SessionHistoryEntry) => {
    if (session.contentType === "track" && session.grandparentTitle) {
      if (session.year) {
        return `${session.grandparentTitle} • ${session.year}`;
      }
      return session.grandparentTitle;
    }

    return session.year ? String(session.year) : null;
  };

  const getDeviceDisplayName = (session: SessionHistoryEntry) => {
    return (
      session.userDevice?.deviceName ||
      session.userDevice?.deviceProduct ||
      "Unknown device"
    );
  };

  const formatProduct = (session: SessionHistoryEntry) => {
    const product = session.product || session.userDevice?.deviceProduct;
    if (!product) return "Unknown";

    if (product.toLowerCase() === "plexamp") {
      return "Plexamp";
    }

    return "Plex";
  };

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

  const formatDuration = (session: SessionHistoryEntry) => {
    const endTime = session.endedAt
      ? new Date(session.endedAt).getTime()
      : Date.now();

    return formatElapsed(endTime - new Date(session.startedAt).getTime());
  };

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

  const sessionTone = (session: SessionHistoryEntry): Tone => {
    if (!session.endedAt) return "positive";
    return session.terminated ? "danger" : "neutral";
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
          <div className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by title, device or IP address"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <RefreshButton
                refreshing={refreshing}
                disabled={loading}
                onRefresh={() => void refreshLoaded(true)}
                className="size-9"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <SegmentedControl
                options={APP_FILTERS}
                value={appFilter}
                onChange={setAppFilter}
              />
              <div
                className={cn(
                  "flex items-center gap-2 transition-opacity duration-200",
                  !canFilterTerminated && "opacity-50",
                )}
                title={
                  canFilterTerminated
                    ? undefined
                    : "Plexamp streams are never terminated"
                }
              >
                <Switch
                  id="terminated-filter"
                  checked={terminatedOnly}
                  onCheckedChange={setShowTerminatedOnly}
                  disabled={!canFilterTerminated}
                  className="cursor-pointer disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="terminated-filter"
                  className="whitespace-nowrap text-sm text-muted-foreground"
                >
                  Terminated only
                </Label>
              </div>
            </div>
          </div>
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
                <EntityCard
                  key={session.id}
                  data-session-id={session.id}
                  tone={sessionTone(session)}
                >
                  <div className="space-y-3 p-4 pl-5 sm:space-y-4">
                    <EntityHeader
                      title={formatTitle(session)}
                      subtitle={formatSubtitle(session) || undefined}
                      status={
                        !session.endedAt ? (
                          <StatusPill tone="positive">Active</StatusPill>
                        ) : session.terminated ? (
                          <StatusPill tone="danger">Terminated</StatusPill>
                        ) : (
                          <StatusPill tone="neutral">Ended</StatusPill>
                        )
                      }
                    />

                    <MetaGrid className="gap-y-3 sm:grid-cols-3 sm:gap-y-4 lg:grid-cols-4">
                      <Meta label="Device">
                        {getDeviceDisplayName(session)}
                      </Meta>
                      <Meta label="Platform">
                        {session.userDevice?.devicePlatform || "Unknown"}
                      </Meta>
                      <Meta label="Product">{formatProduct(session)}</Meta>
                      <Meta label="IP address">
                        <ClickableIP ipAddress={session.deviceAddress} />
                      </Meta>
                      <Meta label="Started">
                        {formatDate(session.startedAt)}
                      </Meta>
                      <Meta label="Ended">
                        {session.endedAt
                          ? formatDate(session.endedAt)
                          : "Active"}
                      </Meta>
                      <Meta label="Duration" wrap className="tabular-nums">
                        {formatDuration(session)}
                      </Meta>
                    </MetaGrid>

                    <ActionBar>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeviceClick(session)}
                        title="Go to this device"
                        className="h-10 flex-1 sm:h-8 sm:flex-none"
                      >
                        See device
                      </Button>
                      {session.endedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(session)}
                          title="Delete this entry"
                          className="h-10 flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 sm:ml-auto sm:h-8 sm:flex-none"
                        >
                          Delete
                        </Button>
                      )}
                    </ActionBar>
                  </div>
                </EntityCard>
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
