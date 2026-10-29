import { render, screen } from "@testing-library/react";
import { HistoryList, historySummary } from "./HistoryList";

const entry = { id: 1, sessionKey: "s-1", userId: "u-1", startedAt: "" };

describe("HistoryList", () => {
  it("shows that older sessions are loading", () => {
    render(
      <HistoryList
        sessions={[entry]}
        firstLoad={false}
        filtered={false}
        hasMore
        loadingMore
        loadMoreRef={null}
        onLoadMore={jest.fn()}
        onSeeDevice={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Loading more..." }),
    ).toBeDisabled();
  });
});

describe("historySummary", () => {
  it.each([
    [1, false, "Showing 1 session"],
    [2, false, "Showing 2 sessions"],
    [3, true, "Showing 3 sessions matching your filters"],
  ])("describes %i sessions", (count, filtered, text) => {
    expect(historySummary(count, filtered)).toBe(text);
  });
});
