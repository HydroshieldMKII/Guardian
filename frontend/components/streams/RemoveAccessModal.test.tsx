import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlexSession } from "@/types";
import { RemoveAccessModal } from "@/components/streams/RemoveAccessModal";

const stream = (overrides: Record<string, unknown> = {}) =>
  ({
    type: "movie",
    title: "Arrival",
    year: 2016,
    User: { title: "testuser" },
    Player: { title: "Living Room TV", platform: "Roku" },
    ...overrides,
  }) as unknown as PlexSession;

describe("RemoveAccessModal", () => {
  it("stays closed without a stream", () => {
    render(
      <RemoveAccessModal
        stream={null}
        isRemoving={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText("Remove Device Access")).toBeNull();
  });

  it("summarises the content, user and device", () => {
    render(
      <RemoveAccessModal
        stream={stream()}
        isRemoving={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText("Remove Device Access")).toBeInTheDocument();
    expect(screen.getByText("Arrival (2016)")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
  });

  it("falls back when the user and device are unknown", () => {
    render(
      <RemoveAccessModal
        stream={stream({ User: undefined, Player: undefined })}
        isRemoving={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
    expect(screen.getByText("Unknown Device")).toBeInTheDocument();
  });

  it("confirms and cancels", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <RemoveAccessModal
        stream={stream()}
        isRemoving={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Remove Access/ }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("hands the callbacks no arguments, so a click event is never mistaken for one", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <RemoveAccessModal
        stream={stream()}
        isRemoving={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Remove Access/ }));
    expect(onConfirm).toHaveBeenCalledWith();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledWith();
  });

  it("locks both buttons and shows progress while removing", () => {
    render(
      <RemoveAccessModal
        stream={stream()}
        isRemoving
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText("Removing...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Removing/ })).toBeDisabled();
  });

  it("cancels when the dialog is dismissed", async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <RemoveAccessModal
        stream={stream()}
        isRemoving={false}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });
});
