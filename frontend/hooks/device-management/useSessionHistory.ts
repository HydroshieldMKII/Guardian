import { useCallback, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { SessionHistoryEntry } from "@/lib/session-history";
import {
  sessionHistoryApi,
  type SessionHistoryFilter,
} from "@/lib/session-history-api";

const PAGE_SIZE = 25;
const ACTIVE_POLL_MS = 10000;
const NO_SESSIONS: SessionHistoryEntry[] = [];

type HistoryPages = InfiniteData<SessionHistoryEntry[], number>;

const uniqueSessions = (pages: SessionHistoryEntry[][]) => {
  const seen = new Set<number>();
  return pages.flat().filter((session) => {
    if (seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
};

const hasActiveSession = (data?: HistoryPages) =>
  !!data?.pages.some((page) => page.some((session) => !session.endedAt));

export const useSessionHistory = (
  userId: string | null,
  filter: SessionHistoryFilter,
  enabled: boolean,
) => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: sessions = NO_SESSIONS,
    isLoading,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.sessionHistory.forUser(userId ?? "", filter),
    queryFn: ({ pageParam }) =>
      sessionHistoryApi.page(userId ?? "", filter, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? uniqueSessions(allPages).length : null,
    select: (data) => uniqueSessions(data.pages),
    enabled: enabled && !!userId,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      hasActiveSession(query.state.data) ? ACTIVE_POLL_MS : false,
  });

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isPlaceholderData) return;
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const removeSession = (sessionId: number) => {
    queryClient.setQueriesData<HistoryPages>(
      { queryKey: queryKeys.sessionHistory.all },
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) =>
            page.filter((session) => session.id !== sessionId),
          ),
        },
    );
  };

  return {
    sessions,
    firstLoad: isLoading,
    switching: isPlaceholderData,
    hasMore: hasNextPage && !isFetchNextPageError,
    loadingMore: isFetchingNextPage,
    loadMore,
    refreshing,
    refresh,
    removeSession,
  };
};
