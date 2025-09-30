"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tv,
  RefreshCw,
  AlertCircle,
  Wifi,
  Search,
  Pause,
} from "lucide-react";

import { PlexSession, StreamsResponse } from "@/types";
import { useSwipeToRefresh } from "../hooks/useSwipeToRefresh";
import { config } from "@/lib/config";

// Import extracted components
import { 
  RemoveAccessModal, 
  StreamCard,
  getContentTitle,
  getDeviceIcon
} from "./streams";

interface StreamsListProps {
  sessionsData?: StreamsResponse;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
}

export default function StreamsList({
  sessionsData,
  onRefresh = () => {},
  autoRefresh = false,
  onAutoRefreshChange = () => {},
  onNavigateToDevice,
}: StreamsListProps) {
  const [streams, setStreams] = useState<PlexSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [confirmRemoveStream, setConfirmRemoveStream] =
    useState<PlexSession | null>(null);
  const [revokingAuth, setRevokingAuth] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Swipe to refresh functionality
  const swipeHandlers = useSwipeToRefresh({ onRefresh: handleRefresh });

  function handleRefresh() {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  }

  // Initialize state from props or fetch data
  useEffect(() => {
    if (sessionsData) {
      setStreams(sessionsData.MediaContainer?.Metadata || []);
      setError(null);
    } else {
      fetchStreamsData();
    }
  }, [sessionsData]);

  const fetchStreamsData = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.api.baseUrl}/sessions`);
      if (response.ok) {
        const data: StreamsResponse = await response.json();
        setStreams(data.MediaContainer?.Metadata || []);
      } else {
        setError("Failed to fetch streams data");
      }
    } catch (error) {
      console.error("Error fetching streams:", error);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Handle auto-refresh toggle  
  const handleAutoRefreshToggle = () => {
    onAutoRefreshChange(!autoRefresh);
  };

  // Filter streams based on search term
  const filteredStreams = streams.filter((stream) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      (stream.User?.title || "").toLowerCase().includes(searchLower) ||
      (stream.Player?.title || "").toLowerCase().includes(searchLower) ||
      (stream.Player?.platform || "").toLowerCase().includes(searchLower) ||
      (stream.title || "").toLowerCase().includes(searchLower) ||
      (stream.grandparentTitle || "").toLowerCase().includes(searchLower) ||
      (stream.Player?.product || "").toLowerCase().includes(searchLower)
    );
  });

  const handleRevokeAuthorization = async (stream: PlexSession) => {
    if (!stream.User?.id || !stream.Player?.machineIdentifier) {
      console.error("Missing user ID or device identifier");
      return;
    }

    const userId = stream.User.id;
    const deviceIdentifier = stream.Player.machineIdentifier;

    try {
      setRevokingAuth(stream.sessionKey);
      const response = await fetch(
        `${config.api.baseUrl}/devices/revoke/${encodeURIComponent(
          userId
        )}/${encodeURIComponent(deviceIdentifier)}`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        // Refresh the streams to reflect any changes
        handleRefresh();
      } else {
        console.error("Failed to revoke device authorization");
      }
    } catch (error) {
      console.error("Error revoking device authorization:", error);
    } finally {
      setRevokingAuth(null);
      setConfirmRemoveStream(null);
    }
  };

  const handleConfirmRemoveAccess = () => {
    if (confirmRemoveStream) {
      handleRevokeAuthorization(confirmRemoveStream);
    }
  };

  return (
    <Card {...swipeHandlers}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <Tv className="w-5 h-5 mr-2" />
              Active Streams (
              {searchTerm
                ? `${filteredStreams.length}/${streams.length}`
                : streams.length}
              )
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              Real-time view of all active Plex streams
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoRefreshToggle}
              className={`${
                autoRefresh ? "bg-green-50 border-green-200 text-green-700" : ""
              }`}
            >
              <Wifi
                className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-pulse" : ""}`}
              />
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search streams by username, device, content, or app..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
          {searchTerm && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filteredStreams.length} of {streams.length} streams
            </p>
          )}
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-600 dark:text-red-700 text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium mb-1">Connection Error</p>
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
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            {searchTerm ? (
              <>
                <Search className="w-6 h-6 mr-2" />
                No streams match your search
              </>
            ) : (
              <>
                <Pause className="w-6 h-6 mr-2" />
                No active streams
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredStreams.map((stream, index) => (
              <StreamCard
                key={stream.sessionKey || index}
                stream={stream}
                index={index}
                isExpanded={expandedStream === stream.sessionKey}
                isRevoking={revokingAuth === stream.sessionKey}
                onToggleExpand={() =>
                  setExpandedStream(
                    expandedStream === stream.sessionKey ? null : stream.sessionKey
                  )
                }
                onRemoveAccess={() => setConfirmRemoveStream(stream)}
                onNavigateToDevice={onNavigateToDevice}
              />
            ))}
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