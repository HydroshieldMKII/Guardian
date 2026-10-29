"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { RefreshButton } from "@/components/ui/refresh-button";

import { PlexSession, StreamsResponse } from "@/types";
import { useSwipeToRefresh } from "../hooks/useSwipeToRefresh";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useStreamsData, useStreamActions } from "../hooks/useStreams";
import {
  EMPTY_PLACEMENT,
  placeStreams,
  samePlacement,
} from "@/lib/stream-placement";

import { RemoveAccessModal, StreamCard } from "./streams";

interface StreamsListProps {
  sessionsData?: StreamsResponse;
  onRefresh?: () => void | Promise<void>;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  onNavigateToUser?: (userId: string) => void;
}

const TWO_COLUMN_MIN_WIDTH = 1280;

const streamKey = (stream: PlexSession, index: number) =>
  stream.sessionKey || `#${index}`;

export default function StreamsList({
  sessionsData,
  onRefresh = () => {},
  onNavigateToDevice,
  onNavigateToUser,
}: StreamsListProps) {
  // Custom hooks
  const { streams, error, fetchStreamsData, updateStreamsFromProps } =
    useStreamsData();

  const { revokingAuth, revokeDeviceAuthorization } = useStreamActions();

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [confirmRemoveStream, setConfirmRemoveStream] =
    useState<PlexSession | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Swipe to refresh functionality
  const swipeHandlers = useSwipeToRefresh({
    onRefresh: () => void handleRefresh(),
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setRefreshing(false);
    }
  }

  // Initialize state from props or fetch data
  useEffect(() => {
    if (sessionsData) {
      updateStreamsFromProps(sessionsData);
    } else {
      void fetchStreamsData();
    }
  }, [sessionsData, fetchStreamsData, updateStreamsFromProps]);

  // Filter streams based on search term
  const keyedStreams = useMemo(
    () =>
      streams.map((stream, index) => ({
        stream,
        key: streamKey(stream, index),
      })),
    [streams],
  );

  const filteredStreams = useMemo(() => {
    if (!deferredSearchTerm) return keyedStreams;

    const searchLower = deferredSearchTerm.toLowerCase();
    return keyedStreams.filter(
      ({ stream }) =>
        (stream.User?.title || "").toLowerCase().includes(searchLower) ||
        (stream.Player?.title || "").toLowerCase().includes(searchLower) ||
        (stream.Player?.platform || "").toLowerCase().includes(searchLower) ||
        (stream.title || "").toLowerCase().includes(searchLower) ||
        (stream.grandparentTitle || "").toLowerCase().includes(searchLower) ||
        (stream.Player?.product || "").toLowerCase().includes(searchLower),
    );
  }, [keyedStreams, deferredSearchTerm]);

  const streamKeys = useMemo(
    () => keyedStreams.map(({ key }) => key),
    [keyedStreams],
  );
  const [placement, setPlacement] = useState(EMPTY_PLACEMENT);
  const nextPlacement = placeStreams(streamKeys, placement, expandedStream);
  const settled = samePlacement(nextPlacement, placement);
  if (!settled) setPlacement(nextPlacement);
  const activePlacement = settled ? placement : nextPlacement;

  const singleColumn = useIsMobile(TWO_COLUMN_MIN_WIDTH);
  const columns = useMemo(() => {
    const position = new Map(
      activePlacement.order.map((key, index) => [key, index]),
    );
    const placed = filteredStreams
      .map(({ stream, key }, index) => ({
        stream,
        key,
        index: position.get(key) ?? index,
      }))
      .sort((a, b) => a.index - b.index);
    if (singleColumn) return [placed];
    if (deferredSearchTerm) {
      return [0, 1].map((column) =>
        placed.filter((_, rank) => rank % 2 === column),
      );
    }
    return [0, 1].map((column) =>
      placed.filter(({ key }) => activePlacement.columns[key] === column),
    );
  }, [filteredStreams, singleColumn, deferredSearchTerm, activePlacement]);

  const handleRevokeAuthorization = async (stream: PlexSession) => {
    const success = await revokeDeviceAuthorization(stream);
    if (success) {
      // Refresh the streams to reflect any changes
      void handleRefresh();
    }
    setConfirmRemoveStream(null);
  };

  const handleConfirmRemoveAccess = () => {
    if (confirmRemoveStream) {
      void handleRevokeAuthorization(confirmRemoveStream);
    }
  };

  return (
    <div {...swipeHandlers}>
      <h1 className="sr-only">Streams</h1>
      <div>
        <div className="mb-6">
          <div className="flex max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by user, device, title or app"
                aria-label="Search by user, device, title or app"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <RefreshButton
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
            />
          </div>
          {deferredSearchTerm && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing {filteredStreams.length} of {streams.length} streams
            </p>
          )}
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-blocked">
            <p className="text-sm font-medium mb-1">Cannot reach the server</p>
            <p className="text-xs text-muted-foreground px-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              className="mt-3"
            >
              Try again
            </Button>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed py-20 text-center">
            <p className="text-sm font-medium text-foreground">
              {deferredSearchTerm
                ? "No streams match your search"
                : "No active streams"}
            </p>
            <p className="text-xs text-muted-foreground">
              {deferredSearchTerm
                ? "Try a different title, user or device."
                : "Streams appear here as soon as someone starts playing."}
            </p>
          </div>
        ) : (
          <div className="mb-4 flex flex-col gap-4 xl:grid xl:grid-cols-2 xl:items-start">
            {columns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                data-testid="stream-column"
                className="contents xl:flex xl:flex-col xl:gap-4"
              >
                {column.map(({ stream, key, index }) => (
                  <div key={key} style={{ order: index }}>
                    <StreamCard
                      stream={stream}
                      isExpanded={expandedStream === key}
                      isRevoking={revokingAuth === stream.sessionKey}
                      onToggleExpand={() =>
                        setExpandedStream(expandedStream === key ? null : key)
                      }
                      onRemoveAccess={() => setConfirmRemoveStream(stream)}
                      onNavigateToDevice={onNavigateToDevice}
                      onNavigateToUser={onNavigateToUser}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <RemoveAccessModal
        stream={confirmRemoveStream}
        onConfirm={handleConfirmRemoveAccess}
        onCancel={() => setConfirmRemoveStream(null)}
        isRemoving={revokingAuth !== null}
      />
    </div>
  );
}
