import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { PasswordConfirmationModal } from "@/components/ui/password-confirmation-modal";

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
      "border-blocked/35",
    );
  });

  it("leaves the confirm button in the default tone otherwise", () => {
    renderModal({ confirmText: "Delete" });

    expect(
      screen.getByRole("button", { name: "Delete" }).className,
    ).not.toContain("border-blocked/35");
  });

  it("confirms and cancels", async () => {
    const { user, onConfirm, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("hands the callbacks no arguments, so a click event is never mistaken for one", async () => {
    const { user, onConfirm, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledWith();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith();
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

    await user.type(screen.getByLabelText("Current password"), "hunter2");
    expect(confirm).not.toBeDisabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("hunter2");
  });

  it("ignores a whitespace-only password", async () => {
    const { user, onConfirm } = renderModal();

    await user.type(screen.getByLabelText("Current password"), "   ");

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms on Enter", async () => {
    const { user, onConfirm } = renderModal();

    await user.type(
      screen.getByLabelText("Current password"),
      "hunter2{Enter}",
    );

    expect(onConfirm).toHaveBeenCalledWith("hunter2");
  });

  it("does not confirm on Enter with an empty field", async () => {
    const { user, onConfirm } = renderModal();

    await user.click(screen.getByLabelText("Current password"));
    await user.keyboard("{Enter}");

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not confirm on Enter while loading", async () => {
    const { user, onConfirm, rerender } = renderModal();

    await user.type(screen.getByLabelText("Current password"), "hunter2");
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
    const field = screen.getByLabelText("Current password");

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

    await user.type(screen.getByLabelText("Current password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("clears the field when it reopens", async () => {
    const { user, rerender } = renderModal();
    await user.type(screen.getByLabelText("Current password"), "hunter2");

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

    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("locks everything while loading", () => {
    renderModal({ isLoading: true });

    expect(screen.getByLabelText("Current password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Confirming..." }),
    ).toBeDisabled();
  });
});
