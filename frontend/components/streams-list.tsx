"use client";

import React, { useState, useEffect, useMemo, useDeferredValue } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

import { PlexSession, StreamsResponse } from "@/types";
import { useSwipeToRefresh } from "../hooks/useSwipeToRefresh";
import { useStreamsData, useStreamActions } from "../hooks/useStreams";

import { RemoveAccessModal, StreamCard, getContentTitle } from "./streams";

const StreamCardPlaceholder = () => (
  <div
    aria-hidden
    className="hidden rounded-xl border border-dashed bg-muted/20 xl:block"
  >
    <div className="space-y-5 p-4 opacity-40 sm:space-y-6 sm:p-6">
      <div className="flex gap-4">
        <div className="hidden h-24 w-16 shrink-0 rounded-lg bg-muted sm:block" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted" />
    </div>
  </div>
);

const AUTO_REFRESH_ON = "Guardian is refreshing on its own. Click to stop.";
const AUTO_REFRESH_OFF =
  "Refreshing only when you ask. Click to refresh on its own.";

interface StreamsListProps {
  tabs?: React.ReactNode;
  sessionsData?: StreamsResponse;
  onRefresh?: () => void | Promise<void>;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  onNavigateToUser?: (userId: string) => void;
}

export default function StreamsList({
  tabs,
  sessionsData,
  onRefresh = () => {},
  autoRefresh = false,
  onAutoRefreshChange = () => {},
  onNavigateToDevice,
  onNavigateToUser,
}: StreamsListProps) {
  // Custom hooks
  const { streams, loading, error, fetchStreamsData, updateStreamsFromProps } =
    useStreamsData();

  const { revokingAuth, revokeDeviceAuthorization, setRevokingAuth } =
    useStreamActions();

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [confirmRemoveStream, setConfirmRemoveStream] =
    useState<PlexSession | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Swipe to refresh functionality
  const swipeHandlers = useSwipeToRefresh({ onRefresh: handleRefresh });

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
      fetchStreamsData();
    }
  }, [sessionsData, fetchStreamsData, updateStreamsFromProps]);

  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = () => {
    onAutoRefreshChange(!autoRefresh);
  };

  // Filter streams based on search term
  const filteredStreams = useMemo(() => {
    if (!deferredSearchTerm) return streams;

    const searchLower = deferredSearchTerm.toLowerCase();
    return streams.filter(
      (stream) =>
        (stream.User?.title || "").toLowerCase().includes(searchLower) ||
        (stream.Player?.title || "").toLowerCase().includes(searchLower) ||
        (stream.Player?.platform || "").toLowerCase().includes(searchLower) ||
        (stream.title || "").toLowerCase().includes(searchLower) ||
        (stream.grandparentTitle || "").toLowerCase().includes(searchLower) ||
        (stream.Player?.product || "").toLowerCase().includes(searchLower),
    );
  }, [streams, deferredSearchTerm]);

  const handleRevokeAuthorization = async (stream: PlexSession) => {
    const success = await revokeDeviceAuthorization(stream);
    if (success) {
      // Refresh the streams to reflect any changes
      handleRefresh();
    }
    setConfirmRemoveStream(null);
  };

  const handleConfirmRemoveAccess = () => {
    if (confirmRemoveStream) {
      handleRevokeAuthorization(confirmRemoveStream);
    }
  };

  return (
    <Card {...swipeHandlers}>
      <CardHeader className="py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">{tabs}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoRefreshToggle}
              title={autoRefresh ? AUTO_REFRESH_ON : AUTO_REFRESH_OFF}
              className={
                autoRefresh
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : ""
              }
            >
              {autoRefresh ? "Live" : "Manual"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by user, device, title or app"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
          {deferredSearchTerm && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filteredStreams.length} of {streams.length} streams
            </p>
          )}
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-600 dark:text-red-700 text-center">
            <p className="text-sm font-medium mb-1">
              Guardian cannot reach the server
            </p>
            <p className="text-xs text-muted-foreground px-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-20 text-center">
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
          <div className="mb-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {filteredStreams.map((stream, index) => (
              <StreamCard
                key={stream.sessionKey || index}
                stream={stream}
                index={index}
                isExpanded={expandedStream === stream.sessionKey}
                isRevoking={revokingAuth === stream.sessionKey}
                onToggleExpand={() =>
                  setExpandedStream(
                    expandedStream === stream.sessionKey
                      ? null
                      : stream.sessionKey,
                  )
                }
                onRemoveAccess={() => setConfirmRemoveStream(stream)}
                onNavigateToDevice={onNavigateToDevice}
                onNavigateToUser={onNavigateToUser}
              />
            ))}
            {filteredStreams.length % 2 === 1 && <StreamCardPlaceholder />}
          </div>
        )}
      </CardContent>

      {/* Remove Access Confirmation Modal */}
      <RemoveAccessModal
        stream={confirmRemoveStream}
        onConfirm={handleConfirmRemoveAccess}
        onCancel={() => setConfirmRemoveStream(null)}
        isRemoving={revokingAuth !== null}
      />
    </Card>
  );
}
