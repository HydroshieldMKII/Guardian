import { config } from "@/lib/config";
import type { AppFilter, SessionHistoryEntry } from "@/lib/session-history";

export interface SessionHistoryFilter {
  search: string;
  terminatedOnly: boolean;
  app: AppFilter;
}

const historyUrl = (path: string) =>
  `${config.api.baseUrl}/sessions/history/${path}`;

export const sessionHistoryApi = {
  async page(
    userId: string,
    filter: SessionHistoryFilter,
    offset: number,
    limit: number,
  ): Promise<SessionHistoryEntry[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      includeActive: "true",
    });
    if (filter.search) {
      params.set("search", filter.search);
    }
    if (filter.terminatedOnly) {
      params.set("terminatedOnly", "true");
    }
    if (filter.app !== "all") {
      params.set("app", filter.app);
    }

    const response = await fetch(historyUrl(`${userId}?${params.toString()}`));
    if (!response.ok) {
      throw new Error("Failed to fetch user history");
    }
    const data: unknown = await response.json();
    return (Array.isArray(data) ? data : []) as SessionHistoryEntry[];
  },

  async remove(sessionId: number): Promise<boolean> {
    const response = await fetch(historyUrl(String(sessionId)), {
      method: "DELETE",
    });
    return response.ok;
  },
};
