import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import {
  UserList,
  matchesFilter,
  SORT_LABEL,
  type UserFilter,
  type UserSort,
} from "@/components/device-management/UserList";
import type { UserDeviceGroup } from "@/components/device-management/user-group";

const device = (id: number): UserDevice => ({
  id,
  userId: "u-1",
  deviceIdentifier: `device-${id}`,
  deviceName: "TV",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 1,
});

const group = (overrides: Partial<UserDeviceGroup> = {}): UserDeviceGroup => ({
  user: { userId: "u-1", username: "alex" },
  devices: [device(1)],
  pendingCount: 0,
  approvedCount: 1,
  rejectedCount: 0,
  ...overrides,
});

const alex = group({ pendingCount: 2, devices: [device(1), device(2)] });
const sam = group({
  user: { userId: "u-2", username: "sam" },
  rejectedCount: 1,
});
const robin = group({ user: { userId: "u-3" }, devices: [] });

const renderList = (
  overrides: Partial<React.ComponentProps<typeof UserList>> = {},
) => {
  const props = {
    groups: [alex, sam, robin],
    allGroups: [alex, sam, robin],
    loading: false,
    selectedUserId: null,
    onSelect: jest.fn(),
    searchTerm: "",
    onSearchChange: jest.fn(),
    filter: "all" as UserFilter,
    onFilterChange: jest.fn(),
    sortBy: "pendingCount" as UserSort,
    onSortByChange: jest.fn(),
    sortOrder: "desc" as const,
    onSortOrderChange: jest.fn(),
    onShowHidden: jest.fn(),
    pendingCount: 3,
    refreshing: false,
    onRefresh: jest.fn(),
    ...overrides,
  };
  const view = render(<UserList {...props} />);
  return { ...view, props, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

const row = (name: string) =>
  screen.getByText(name, { exact: true }).closest("button") as HTMLElement;

describe("matchesFilter", () => {
  it.each([
    ["all", alex, true],
    ["all", robin, true],
    ["waiting", alex, true],
    ["waiting", sam, false],
    ["blocked", sam, true],
    ["blocked", alex, false],
  ] as const)("filters %s", (filter, target, expected) => {
    expect(matchesFilter(target, filter)).toBe(expected);
  });
});

describe("UserList", () => {
  it("lists users with their device summary", () => {
    renderList();

    expect(within(row("alex")).getByText("2 devices")).toBeInTheDocument();
    expect(
      within(row("sam")).getByText("1 device, 1 blocked"),
    ).toBeInTheDocument();
    expect(within(row("u-3")).getByText("0 devices")).toBeInTheDocument();
  });

  it("badges waiting devices for screen readers too", () => {
    renderList();

    expect(row("alex")).toHaveTextContent("2 waiting");
    expect(row("sam")).not.toHaveTextContent("waiting");
  });

  it("marks the selected user", () => {
    renderList({ selectedUserId: "u-2" });

    expect(row("sam")).toHaveAttribute("aria-current", "true");
    expect(row("alex")).not.toHaveAttribute("aria-current");
  });

  it("selects a user", async () => {
    const { user, props } = renderList();

    await user.click(row("sam"));

    expect(props.onSelect).toHaveBeenCalledWith("u-2");
  });

  it("reports search input", async () => {
    const { user, props } = renderList();

    await user.type(screen.getByLabelText("Search by user or device"), "a");

    expect(props.onSearchChange).toHaveBeenCalledWith("a");
  });

  it("presses the active filter and reports changes", async () => {
    const { user, props } = renderList({ filter: "waiting" });

    expect(screen.getByRole("button", { name: "Waiting" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Blocked" }));
    expect(props.onFilterChange).toHaveBeenCalledWith("blocked");
  });

  it("titles the sort button with the current sort", () => {
    renderList({ sortBy: "lastSeen" });

    expect(screen.getByRole("button", { name: "Sort users" })).toHaveAttribute(
      "title",
      "Sorted by last stream",
    );
  });

  it("offers every sort and reports the choice", async () => {
    const { user, props } = renderList();

    await user.click(screen.getByRole("button", { name: "Sort users" }));
    const items = await screen.findAllByRole("menuitem");

    expect(items.map((item) => item.textContent)).toEqual([
      ...Object.values(SORT_LABEL),
      "Ascending",
      "Descending",
    ]);

    await user.click(screen.getByRole("menuitem", { name: "Username" }));
    expect(props.onSortByChange).toHaveBeenCalledWith("username");
  });

  it("checks the current sort and order", async () => {
    const { user } = renderList({ sortBy: "streamCount", sortOrder: "asc" });

    await user.click(screen.getByRole("button", { name: "Sort users" }));

    const checked = (name: string) =>
      screen
        .getByRole("menuitem", { name })
        .querySelector("svg")
        ?.getAttribute("class");
    expect(
      await screen.findByRole("menuitem", { name: "Stream count" }),
    ).toBeInTheDocument();
    expect(checked("Stream count")).toContain("opacity-100");
    expect(checked("Username")).toContain("opacity-0");
    expect(checked("Ascending")).toContain("opacity-100");
    expect(checked("Descending")).toContain("opacity-0");
  });

  it("reports a sort order change", async () => {
    const { user, props } = renderList();

    await user.click(screen.getByRole("button", { name: "Sort users" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Ascending" }),
    );

    expect(props.onSortOrderChange).toHaveBeenCalledWith("asc");
  });

  it("opens hidden users", async () => {
    const { user, props } = renderList();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));

    expect(props.onShowHidden).toHaveBeenCalled();
  });

  it("shows skeleton rows while the first load runs", () => {
    const { container } = renderList({
      loading: true,
      groups: [],
      allGroups: [],
    });

    expect(container.querySelectorAll(".size-9.animate-pulse")).toHaveLength(6);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("keeps the list while a later load runs", () => {
    renderList({ loading: true });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("explains an empty list", () => {
    renderList({ groups: [], allGroups: [] });

    expect(
      screen.getByText(
        "No users yet. They appear here the first time they stream.",
      ),
    ).toBeInTheDocument();
  });

  it.each([[{ searchTerm: "zzz" }], [{ filter: "blocked" as UserFilter }]])(
    "says nothing matches when narrowed %#",
    (overrides) => {
      renderList({ groups: [], ...overrides });

      expect(screen.getByText("No users match")).toBeInTheDocument();
    },
  );

  it("treats a blank search as no search", () => {
    renderList({ groups: [], allGroups: [], searchTerm: "   " });

    expect(
      screen.getByText(
        "No users yet. They appear here the first time they stream.",
      ),
    ).toBeInTheDocument();
  });

  it("passes a class to the frame", () => {
    const { container } = renderList({ className: "extra-class" });

    expect(container.firstChild).toHaveClass("extra-class");
  });
});

describe("UserList approval queue row", () => {
  const queueRow = () =>
    screen.getByText("Approval queue").closest("button") as HTMLElement;

  it("is current while no user is open and shows the waiting count", () => {
    renderList();

    expect(queueRow()).toHaveAttribute("aria-current", "true");
    expect(within(queueRow()).getByText("3")).toBeInTheDocument();
  });

  it("goes back to the queue from an open user", async () => {
    const { user, props } = renderList({ selectedUserId: "u-1" });

    expect(queueRow()).not.toHaveAttribute("aria-current");
    await user.click(queueRow());

    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it("leaves out the count when nothing is waiting", () => {
    renderList({ pendingCount: 0 });

    expect(within(queueRow()).queryByText(/waiting/)).toBeNull();
  });
});

describe("UserList refresh", () => {
  it("refreshes on demand", async () => {
    const { user, props } = renderList();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(props.onRefresh).toHaveBeenCalled();
  });

  it("disables refresh while refreshing", () => {
    renderList({ refreshing: true });

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });
});
