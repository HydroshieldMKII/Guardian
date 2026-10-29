import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { REFRESH_DONE_MS, RefreshButton } from "@/components/ui/refresh-button";

const renderButton = (
  overrides: Partial<React.ComponentProps<typeof RefreshButton>> = {},
) => {
  const props = {
    refreshing: false,
    onRefresh: jest.fn(),
    ...overrides,
  };
  const view = render(<RefreshButton {...props} />);
  return { ...view, props, user: userEvent.setup() };
};

describe("RefreshButton", () => {
  it("refreshes on demand", async () => {
    const { user, props, container } = renderButton({ className: "extra" });
    const button = screen.getByRole("button", { name: "Refresh" });

    await user.click(button);

    expect(props.onRefresh).toHaveBeenCalled();
    expect(button).toHaveClass("extra");
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("spins and disables while refreshing", () => {
    const { container } = renderButton({ refreshing: true });

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("confirms with a checkmark once a requested refresh finishes", async () => {
    const { user, props, rerender } = renderButton();
    const onRefresh = props.onRefresh;

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    rerender(<RefreshButton refreshing onRefresh={onRefresh} />);
    expect(screen.queryByTestId("refresh-done")).toBeNull();

    rerender(<RefreshButton refreshing={false} onRefresh={onRefresh} />);
    expect(screen.getByTestId("refresh-done")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshed");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("returns to the refresh icon after a moment", async () => {
    jest.useFakeTimers();
    try {
      const onRefresh = jest.fn();
      const { rerender } = render(
        <RefreshButton refreshing={false} onRefresh={onRefresh} />,
      );
      act(() => screen.getByRole("button", { name: "Refresh" }).click());
      rerender(<RefreshButton refreshing onRefresh={onRefresh} />);
      rerender(<RefreshButton refreshing={false} onRefresh={onRefresh} />);
      expect(screen.getByTestId("refresh-done")).toBeInTheDocument();

      act(() => jest.advanceTimersByTime(REFRESH_DONE_MS));

      expect(screen.queryByTestId("refresh-done")).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent("");
    } finally {
      jest.useRealTimers();
    }
  });

  it("stays quiet for refreshes it did not start", () => {
    const onRefresh = jest.fn();
    const { rerender } = render(
      <RefreshButton refreshing onRefresh={onRefresh} />,
    );

    rerender(<RefreshButton refreshing={false} onRefresh={onRefresh} />);

    expect(screen.queryByTestId("refresh-done")).toBeNull();
  });

  it("can be disabled independently and styled as ghost", () => {
    renderButton({ disabled: true, variant: "ghost" });

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });
});
