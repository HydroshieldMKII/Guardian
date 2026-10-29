import { config } from "@/lib/config";
import type { PlexSession } from "@/types";

interface PlexWebUrlResponse {
  webUrl?: string;
}

const itemRatingKey = (stream: PlexSession) =>
  stream.type === "track" && stream.parentRatingKey
    ? stream.parentRatingKey
    : stream.ratingKey;

const detailsUrl = (webUrl: string, server: string, ratingKey: string) =>
  `${webUrl}/web/index.html#!/server/${server}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;

export async function openInPlex(stream: PlexSession) {
  const ratingKey = itemRatingKey(stream);
  if (!ratingKey) {
    console.warn("No rating key found for stream");
    return;
  }

  const serverIdentifier = stream.serverMachineIdentifier;
  if (!serverIdentifier) {
    console.error("No server machine identifier available");
    return;
  }

  const newWindow = window.open("about:blank", "_blank");

  try {
    const response = await fetch(`${config.api.baseUrl}/plex/web-url`);
    const data = (await response.json()) as PlexWebUrlResponse;

    if (!data.webUrl) {
      console.warn("No Plex web URL available");
      newWindow?.close();
      return;
    }

    if (newWindow) {
      newWindow.location.href = detailsUrl(
        data.webUrl,
        serverIdentifier,
        ratingKey,
      );
    }
  } catch (error) {
    console.error("Failed to get Plex web URL:", error);
    newWindow?.close();
  }
}
