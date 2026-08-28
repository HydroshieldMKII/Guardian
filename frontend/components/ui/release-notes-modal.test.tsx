import { render, screen } from "@testing-library/react";
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

    expect(screen.getByText("What's New in v2.1.0")).toBeInTheDocument();
  });

  it("renders the release notes as formatted markdown", () => {
    renderModal({
      releaseNotes: "## Added\n- A thing\n**bold** and [a link](https://x.dev)",
    });

    const notes = document.querySelector(".prose");

    expect(notes?.querySelector("h2")?.textContent).toBe("Added");
    expect(notes?.querySelector("li")?.textContent).toBe("A thing");
    expect(notes?.querySelector("strong")?.textContent).toBe("bold");
    expect(notes?.querySelector("a")?.getAttribute("href")).toBe(
      "https://x.dev",
    );
  });

  it("says so when a release ships without notes", () => {
    renderModal({ releaseNotes: "" });

    expect(screen.getByText("No release notes available.")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "How to Update" }));
    await user.click(screen.getByRole("button", { name: "View on Github" }));

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
