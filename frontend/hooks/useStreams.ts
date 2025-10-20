import { useState, useCallback } from "react";
import { PlexSession, StreamsResponse } from "@/types";
import { config } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";

export const useStreamsData = () => {
  const [streams, setStreams] = useState<PlexSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStreamsData = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.api.baseUrl}/sessions/active`);
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
  }, [loading]);

  const updateStreamsFromProps = useCallback(
    (sessionsData: StreamsResponse | undefined) => {
      if (sessionsData) {
        setStreams(sessionsData.MediaContainer?.Metadata || []);
        setError(null);
      }
    },
    [],
  );

  return {
    streams,
    loading,
    error,
    fetchStreamsData,
    updateStreamsFromProps,
    setStreams,
    setError,
  };
};

export const useStreamActions = () => {
  const [revokingAuth, setRevokingAuth] = useState<string | null>(null);
  const { toast } = useToast();

  const revokeDeviceAuthorization = useCallback(
    async (stream: PlexSession): Promise<boolean> => {
      if (!stream.User?.id || !stream.Player?.machineIdentifier) {
        console.error("Missing user ID or device identifier");
        toast({
          title: "Error",
          description:
            "Missing user ID or device identifier. Cannot revoke access.",
          variant: "destructive",
        });
        return false;
      }

      const userId = stream.User.id;
      const deviceIdentifier = stream.Player.machineIdentifier;
      const deviceName = stream.Player?.title || "Unknown Device";
      const userName = stream.User?.title || "Unknown User";

      try {
        setRevokingAuth(stream.sessionKey);
        const response = await fetch(
          `${config.api.baseUrl}/devices/revoke/${encodeURIComponent(
            userId,
          )}/${encodeURIComponent(deviceIdentifier)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          console.log(result.message);

          toast({
            title: "Access Revoked",
            description: `Successfully revoked access for ${deviceName} (${userName}). The stream will be terminated shortly.`,
            variant: "success",
          });

          return true;
        } else {
          console.error("Failed to revoke device authorization");

          let errorMessage = "Failed to revoke device access.";
          try {
            const errorResult = await response.json();
            if (errorResult.message) {
              errorMessage = errorResult.message;
            }
          } catch {
            errorMessage = `Failed to revoke device access. Server returned ${response.status}.`;
          }

          toast({
            title: "Revocation Failed",
            description: errorMessage,
            variant: "destructive",
          });

          return false;
        }
      } catch (error) {
        console.error("Error revoking device authorization:", error);

        toast({
          title: "Network Error",
          description:
            "Unable to connect to the server. Please check your connection and try again.",
          variant: "destructive",
        });

        return false;
      } finally {
        setRevokingAuth(null);
      }
    },
    [toast],
  );

  return {
    revokingAuth,
    revokeDeviceAuthorization,
    setRevokingAuth,
  };
};
