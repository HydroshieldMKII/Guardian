import type { Tone } from "@/components/ui/entity";
import { formatElapsed } from "@/lib/duration";

export interface HistoryDevice {
  id: number;
  userId: string;
  deviceIdentifier: string;
  deviceName?: string;
  devicePlatform?: string;
  deviceProduct?: string;
  deviceVersion?: string;
  status: string;
  sessionCount: number;
}

export interface SessionHistoryEntry {
  id: number;
  sessionKey: string;
  userId: string;
  username?: string;
  userDevice?: HistoryDevice;
  deviceAddress?: string;
  contentTitle?: string;
  contentType?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  year?: number;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  viewOffset?: number;
  terminated?: boolean;
  thumb?: string;
  art?: string;
  product?: string;
}

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
};

export const sessionTitle = (session: SessionHistoryEntry) => {
  if (session.contentType === "episode" && session.grandparentTitle) {
    let result = session.grandparentTitle;
    if (session.parentTitle && session.contentTitle) {
      result += ` - ${session.parentTitle}: ${session.contentTitle}`;
    } else if (session.parentTitle) {
      result += ` - ${session.parentTitle}`;
    } else if (session.contentTitle) {
      result += ` - ${session.contentTitle}`;
    }
    return result;
  }

  return session.contentTitle || "Unknown title";
};

export const sessionSubtitle = (session: SessionHistoryEntry) => {
  if (session.contentType === "track" && session.grandparentTitle) {
    if (session.year) {
      return `${session.grandparentTitle} • ${session.year}`;
    }
    return session.grandparentTitle;
  }

  return session.year ? String(session.year) : null;
};

export const sessionDeviceName = (session: SessionHistoryEntry) =>
  session.userDevice?.deviceName ||
  session.userDevice?.deviceProduct ||
  "Unknown device";

export const sessionProduct = (session: SessionHistoryEntry) => {
  const product = session.product || session.userDevice?.deviceProduct;
  if (!product) return "Unknown";

  if (product.toLowerCase() === "plexamp") {
    return "Plexamp";
  }

  return "Plex";
};

export const sessionDuration = (session: SessionHistoryEntry) => {
  const endTime = session.endedAt
    ? new Date(session.endedAt).getTime()
    : Date.now();

  return formatElapsed(endTime - new Date(session.startedAt).getTime());
};

export const sessionTone = (session: SessionHistoryEntry): Tone => {
  if (!session.endedAt) return "positive";
  return session.terminated ? "danger" : "neutral";
};
