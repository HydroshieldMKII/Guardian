import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionHistoryFilters } from "@/components/device-management/SessionHistoryFilters";
import type { AppFilter } from "@/lib/session-history";

const renderFilters = (appFilter: AppFilter = "all") => {
  const props = {
    searchTerm: "",
    onSearchChange: jest.fn(),
    refreshing: false,
    refreshDisabled: false,
    onRefresh: jest.fn(),
    appFilter,
    onAppFilterChange: jest.fn(),
    terminatedOnly: false,
    onTerminatedOnlyChange: jest.fn(),
  };
  render(<SessionHistoryFilters {...props} />);
  return { props, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

describe("SessionHistoryFilters", () => {
  it("reports typing, app picks and the terminated switch", async () => {
    const { props, user } = renderFilters();

    await user.type(
      screen.getByPlaceholderText("Search by title, device or IP address"),
      "a",
    );
    await user.click(screen.getByRole("button", { name: "Plexamp" }));
    await user.click(screen.getByRole("switch"));

    expect(props.onSearchChange).toHaveBeenCalledWith("a");
    expect(props.onAppFilterChange).toHaveBeenCalledWith("plexamp");
    expect(props.onTerminatedOnlyChange).toHaveBeenCalledWith(true);
  });

  it("locks the terminated switch for Plexamp, which is never stopped", () => {
    renderFilters("plexamp");

    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      screen.getByTitle("Plexamp streams are never terminated"),
    ).toBeInTheDocument();
  });

  it("lets the filter row wrap so the label is never clipped on a phone", () => {
    renderFilters();

    const row = screen.getByText("Terminated only").closest(".flex-wrap");

    expect(row).not.toBeNull();
  });
});
