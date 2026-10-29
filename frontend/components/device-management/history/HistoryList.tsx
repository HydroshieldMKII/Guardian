import type { Ref } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/entity";
import type { SessionHistoryEntry } from "@/lib/session-history";
import { SessionHistoryCard } from "../SessionHistoryCard";

interface HistoryListProps {
  sessions: SessionHistoryEntry[];
  firstLoad: boolean;
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreRef: Ref<HTMLButtonElement>;
  onLoadMore: () => void;
  onSeeDevice: (session: SessionHistoryEntry) => void;
  onDelete: (session: SessionHistoryEntry) => void;
}

export function HistoryList({
  sessions,
  firstLoad,
  filtered,
  hasMore,
  loadingMore,
  loadMoreRef,
  onLoadMore,
  onSeeDevice,
  onDelete,
}: HistoryListProps) {
  if (firstLoad) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="size-5 animate-spin" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        className="min-h-80"
        title={
          filtered
            ? "No streams match your search"
            : "This user has not streamed anything yet"
        }
      />
    );
  }

  return (
    <>
      {sessions.map((session) => (
        <SessionHistoryCard
          key={session.id}
          session={session}
          onSeeDevice={() => onSeeDevice(session)}
          onDelete={() => onDelete(session)}
        />
      ))}

      {hasMore && (
        <Button
          ref={loadMoreRef}
          variant="outline"
          onClick={onLoadMore}
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
  );
}

export const historySummary = (count: number, filtered: boolean) =>
  `Showing ${count} session${count === 1 ? "" : "s"}${filtered ? " matching your filters" : ""}`;
