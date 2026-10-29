import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useLoadMoreTrigger } from "@/hooks/use-load-more-trigger";
import { useHistoryFilters } from "@/hooks/device-management/useHistoryFilters";
import { useSessionDeepLink } from "@/hooks/device-management/useSessionDeepLink";
import { useSessionDeletion } from "@/hooks/device-management/useSessionDeletion";
import { useSessionHistory } from "@/hooks/device-management/useSessionHistory";
import type { SessionHistoryEntry } from "@/lib/session-history";
import { HistoryList, historySummary } from "./history/HistoryList";
import { SessionHistoryFilters } from "./SessionHistoryFilters";

interface UserHistoryModalProps {
  userId: string | null;
  username?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  scrollToSessionId?: number | null;
}

export const UserHistoryModal: React.FC<UserHistoryModalProps> = ({
  userId,
  username,
  isOpen,
  onClose,
  onNavigateToDevice,
  scrollToSessionId,
}) => {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const filters = useHistoryFilters(isOpen);
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
  } = useSessionHistory(userId, filters.filter, isOpen);
  const loadMoreRef = useLoadMoreTrigger<HTMLButtonElement>(
    listRef,
    hasMore,
    loadMore,
  );
  useSessionDeepLink({
    listRef,
    sessionId: scrollToSessionId,
    isOpen,
    sessions,
    firstLoad,
    hasMore,
    loadingMore,
    loadMore,
  });
  const deletion = useSessionDeletion(removeSession);

  const seeDevice = (session: SessionHistoryEntry) => {
    onClose();

    const deviceIdentifier = session.userDevice?.deviceIdentifier;
    if (!userId || !deviceIdentifier) return;
    if (onNavigateToDevice) {
      onNavigateToDevice(userId, deviceIdentifier);
    } else {
      router.push(
        `/?userId=${encodeURIComponent(userId)}&deviceId=${encodeURIComponent(deviceIdentifier)}`,
      );
    }
  };

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
            searchTerm={filters.searchTerm}
            onSearchChange={filters.setSearchTerm}
            refreshing={refreshing}
            refreshDisabled={firstLoad || switching}
            onRefresh={() => void refresh()}
            appFilter={filters.appFilter}
            onAppFilterChange={filters.setAppFilter}
            terminatedOnly={filters.terminatedOnly}
            onTerminatedOnlyChange={filters.setShowTerminatedOnly}
          />
        </ModalHeader>

        <ModalBody className="min-h-96 space-y-3" ref={listRef}>
          <HistoryList
            sessions={sessions}
            firstLoad={firstLoad}
            filtered={filters.filtered}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMoreRef={loadMoreRef}
            onLoadMore={loadMore}
            onSeeDevice={seeDevice}
            onDelete={deletion.request}
          />
        </ModalBody>

        <ModalFooter className="flex-row items-center justify-between [&>button]:w-auto">
          <p className="text-xs text-muted-foreground">
            {firstLoad ? "" : historySummary(sessions.length, filters.filtered)}
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmationModal
        isOpen={!!deletion.pending}
        onClose={deletion.cancel}
        onConfirm={() => void deletion.confirm()}
        title="Delete session history"
        description="Are you sure you want to delete this session history? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={deletion.deleting}
      />
    </>
  );
};
