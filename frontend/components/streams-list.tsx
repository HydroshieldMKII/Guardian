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
  ExternalLink,
  Video,
  Headphones,
  HardDrive,
  Signal,
  X,
} from "lucide-react";

import { PlexSession, StreamsResponse } from "@/types";
import { useSwipeToRefresh } from "../hooks/useSwipeToRefresh";
import { config } from "@/lib/config";

interface StreamsListProps {
  sessionsData?: StreamsResponse;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void;
}

const ClickableIP = ({ ipAddress }: { ipAddress: string | null }) => {
  if (!ipAddress || ipAddress === "Unknown IP" || ipAddress === "Unknown") {
    return <span className="truncate">{ipAddress || "Unknown"}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    window.open(
      `https://ipinfo.io/${ipAddress}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <button
      onClick={handleClick}
      className="truncate text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors"
      title={`Look up ${ipAddress} on ipinfo.io`}
    >
      <span className="truncate">{ipAddress}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
    </button>
  );
};

// Stream skeleton for loading states
const StreamSkeleton = () => (
  <div className="relative p-3 sm:p-4 rounded-lg border bg-card shadow-sm animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-5 bg-muted rounded w-48"></div>
        </div>
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-24"></div>
        </div>
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-32"></div>
        </div>
        <div className="w-full bg-muted rounded h-2 mb-2"></div>
        <div className="h-3 bg-muted rounded w-20"></div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-8 bg-muted rounded w-20"></div>
        <div className="h-6 bg-muted rounded w-16"></div>
      </div>
    </div>
  </div>
);

export function StreamsList({ sessionsData, onRefresh, autoRefresh: parentAutoRefresh, onAutoRefreshChange }: StreamsListProps) {
  const [streams, setStreams] = useState<PlexSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingAuth, setRevokingAuth] = useState<string | null>(null);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(parentAutoRefresh ?? true);
  const [confirmRemoveStream, setConfirmRemoveStream] =
    useState<PlexSession | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Update streams when sessionsData prop changes
  useEffect(() => {
    if (sessionsData) {
      const newStreams = sessionsData?.MediaContainer?.Metadata || [];
      
      // Only update if data actually changed
      const currentStreamsString = JSON.stringify(streams);
      const newStreamsString = JSON.stringify(newStreams);
      
      if (currentStreamsString !== newStreamsString) {
        setStreams(newStreams);
        setLastUpdateTime(new Date());
      }
      
      setError(null);
      setLoading(false);
    }
  }, [sessionsData, streams]);

  // Sync local autoRefresh with parent
  useEffect(() => {
    if (parentAutoRefresh !== undefined) {
      setAutoRefresh(parentAutoRefresh);
    }
  }, [parentAutoRefresh]);

  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    if (onAutoRefreshChange) {
      onAutoRefreshChange(newValue);
    }
  };

  const swipeHandlers = useSwipeToRefresh({
    onRefresh: onRefresh || (() => {}),
    enabled: true,
  });

  const handleRefresh = () => {
    if (onRefresh) {
      setRefreshing(true);
      onRefresh();
      // Reset refreshing state after a short delay
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  // Filter and sort streams based on search term
  const filteredStreams = streams
    .filter((stream) => {
      if (!searchTerm.trim()) return true;

      const searchLower = searchTerm.toLowerCase();
      const username = stream.User?.title?.toLowerCase() || "";
      const deviceName =
        stream.Player?.device?.toLowerCase() ||
        stream.Player?.title?.toLowerCase() ||
        "";
      const contentTitle = stream.title?.toLowerCase() || "";
      const deviceProduct = stream.Player?.product?.toLowerCase() || "";

      return (
        username.includes(searchLower) ||
        deviceName.includes(searchLower) ||
        contentTitle.includes(searchLower) ||
        deviceProduct.includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Sort by user first, then by content title
      const userA = a.User?.title || "";
      const userB = b.User?.title || "";
      const titleA = a.title || "";
      const titleB = b.title || "";

      if (userA !== userB) {
        return userA.localeCompare(userB);
      }
      return titleA.localeCompare(titleB);
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
    duration: number = 0
  ) => {
    if (!duration) return 0;
    return Math.min(100, (viewOffset / duration) * 100);
  };

  const getContentTitle = (session: PlexSession) => {
    if (session.type === "episode" && session.grandparentTitle) {
      return `${session.grandparentTitle} - S${session.parentTitle?.replace(
        "Season ",
        ""
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

  const getDetailedQuality = (session: PlexSession) => {
    const media = session.Media?.[0];
    if (!media) return null;

    return {
      resolution: media.videoResolution?.toUpperCase() || "Unknown",
      bitrate: media.bitrate ? `${Math.round(media.bitrate / 1000)} Mbps` : "Unknown",
      videoCodec: media.videoCodec?.toUpperCase() || "Unknown",
      audioCodec: media.audioCodec?.toUpperCase() || "Unknown", 
      container: media.container?.toUpperCase() || "Unknown",
      bandwidth: session.Session?.bandwidth ? `${Math.round(session.Session.bandwidth / 1000)} Mbps` : "Unknown"
    };
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
          <div className="flex flex-col items-center justify-center h-32 sm:h-40 text-red-600 dark:text-red-700 text-center">
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
        ) : (loading && streams.length === 0) ? (
          // Show skeleton loading only on initial load when no data exists yet
          <ScrollArea className="h-[60vh] max-h-[600px] sm:max-h-[700px] lg:max-h-[800px]">
            <div className="space-y-3 sm:space-y-4">
              {Array.from({ length: 3 }, (_, i) => (
                <StreamSkeleton key={`stream-skeleton-${i}`} />
              ))}
            </div>
          </ScrollArea>
        ) : filteredStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] max-h-[600px] sm:max-h-[700px] lg:max-h-[800px] text-muted-foreground text-center">
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
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[60vh] max-h-[600px] sm:max-h-[700px] lg:max-h-[800px]">
            <div className="space-y-3 sm:space-y-4">
              {filteredStreams.map((stream, index) => (
                <div
                  key={stream.sessionKey || index}
                  className="relative p-3 sm:p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  {/* Responsive header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1 text-sm sm:text-base break-words leading-tight">
                        {getContentTitle(stream)}
                      </h3>

                      {/* Primary info row */}
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground my-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full min-w-0">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-[150px]">
                            {stream.User?.title || "Unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full min-w-0">
                          {getDeviceIcon(stream.Player?.platform)}
                          <span className="truncate max-w-[100px] sm:max-w-[120px]">
                            {stream.Player?.title?.split(" ")[0] || "Device"}
                          </span>
                        </div>
                      </div>

                      {/* Quality info row - compact */}
                      {(() => {
                        const quality = getDetailedQuality(stream);
                        return quality && (quality.resolution !== "Unknown" || quality.videoCodec !== "Unknown") ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
                            {quality.resolution !== "Unknown" && (
                              <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                <Video className="w-3 h-3" />
                                <span>{quality.resolution}</span>
                              </div>
                            )}
                            {quality.videoCodec !== "Unknown" && (
                              <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                                <span>{quality.videoCodec}</span>
                              </div>
                            )}
                            {quality.bitrate !== "Unknown" && (
                              <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                <Signal className="w-3 h-3" />
                                <span>{quality.bitrate}</span>
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Status and actions */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto order-first sm:order-last">
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
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRemoveStream(stream)}
                          disabled={
                            revokingAuth === stream.sessionKey ||
                            !stream.User?.id ||
                            !stream.Player?.machineIdentifier
                          }
                          className="h-6 w-6 p-0 text-muted-foreground text-red-600"
                          title={revokingAuth === stream.sessionKey ? "Removing access..." : "Remove access"}
                        >
                          {revokingAuth === stream.sessionKey ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedStream(
                              expandedStream === stream.sessionKey
                                ? null
                                : stream.sessionKey
                            )
                          }
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          {expandedStream === stream.sessionKey ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar  */}
                  {stream.duration && stream.viewOffset !== undefined && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 gap-2">
                        <span className="flex-shrink-0">
                          {formatDuration(stream.viewOffset)}
                        </span>
                        <span className="flex-shrink-0">
                          {formatDuration(stream.duration)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 relative overflow-hidden"
                          style={{
                            width: `${getProgressPercentage(
                              stream.viewOffset,
                              stream.duration
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
                    <div className="space-y-3 pt-3 border-t border-border animate-in slide-in-from-top-2 duration-200">
                      {/* Quality Information Section */}
                      {(() => {
                        const quality = getDetailedQuality(stream);
                        return quality ? (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground mb-2">Stream Quality</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                                <Video className="w-3 h-3 flex-shrink-0 text-blue-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">Resolution</div>
                                  <div className="truncate">{quality.resolution}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                                <Signal className="w-3 h-3 flex-shrink-0 text-green-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">Bitrate</div>
                                  <div className="truncate">{quality.bitrate}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                                <Wifi className="w-3 h-3 flex-shrink-0 text-purple-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">Bandwidth</div>
                                  <div className="truncate">{quality.bandwidth}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                                <Video className="w-3 h-3 flex-shrink-0 text-orange-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">Video Codec</div>
                                  <div className="truncate">{quality.videoCodec}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                                <Headphones className="w-3 h-3 flex-shrink-0 text-red-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">Audio Codec</div>
                                  <div className="truncate">{quality.audioCodec}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                                <HardDrive className="w-3 h-3 flex-shrink-0 text-gray-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">Container</div>
                                  <div className="truncate">{quality.container}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Device Information Section */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-foreground mb-2">Device Information</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                            <Monitor className="w-3 h-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">Platform</div>
                              <div className="truncate">
                                {stream.Player?.platform || "Unknown"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">Location</div>
                              <div className="truncate">
                                <ClickableIP
                                  ipAddress={stream.Player?.address || null}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                            <Tv className="w-3 h-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">Product</div>
                              <div className="truncate">
                                {stream.Player?.product || "Unknown"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">Streams Started</div>
                              <div className="truncate">
                                {stream.Session?.sessionCount || 0}
                              </div>
                            </div>
                          </div>
                        </div>
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
              until the device is manually re-approved.
            </DialogDescription>
          </DialogHeader>

          {confirmRemoveStream && (
            <div className="my-4 p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium text-foreground mb-2 line-clamp-2 break-words leading-tight">
                {getContentTitle(confirmRemoveStream)}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
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
              className="bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
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
