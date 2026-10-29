import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReleaseNotesModal } from "@/components/ui/release-notes-modal";

const renderModal = (
  props: Partial<React.ComponentProps<typeof ReleaseNotesModal>> = {},
) => {
  const onClose = jest.fn();
  const view = render(
    <ReleaseNotesModal
      isOpen
      onClose={onClose}
      latestVersion="2.1.0"
      releaseNotes={props.releaseNotes ?? "## Added\n- A thing"}
      updateUrl="https://example.com/releases/v2.1.0"
      {...props}
    />,
  );

  return { ...view, onClose, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

describe("ReleaseNotesModal", () => {
  it("names the version it is describing", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "What's New in v2.1.0" }),
    ).toBeInTheDocument();
  });

  it("renders the release notes as formatted markdown", () => {
    renderModal({
      releaseNotes: "## Added\n- A thing\n**bold** and [a link](https://x.dev)",
    });

    expect(
      screen.getByRole("heading", { level: 3, name: "Added" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("A thing");
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "a link" })).toHaveAttribute(
      "href",
      "https://x.dev",
    );
  });

  it("never turns the notes into raw HTML", () => {
    renderModal({ releaseNotes: "- <img src=x onerror=alert(1)>" });

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "<img src=x onerror=alert(1)>",
    );
  });

  it("names the installed version when it is known", () => {
    renderModal({ currentVersion: "2.0.0" });

    expect(screen.getByText("You're on v2.0.0")).toBeInTheDocument();
  });

  it("renders code spans", () => {
    renderModal({ releaseNotes: "Run `npm ci` first" });

    expect(screen.getByText("npm ci").tagName).toBe("CODE");
  });

  it("says so when a release ships without notes", () => {
    renderModal({ releaseNotes: "" });

    expect(screen.getByText("No release notes available.")).toBeInTheDocument();
  });

  it("closes on escape", async () => {
    const { onClose, user } = renderModal();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("closes from the footer", async () => {
    const { onClose, user } = renderModal();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("opens the update instructions and the release itself", async () => {
    const open = jest.fn();
    Object.defineProperty(window, "open", { value: open, writable: true });
    const { user } = renderModal();

    await user.click(screen.getByRole("button", { name: "How to update" }));
    await user.click(screen.getByRole("button", { name: "View on GitHub" }));

    expect(open).toHaveBeenNthCalledWith(
      1,
      "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
      "_blank",
    );
    expect(open).toHaveBeenNthCalledWith(
      2,
      "https://example.com/releases/v2.1.0",
      "_blank",
    );
  });
});
