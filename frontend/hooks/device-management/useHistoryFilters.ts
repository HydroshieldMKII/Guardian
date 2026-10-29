import { useEffect, useMemo, useState } from "react";
import type { AppFilter } from "@/lib/session-history";

const SEARCH_DEBOUNCE_MS = 300;

export function useHistoryFilters(isOpen: boolean) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [showTerminatedOnly, setShowTerminatedOnly] = useState(false);
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const terminatedOnly = showTerminatedOnly && appFilter !== "plexamp";

  useEffect(() => {
    const timeout = setTimeout(
      () => setActiveSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen) return;
    setSearchTerm("");
    setActiveSearch("");
    setShowTerminatedOnly(false);
    setAppFilter("all");
  }, [isOpen]);

  const filter = useMemo(
    () => ({ search: activeSearch, terminatedOnly, app: appFilter }),
    [activeSearch, terminatedOnly, appFilter],
  );

  return {
    searchTerm,
    setSearchTerm,
    appFilter,
    setAppFilter,
    terminatedOnly,
    setShowTerminatedOnly,
    filter,
    filtered: Boolean(activeSearch || terminatedOnly || appFilter !== "all"),
  };
}
