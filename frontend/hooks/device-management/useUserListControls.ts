import { useDeferredValue, useMemo, useState } from "react";
import {
  matchesFilter,
  type UserFilter,
  type UserSort,
} from "@/components/device-management/UserList";
import {
  matchesSearch,
  sortGroups,
  type UserDeviceGroup,
} from "@/components/device-management/user-group";
import { useStoredChoice } from "@/hooks/use-stored-choice";

const USER_SORT_BY_KEY = "guardian-unified-sort-by";
const USER_SORT_ORDER_KEY = "guardian-unified-sort-order";

export function useUserListControls(userGroups: UserDeviceGroup[]) {
  const [filter, setFilter] = useState<UserFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [sortBy, setSortBy] = useStoredChoice<UserSort>(
    USER_SORT_BY_KEY,
    "pendingCount",
  );
  const [sortOrder, setSortOrder] = useStoredChoice<"asc" | "desc">(
    USER_SORT_ORDER_KEY,
    "desc",
  );

  const visibleGroups = useMemo(
    () => userGroups.filter((group) => matchesFilter(group, filter)),
    [userGroups, filter],
  );

  const groups = useMemo(
    () =>
      sortGroups(
        visibleGroups.filter((group) =>
          matchesSearch(group, deferredSearchTerm),
        ),
        sortBy,
        sortOrder,
      ),
    [visibleGroups, deferredSearchTerm, sortBy, sortOrder],
  );

  return {
    groups,
    filter,
    onFilterChange: setFilter,
    searchTerm,
    onSearchChange: setSearchTerm,
    sortBy,
    onSortByChange: setSortBy,
    sortOrder,
    onSortOrderChange: setSortOrder,
  };
}
