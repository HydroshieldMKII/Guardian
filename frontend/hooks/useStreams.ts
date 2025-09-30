import { useState, useCallback } from 'react';
import { PlexSession, StreamsResponse } from '@/types';
import { config } from '@/lib/config';

export const useStreamsData = () => {
  const [streams, setStreams] = useState<PlexSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStreamsData = useCallback(async () => {
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
  }, [loading]);

  const updateStreamsFromProps = useCallback((sessionsData: StreamsResponse | undefined) => {
    if (sessionsData) {
      setStreams(sessionsData.MediaContainer?.Metadata || []);
      setError(null);
    }
  }, []);

  return {
    streams,
    loading,
    error,
    fetchStreamsData,
    updateStreamsFromProps,
    setStreams,
    setError
  };
};

export const useStreamActions = () => {
  const [revokingAuth, setRevokingAuth] = useState<string | null>(null);

  const revokeDeviceAuthorization = useCallback(async (stream: PlexSession): Promise<boolean> => {
    if (!stream.User?.id || !stream.Player?.machineIdentifier) {
      console.error("Missing user ID or device identifier");
      return false;
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
        return true;
      } else {
        console.error("Failed to revoke device authorization");
        return false;
      }
    } catch (error) {
      console.error("Error revoking device authorization:", error);
      return false;
    } finally {
      setRevokingAuth(null);
    }
  }, []);

  return {
    revokingAuth,
    revokeDeviceAuthorization,
    setRevokingAuth
  };
};