import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteRequestDialogs } from "@/components/portal/NoteRequestDialogs";
import { portalDevice } from "@/test-utils/portal";
import type { PortalDevice } from "@/types";

const renderDialogs = ({
  device = portalDevice(),
  open = true,
  submitting = false,
}: { device?: PortalDevice; open?: boolean; submitting?: boolean } = {}) => {
  const onClose = jest.fn();
  const onSubmit = jest.fn<void, [string]>();
  render(
    <NoteRequestDialogs
      device={device}
      open={open}
      submitting={submitting}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onClose, onSubmit, user: userEvent.setup() };
};

describe("NoteRequestDialogs", () => {
  it("stays closed until opened", () => {
    renderDialogs({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks for a note about the device", () => {
    renderDialogs();

    expect(
      screen.getByRole("dialog", { name: "Send a note to the server owner" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("starts from a note already written for the device", () => {
    renderDialogs({ device: portalDevice({ requestDescription: "Hi" }) });
    expect(screen.getByLabelText(/^Note/)).toHaveValue("Hi");
  });

  it("confirms the note before sending it", async () => {
    const { onSubmit, user } = renderDialogs();

    await user.type(screen.getByLabelText(/^Note/), "Kitchen tablet");
    expect(screen.getByText("14/500")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("dialog", { name: "Confirm submission" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kitchen tablet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit note" }));
    expect(onSubmit).toHaveBeenCalledWith("Kitchen tablet");
  });

  it("says when no note was written", async () => {
    const { onSubmit, user } = renderDialogs();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByText("No note provided. You can go back to add one."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit note" }));
    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("goes back to the note with its text kept", async () => {
    const { user } = renderDialogs();

    await user.type(screen.getByLabelText(/^Note/), "Hello");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(screen.getByLabelText(/^Note/)).toHaveValue("Hello");
  });

  it("closes from the note step", async () => {
    const { onClose, user } = renderDialogs();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it.each(["note", "confirmation"])(
    "closes on escape from the %s step",
    async (step) => {
      const { onClose, user } = renderDialogs();
      if (step === "confirmation") {
        await user.click(screen.getByRole("button", { name: "Continue" }));
      }

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalled();
    },
  );

  it("locks the buttons while sending", async () => {
    const { user } = renderDialogs({ submitting: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: "Go back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Submitting/ })).toBeDisabled();
  });
});
