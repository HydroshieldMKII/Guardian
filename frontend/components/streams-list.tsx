"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  Monitor,
  Clock,
  MapPin,
  Wifi,
  User,
  Tv,
  RefreshCw,
  AlertCircle,
  UserX,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Tablet,
  Laptop,
  Search,
} from "lucide-react";

import { PlexSession, StreamsResponse } from "@/types";
import { useSwipeToRefresh } from "../hooks/useSwipeToRefresh";
import { config } from "@/lib/config";

export function StreamsList() {
  const [streams, setStreams] = useState<PlexSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingAuth, setRevokingAuth] = useState<string | null>(null);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [confirmRemoveStream, setConfirmRemoveStream] =
    useState<PlexSession | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const swipeHandlers = useSwipeToRefresh({
    onRefresh: () => fetchStreams(),
    enabled: true,
  });

  const fetchStreams = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }
      const response = await fetch(`${config.api.baseUrl}/sessions/active`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: StreamsResponse = await response.json();
      setStreams(data?.MediaContainer?.Metadata || []);
      setError(null);
      setLastUpdateTime(new Date());
    } catch (error: any) {
      console.error("Failed to fetch streams:", error);
      setError(error.message || "Failed to fetch streams");
      setStreams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    let interval: NodeJS.Timeout;

    if (autoRefresh) {
      interval = setInterval(() => fetchStreams(true), 5000); // More frequent updates (5 seconds)
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Filter streams based on search term
  const filteredStreams = streams.filter((stream) => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const username = stream.User?.title?.toLowerCase() || "";
    const deviceName = stream.Player?.device?.toLowerCase() || stream.Player?.title?.toLowerCase() || "";
    const contentTitle = stream.title?.toLowerCase() || "";
    const deviceProduct = stream.Player?.product?.toLowerCase() || "";
    
    return (
      username.includes(searchLower) ||
      deviceName.includes(searchLower) ||
      contentTitle.includes(searchLower) ||
      deviceProduct.includes(searchLower)
    );
  });

  const handleRevokeAuthorization = async (stream: PlexSession) => {
    const userId = stream.User?.id;
    const deviceIdentifier = stream.Player?.machineIdentifier;

    if (!userId || !deviceIdentifier) {
      console.error("Missing user ID or device identifier");
      return;
    }

    try {
      setRevokingAuth(stream.sessionKey);
      const response = await fetch(
        `${config.api.baseUrl}/devices/revoke/${encodeURIComponent(
          userId,
        )}/${encodeURIComponent(deviceIdentifier)}`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        // Refresh the streams to reflect any changes
        fetchStreams();
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

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(
        seconds % 60
      )
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = (
    viewOffset: number = 0,
    duration: number = 0,
  ) => {
    if (!duration) return 0;
    return Math.min(100, (viewOffset / duration) * 100);
  };

  const getContentTitle = (session: PlexSession) => {
    if (session.type === "episode" && session.grandparentTitle) {
      return `${session.grandparentTitle} - S${session.parentTitle?.replace(
        "Season ",
        "",
      )} ${session.title}`;
    }
    if (session.type === "movie") {
      return `${session.title} (${session.year})`;
    }
    return session.title || "Unknown Title";
  };

  const getStreamQuality = (session: PlexSession) => {
    const media = session.Media?.[0];
    if (!media) return "Unknown";

    const resolution = media.videoResolution?.toUpperCase() || "";
    const bitrate = media.bitrate
      ? `${Math.round(media.bitrate / 1000)}Mbps`
      : "";

    if (resolution && bitrate) {
      return `${resolution} • ${bitrate}`;
    }
    return resolution || bitrate || "Unknown";
  };

  const getDeviceIcon = (platform: string = "") => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes("android") || platformLower.includes("ios")) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (platformLower.includes("tablet") || platformLower.includes("ipad")) {
      return <Tablet className="w-4 h-4" />;
    }
    if (
      platformLower.includes("windows") ||
      platformLower.includes("macos") ||
      platformLower.includes("linux")
    ) {
      return <Laptop className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const formatLastUpdate = () => {
    const now = new Date();
    const diffInSeconds = Math.floor(
      (now.getTime() - lastUpdateTime.getTime()) / 1000,
    );

    if (diffInSeconds < 60) {
      return `Updated ${diffInSeconds}s ago`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    return `Updated ${diffInMinutes}m ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg sm:text-xl">
            <Tv className="w-5 h-5 mr-2" />
            Active Streams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 sm:h-40">
            <div className="flex items-center space-x-1 mb-4">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground">Loading streams...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card {...swipeHandlers}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <Tv className="w-5 h-5 mr-2" />
              Active Streams ({searchTerm ? `${filteredStreams.length}/${streams.length}` : streams.length})
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              Real-time view of all active Plex streams
            </CardDescription>
            <div className="text-xs text-muted-foreground mt-1">
              {formatLastUpdate()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
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
              onClick={() => fetchStreams()}
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
          <div className="flex flex-col items-center justify-center h-32 sm:h-40 text-red-600 dark:text-red-400 text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium mb-1">Connection Error</p>
            <p className="text-xs text-muted-foreground px-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStreams()}
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 sm:h-40 text-slate-500 dark:text-slate-400 text-center">
            {searchTerm ? (
              <>
                <Search className="w-8 h-8 mb-2" />
                <p className="text-sm font-medium mb-1">No streams found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search terms
                </p>
              </>
            ) : (
              <>
                <Pause className="w-8 h-8 mb-2" />
                <p className="text-sm font-medium mb-1">No Active Streams</p>
                <p className="text-xs text-muted-foreground">
                  {autoRefresh
                    ? "Monitoring for new streams..."
                    : "Pull down to refresh"}
                </p>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[50vh] max-h-[400px] sm:max-h-[500px] lg:max-h-[600px]">
            <div className="space-y-3 sm:space-y-4">
              {filteredStreams.map((stream, index) => (
                <div
                  key={stream.sessionKey || index}
                  className="relative p-3 sm:p-4 rounded-lg border bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-800/20 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {/* Mobile-first compact header */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm sm:text-base line-clamp-2 break-words leading-tight">
                        {getContentTitle(stream)}
                      </h3>

                      {/* Primary info row - always visible */}
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full min-w-0 flex-shrink-0">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[80px] sm:max-w-[120px]">
                            {stream.User?.title || "Unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full min-w-0 flex-shrink-0">
                          {getDeviceIcon(stream.Player?.platform)}
                          <span className="truncate max-w-[60px] sm:max-w-[100px]">
                            {stream.Player?.title?.split(" ")[0] || "Device"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status and actions */}
                    <div className="flex flex-col items-end gap-2 ml-2">
                      <Badge
                        variant={
                          stream.Player?.state === "playing"
                            ? "default"
                            : "secondary"
                        }
                        className="flex items-center text-xs"
                      >
                        {stream.Player?.state === "playing" ? (
                          <Play className="w-3 h-3 mr-1" />
                        ) : (
                          <Pause className="w-3 h-3 mr-1" />
                        )}
                        {stream.Player?.state || "unknown"}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedStream(
                            expandedStream === stream.sessionKey
                              ? null
                              : stream.sessionKey,
                          )
                        }
                        className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                      >
                        {expandedStream === stream.sessionKey ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar  */}
                  {stream.duration && stream.viewOffset !== undefined && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 gap-2">
                        <span className="flex-shrink-0">
                          {formatDuration(stream.viewOffset)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 max-w-[100px] truncate flex-shrink-0"
                        >
                          {getStreamQuality(stream)}
                        </Badge>
                        <span className="flex-shrink-0">
                          {formatDuration(stream.duration)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 relative overflow-hidden"
                          style={{
                            width: `${getProgressPercentage(
                              stream.viewOffset,
                              stream.duration,
                            )}%`,
                          }}
                        >
                          {stream.Player?.state === "playing" && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expandable details */}
                  {expandedStream === stream.sessionKey && (
                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                      {/* Detailed device info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded min-w-0">
                          <Monitor className="w-3 h-3 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">Platform</div>
                            <div className="truncate">
                              {stream.Player?.platform || "Unknown"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded min-w-0">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">Location</div>
                            <div className="truncate">
                              {stream.Player?.address || "Unknown"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded min-w-0">
                          <Tv className="w-3 h-3 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">Product</div>
                            <div className="truncate">
                              {stream.Player?.product || "Unknown"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded min-w-0">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">Session</div>
                            <div className="truncate">
                              {stream.sessionKey || "Unknown"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action button */}
                      <div className="flex justify-end pt-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmRemoveStream(stream)}
                          disabled={
                            revokingAuth === stream.sessionKey ||
                            !stream.User?.id ||
                            !stream.Player?.machineIdentifier
                          }
                          className="h-8 text-xs"
                        >
                          {revokingAuth === stream.sessionKey ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <UserX className="w-3 h-3 mr-1" />
                          )}
                          {revokingAuth === stream.sessionKey
                            ? "Removing..."
                            : "Remove Access"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Remove Access Confirmation Dialog */}
      <Dialog
        open={!!confirmRemoveStream}
        onOpenChange={(open) => !open && setConfirmRemoveStream(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-500" />
              Remove Device Access
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove access for this device? This will
              immediately stop the current stream and prevent future access
              until the device is re-approved.
            </DialogDescription>
          </DialogHeader>

          {confirmRemoveStream && (
            <div className="my-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 break-words leading-tight">
                {getContentTitle(confirmRemoveStream)}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                <div className="flex items-center gap-1 min-w-0">
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {confirmRemoveStream.User?.title || "Unknown User"}
                  </span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  {getDeviceIcon(confirmRemoveStream.Player?.platform)}
                  <span className="truncate max-w-[120px]">
                    {confirmRemoveStream.Player?.title || "Unknown Device"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRemoveStream(null)}
              disabled={revokingAuth !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemoveAccess}
              disabled={revokingAuth !== null}
            >
              {revokingAuth ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Remove Access
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
