import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionHistoryCard } from "@/components/device-management/SessionHistoryCard";
import type { SessionHistoryEntry } from "@/lib/session-history";

const session = (
  overrides: Partial<SessionHistoryEntry> = {},
): SessionHistoryEntry => ({
  id: 7,
  sessionKey: "key-7",
  userId: "u-1",
  contentTitle: "Arrival",
  year: 2016,
  startedAt: "2026-01-01T10:00:00Z",
  endedAt: "2026-01-01T11:00:00Z",
  ...overrides,
});

const renderCard = (overrides: Partial<SessionHistoryEntry> = {}) => {
  const onSeeDevice = jest.fn();
  const onDelete = jest.fn();
  const view = render(
    <SessionHistoryCard
      session={session(overrides)}
      onSeeDevice={onSeeDevice}
      onDelete={onDelete}
    />,
  );
  return { ...view, onSeeDevice, onDelete, user: userEvent.setup() };
};

describe("SessionHistoryCard", () => {
  it("tags itself with the session id for deep links", () => {
    const { container } = renderCard();

    expect(container.querySelector('[data-session-id="7"]')).not.toBeNull();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("2016")).toBeInTheDocument();
  });

  it.each([
    [{ endedAt: undefined }, "Active"],
    [{ terminated: true }, "Terminated"],
    [{}, "Ended"],
  ])("labels the status of %j", (overrides, label) => {
    renderCard(overrides);

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("hands the device and delete buttons back to the caller", async () => {
    const { user, onSeeDevice, onDelete } = renderCard();

    await user.click(screen.getByRole("button", { name: "See device" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onSeeDevice).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it("cannot delete a session that is still running", () => {
    renderCard({ endedAt: undefined });

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
