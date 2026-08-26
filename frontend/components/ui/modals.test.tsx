import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { PasswordConfirmationModal } from "@/components/ui/password-confirmation-modal";
import { ReleaseNotesModal } from "@/components/ui/release-notes-modal";

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

describe("ConfirmationModal", () => {
  const renderModal = (props: Record<string, unknown> = {}) => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const view = render(
      <ConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete everything?"
        description="This cannot be undone."
        {...props}
      />,
    );
    return { ...view, onClose, onConfirm, user: setup() };
  };

  it("stays closed", () => {
    render(
      <ConfirmationModal
        isOpen={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Hidden"
        description="Nope"
      />,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("shows the title and description", () => {
    renderModal();

    expect(screen.getByText("Delete everything?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("uses default button labels", () => {
    renderModal();

    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("accepts custom labels", () => {
    renderModal({ confirmText: "Wipe it", cancelText: "Back out" });

    expect(screen.getByRole("button", { name: "Wipe it" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back out" }),
    ).toBeInTheDocument();
  });

  it("tones the confirm button as dangerous for the destructive variant", () => {
    renderModal({ variant: "destructive", confirmText: "Delete" });

    expect(screen.getByRole("button", { name: "Delete" }).className).toContain(
      "border-rose-500/40",
    );
  });

  it("leaves the confirm button in the default tone otherwise", () => {
    renderModal({ confirmText: "Delete" });

    expect(
      screen.getByRole("button", { name: "Delete" }).className,
    ).not.toContain("border-rose-500/40");
  });

  it("confirms and cancels", async () => {
    const { user, onConfirm, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on escape", async () => {
    const { user, onClose } = renderModal();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("renders extra children", () => {
    renderModal({ children: <p>Extra detail</p> });
    expect(screen.getByText("Extra detail")).toBeInTheDocument();
  });

  it("locks both buttons and spins while loading", () => {
    renderModal({ loading: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });
});

describe("PasswordConfirmationModal", () => {
  const renderModal = (props: Record<string, unknown> = {}) => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const view = render(
      <PasswordConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm action"
        description="Enter your password"
        {...props}
      />,
    );
    return { ...view, onClose, onConfirm, user: setup() };
  };

  it("stays closed", () => {
    render(
      <PasswordConfirmationModal
        isOpen={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Hidden"
        description="Nope"
      />,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("blocks confirmation until a password is typed", async () => {
    const { user, onConfirm } = renderModal();
    const confirm = screen.getByRole("button", { name: "Confirm" });

    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Current Password"), "hunter2");
    expect(confirm).not.toBeDisabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("hunter2");
  });

  it("ignores a whitespace-only password", async () => {
    const { user, onConfirm } = renderModal();

    await user.type(screen.getByLabelText("Current Password"), "   ");

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms on Enter", async () => {
    const { user, onConfirm } = renderModal();

    await user.type(
      screen.getByLabelText("Current Password"),
      "hunter2{Enter}",
    );

    expect(onConfirm).toHaveBeenCalledWith("hunter2");
  });

  it("does not confirm on Enter with an empty field", async () => {
    const { user, onConfirm } = renderModal();

    await user.click(screen.getByLabelText("Current Password"));
    await user.keyboard("{Enter}");

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not confirm on Enter while loading", async () => {
    const { user, onConfirm, rerender } = renderModal();

    await user.type(screen.getByLabelText("Current Password"), "hunter2");
    rerender(
      <PasswordConfirmationModal
        isOpen
        onClose={jest.fn()}
        onConfirm={onConfirm}
        title="Confirm action"
        description="Enter your password"
        isLoading
      />,
    );

    await user.keyboard("{Enter}");

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const { user } = renderModal();
    const field = screen.getByLabelText("Current Password");

    expect(field).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: /password/i });
    await user.click(toggle);
    expect(field).toHaveAttribute("type", "text");

    await user.click(toggle);
    expect(field).toHaveAttribute("type", "password");
  });

  it("warns for a dangerous action", () => {
    renderModal({ isDangerous: true });

    expect(
      screen.getByText(/This action cannot be undone/),
    ).toBeInTheDocument();
  });

  it("shows no warning for an ordinary action", () => {
    renderModal();

    expect(screen.queryByText(/This action cannot be undone/)).toBeNull();
  });

  it("cancels and clears the field", async () => {
    const { user, onClose } = renderModal();

    await user.type(screen.getByLabelText("Current Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("clears the field when it reopens", async () => {
    const { user, rerender } = renderModal();
    await user.type(screen.getByLabelText("Current Password"), "hunter2");

    const props = (isOpen: boolean) => (
      <PasswordConfirmationModal
        isOpen={isOpen}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Confirm action"
        description="Enter your password"
      />
    );
    rerender(props(false));
    rerender(props(true));

    expect(screen.getByLabelText("Current Password")).toHaveValue("");
  });

  it("locks everything while loading", () => {
    renderModal({ isLoading: true });

    expect(screen.getByLabelText("Current Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Confirming..." }),
    ).toBeDisabled();
  });
});

describe("ReleaseNotesModal", () => {
  const renderModal = (props: Record<string, unknown> = {}) => {
    const onClose = jest.fn();
    const view = render(
      <ReleaseNotesModal
        isOpen
        onClose={onClose}
        latestVersion="2.0.0"
        releaseNotes="## Highlights\n* One\n* Two"
        updateUrl="https://example.test/release"
        {...props}
      />,
    );
    return { ...view, onClose, user: setup() };
  };

  it("stays closed", () => {
    render(
      <ReleaseNotesModal
        isOpen={false}
        onClose={jest.fn()}
        latestVersion="2.0.0"
        releaseNotes=""
        updateUrl="https://example.test"
      />,
    );
    expect(screen.queryByText(/What's New/)).toBeNull();
  });

  it("names the version", () => {
    renderModal();
    expect(
      screen.getByText("What's New in Guardian v2.0.0"),
    ).toBeInTheDocument();
  });

  it("says when there are no notes", () => {
    renderModal({ releaseNotes: "" });
    expect(screen.getByText("No release notes available.")).toBeInTheDocument();
  });

  it.each([
    ["# Title", "h1"],
    ["## Title", "h2"],
    ["### Title", "h3"],
  ])("renders %p as %s", (notes, tag) => {
    renderModal({ releaseNotes: notes });
    expect(document.querySelector(tag)).not.toBeNull();
  });

  it.each(["* Item one\n* Item two", "- Item one\n- Item two"])(
    "renders a list from %p",
    (notes) => {
      renderModal({ releaseNotes: notes });
      expect(document.querySelectorAll("li").length).toBe(2);
      expect(document.querySelector("ul")).not.toBeNull();
    },
  );

  it("renders bold text", () => {
    renderModal({ releaseNotes: "Some **bold** text" });
    expect(document.querySelector("strong")).toHaveTextContent("bold");
  });

  it("renders links", () => {
    renderModal({
      releaseNotes: "See [the docs](https://example.test/docs)",
    });
    const link = document.querySelector("a");

    expect(link).toHaveAttribute("href", "https://example.test/docs");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("turns newlines into breaks", () => {
    renderModal({ releaseNotes: "one\ntwo" });
    expect(document.querySelectorAll("br").length).toBeGreaterThan(0);
  });

  it("opens the release on GitHub", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const { user } = renderModal();

    await user.click(screen.getByRole("button", { name: /View on Github/ }));

    expect(open).toHaveBeenCalledWith("https://example.test/release", "_blank");
    open.mockRestore();
  });

  it("opens the updating instructions", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const { user } = renderModal();

    await user.click(screen.getByRole("button", { name: /How to Update/ }));

    expect(open).toHaveBeenCalledWith(
      "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
      "_blank",
    );
    open.mockRestore();
  });

  it("closes on escape", async () => {
    const { user, onClose } = renderModal();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
