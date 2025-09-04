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
} from "lucide-react";

import { PlexSession, StreamsResponse } from "@/types";

export function StreamsList() {
  const [streams, setStreams] = useState<PlexSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingAuth, setRevokingAuth] = useState<string | null>(null);

  const fetchStreams = async () => {
    try {
      setRefreshing(true);
      const response = await fetch("http://localhost:3001/sessions/active");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: StreamsResponse = await response.json();
      setStreams(data?.MediaContainer?.Metadata || []);
      setError(null);
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
    const interval = setInterval(fetchStreams, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

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
        `http://localhost:3001/devices/revoke/${encodeURIComponent(
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
        fetchStreams();
      } else {
        console.error("Failed to revoke device authorization");
      }
    } catch (error) {
      console.error("Error revoking device authorization:", error);
    } finally {
      setRevokingAuth(null);
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
      )} E${session.title}`;
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Tv className="w-5 h-5 mr-2" />
            Active Streams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2">
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
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Tv className="w-5 h-5 mr-2" />
              Active Streams ({streams.length})
            </CardTitle>
            <CardDescription className="mt-1">
              Real-time view of all active Plex streams
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStreams}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-center h-32 text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : streams.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
            <Pause className="w-6 h-6 mr-2" />
            No active streams
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {streams.map((stream, index) => (
                <div
                  key={stream.sessionKey || index}
                  className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {getContentTitle(stream)}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {stream.User?.title || "Unknown User"}
                        </div>
                        <div className="flex items-center">
                          <Monitor className="w-4 h-4 mr-1" />
                          {stream.Player?.title ||
                            stream.Player?.device ||
                            "Unknown Device"}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {stream.Player?.address || "Unknown Location"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          stream.Player?.state === "playing"
                            ? "default"
                            : "secondary"
                        }
                        className="flex items-center"
                      >
                        {stream.Player?.state === "playing" ? (
                          <Play className="w-3 h-3 mr-1" />
                        ) : (
                          <Pause className="w-3 h-3 mr-1" />
                        )}
                        {stream.Player?.state || "unknown"}
                      </Badge>
                      <Badge variant="outline">
                        {getStreamQuality(stream)}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeAuthorization(stream)}
                        disabled={
                          revokingAuth === stream.sessionKey ||
                          !stream.User?.id ||
                          !stream.Player?.machineIdentifier
                        }
                        className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        {revokingAuth === stream.sessionKey ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <UserX className="w-3 h-3 mr-1" />
                        )}
                        {revokingAuth === stream.sessionKey
                          ? "Revoking..."
                          : "Remove Auth"}
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {stream.duration && stream.viewOffset !== undefined && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>{formatDuration(stream.viewOffset)}</span>
                        <span>{formatDuration(stream.duration)}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${getProgressPercentage(
                              stream.viewOffset,
                              stream.duration
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Device Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center">
                      <Monitor className="w-3 h-3 mr-1" />
                      Platform: {stream.Player?.platform || "Unknown"}
                    </div>
                    <div className="flex items-center">
                      <Tv className="w-3 h-3 mr-1" />
                      Product: {stream.Player?.product || "Unknown"}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Session: {stream.sessionKey || "Unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
