import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import { ConfirmationModal } from "@/components/device-management/ConfirmationModal";

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  username: "testuser",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  devicePlatform: "Roku",
  deviceProduct: "Plex for Roku",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 1,
  ...overrides,
});

const action = (
  act: "approve" | "reject" | "delete" | "toggle",
  overrides: Partial<UserDevice> = {},
) => ({
  device: device(overrides),
  action: act,
  title: `${act} title`,
  description: `${act} description`,
});

const renderModal = (
  confirmAction: ReturnType<typeof action> | null,
  actionLoading: number | null = null,
) => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const view = render(
    <ConfirmationModal
      confirmAction={confirmAction}
      actionLoading={actionLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { ...view, onConfirm, onCancel, user: userEvent.setup() };
};

describe("ConfirmationModal", () => {
  it("renders nothing without an action", () => {
    const { container } = renderModal(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the device it is about to act on", () => {
    renderModal(action("approve"));

    expect(screen.getByText("approve title")).toBeInTheDocument();
    expect(screen.getByText("approve description")).toBeInTheDocument();
    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(
      screen.getByText(/Platform: Roku.*Product: Plex for Roku/),
    ).toBeInTheDocument();
  });

  it("falls back to identifiers when name and username are missing", () => {
    renderModal(
      action("approve", {
        deviceName: undefined,
        username: undefined,
        devicePlatform: undefined,
        deviceProduct: undefined,
      }),
    );

    expect(screen.getByText("device-1")).toBeInTheDocument();
    expect(screen.getByText("u-1")).toBeInTheDocument();
    expect(
      screen.getByText(/Platform: Unknown.*Product: Unknown/),
    ).toBeInTheDocument();
  });

  describe("wording per action", () => {
    it("renders the description the caller supplied, not a generic one", () => {
      renderModal({
        ...action("approve"),
        description:
          'Are you sure you want to approve this device? "Living Room TV" will be able to access your Plex server.',
      });

      expect(
        screen.getByText(
          'Are you sure you want to approve this device? "Living Room TV" will be able to access your Plex server.',
        ),
      ).toBeInTheDocument();
    });

    it.each([
      ["approve", "Approve Device"],
      ["reject", "Reject Device"],
      ["delete", "Delete Device"],
    ] as const)("labels the %s button", (act, button) => {
      renderModal(action(act));
      expect(screen.getByRole("button", { name: button })).toBeInTheDocument();
    });

    it("reads a toggle on an approved device as a rejection", () => {
      renderModal(action("toggle", { status: "approved" }));

      expect(
        screen.getByRole("button", { name: "Reject Device" }),
      ).toBeInTheDocument();
    });

    it("reads a toggle on a pending device as an approval", () => {
      renderModal(action("toggle", { status: "pending" }));

      expect(
        screen.getByRole("button", { name: "Approve Device" }),
      ).toBeInTheDocument();
    });
  });

  describe("button styling", () => {
    it("uses solid green to approve", () => {
      renderModal(action("approve"));
      expect(
        screen.getByRole("button", { name: "Approve Device" }).className,
      ).toContain("bg-green-500");
    });

    it("uses solid red to reject", () => {
      renderModal(action("reject"));
      expect(
        screen.getByRole("button", { name: "Reject Device" }).className,
      ).toContain("bg-red-600");
    });

    it("uses an outline for the irreversible delete", () => {
      renderModal(action("delete"));
      expect(
        screen.getByRole("button", { name: "Delete Device" }).className,
      ).toContain("border-red-600");
    });

    it("uses an outline when a toggle turns into a rejection", () => {
      renderModal(action("toggle", { status: "approved" }));
      expect(
        screen.getByRole("button", { name: "Reject Device" }).className,
      ).toContain("border-red-600");
    });

    it("uses solid green when a toggle turns into an approval", () => {
      renderModal(action("toggle", { status: "rejected" }));
      expect(
        screen.getByRole("button", { name: "Approve Device" }).className,
      ).toContain("bg-green-500");
    });
  });

  it("confirms and cancels", async () => {
    const { user, onConfirm, onCancel } = renderModal(action("approve"));

    await user.click(screen.getByRole("button", { name: "Approve Device" }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("cancels when the dialog is dismissed", async () => {
    const { user, onCancel } = renderModal(action("approve"));

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("locks both buttons and shows progress while an action runs", () => {
    renderModal(action("delete"), 1);

    expect(screen.getByText("Processing...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Processing/ })).toBeDisabled();
  });

  it("treats a zero action id as still running", () => {
    renderModal(action("delete"), 0);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
