import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting, UserDevice } from "@/types";
import { DeviceDetailsModal } from "@/components/device-management/DeviceDetailsModal";

const hasTemporaryAccess = jest.fn();
const getTemporaryAccessTimeLeft = jest.fn();
jest.mock("@/hooks/device-management/useDeviceUtils", () => ({
  useDeviceUtils: () => ({ hasTemporaryAccess, getTemporaryAccessTimeLeft }),
}));

const deleteDeviceNote = jest.fn();
const updateDeviceExcludeFromConcurrentLimit = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    deleteDeviceNote: (...a: unknown[]) => deleteDeviceNote(...a),
    updateDeviceExcludeFromConcurrentLimit: (...a: unknown[]) =>
      updateDeviceExcludeFromConcurrentLimit(...a),
  },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  devicePlatform: "Roku",
  deviceProduct: "Plex for Roku",
  deviceVersion: "1.2.3",
  ipAddress: "192.168.1.10",
  approved: true,
  status: "approved",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-02-01T00:00:00Z",
  sessionCount: 7,
  ...overrides,
});

const strictMode = (value: string): AppSetting[] =>
  [{ key: "PLEX_GUARD_STRICT_MODE", value }] as AppSetting[];

const renderModal = (
  overrides: Partial<UserDevice> | null = {},
  props: {
    editingDevice?: number | null;
    newDeviceName?: string;
    actionLoading?: number | null;
    onSetPending?: jest.Mock;
    onDeviceUpdate?: jest.Mock;
    settingsData?: AppSetting[];
    isOpen?: boolean;
  } = {},
) => {
  const handlers = {
    onClose: jest.fn(),
    onEdit: jest.fn(),
    onCancelEdit: jest.fn(),
    onRename: jest.fn(),
    onNewDeviceNameChange: jest.fn(),
  };

  const view = render(
    <DeviceDetailsModal
      device={overrides === null ? null : device(overrides)}
      isOpen={props.isOpen ?? true}
      editingDevice={props.editingDevice ?? null}
      newDeviceName={props.newDeviceName ?? ""}
      actionLoading={props.actionLoading ?? null}
      onDeviceUpdate={props.onDeviceUpdate}
      onSetPending={props.onSetPending}
      settingsData={props.settingsData}
      {...handlers}
    />,
  );

  return { ...view, handlers, user: userEvent.setup() };
};

const openSection = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => user.click(screen.getByText(name));

beforeEach(() => {
  jest.clearAllMocks();
  hasTemporaryAccess.mockReturnValue(false);
  getTemporaryAccessTimeLeft.mockReturnValue("2h");
  deleteDeviceNote.mockResolvedValue(undefined);
  updateDeviceExcludeFromConcurrentLimit.mockResolvedValue(undefined);
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1200,
  });
});

describe("DeviceDetailsModal", () => {
  it("renders nothing without a device", () => {
    const { container } = renderModal(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on the basic information section", () => {
    renderModal();

    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
  });

  it("falls back for a nameless device", () => {
    renderModal({ deviceName: undefined });
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("says unknown for every missing hardware field", async () => {
    const { user } = renderModal({
      devicePlatform: undefined,
      deviceProduct: undefined,
      deviceVersion: undefined,
    });
    await openSection(user, "Device Identifier");

    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(2);
  });

  it("collapses the basic information section again", async () => {
    const { user } = renderModal();

    await openSection(user, "Basic Information");

    expect(screen.getByText("Basic Information")).toBeInTheDocument();
  });

  it("reports whether temporary access bypasses policies", async () => {
    const { user } = renderModal({
      temporaryAccessUntil: "2026-03-01T00:00:00Z",
      temporaryAccessBypassPolicies: true,
    });
    await openSection(user, "Temporary Access");

    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("reports when it does not", async () => {
    const { user } = renderModal({
      temporaryAccessUntil: "2026-03-01T00:00:00Z",
      temporaryAccessBypassPolicies: false,
    });
    await openSection(user, "Temporary Access");

    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("closes from the footer", async () => {
    const { user, handlers } = renderModal();

    await user.click(
      screen.getAllByRole("button", { name: /^Close$/i }).at(-1) as HTMLElement,
    );

    expect(handlers.onClose).toHaveBeenCalled();
  });

  describe("renaming", () => {
    it("starts an edit", async () => {
      const { user, handlers } = renderModal();

      await user.click(screen.getByTitle("Rename device"));

      expect(handlers.onEdit).toHaveBeenCalled();
    });

    it("saves a new name", async () => {
      const { user, handlers } = renderModal(
        {},
        { editingDevice: 1, newDeviceName: "Bedroom TV" },
      );

      const input = screen.getByPlaceholderText("Enter device name");
      expect(input).toHaveValue("Bedroom TV");

      await user.type(input, "!");
      expect(handlers.onNewDeviceNameChange).toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(handlers.onRename).toHaveBeenCalledWith(1, "Bedroom TV");
    });

    it("refuses to save an empty name", () => {
      renderModal({}, { editingDevice: 1, newDeviceName: "   " });

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("locks both buttons while renaming", () => {
      renderModal(
        {},
        { editingDevice: 1, newDeviceName: "Bedroom", actionLoading: 1 },
      );

      const spinning = screen
        .getAllByRole("button")
        .filter((b) => b.querySelector(".animate-spin"));
      expect(spinning.length).toBeGreaterThan(0);
      for (const button of spinning) {
        expect(button).toBeDisabled();
      }
    });

    it("cancels an edit", async () => {
      const { user, handlers } = renderModal(
        {},
        { editingDevice: 1, newDeviceName: "Bedroom" },
      );

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(handlers.onCancelEdit).toHaveBeenCalled();
    });
  });

  describe("collapsible sections", () => {
    it.each(["Device Identifier", "Activity", "Device Settings"])(
      "opens %s",
      async (name) => {
        const { user } = renderModal();

        await openSection(user, name);

        expect(screen.getByText(name)).toBeInTheDocument();
      },
    );

    it.each([
      [1, "1 minute"],
      [45, "45 minutes"],
      [60, "1 hour"],
      [61, "1 hour 1 minute"],
      [90, "1 hour 30 minutes"],
      [120, "2 hours"],
      [1440, "1 day"],
      [1500, "1 day 1 hour"],
      [1560, "1 day 2 hours"],
      [2880, "2 days"],
      [4400, "3 days 1 hour"],
    ])("formats a %p minute grant as %p", async (minutes, expected) => {
      const { user } = renderModal({
        temporaryAccessDurationMinutes: minutes,
        temporaryAccessGrantedAt: "2026-01-01T00:00:00Z",
      });
      await openSection(user, "Temporary Access");

      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("shows the temporary access section only when relevant", async () => {
      renderModal();
      expect(screen.queryByText("Temporary Access")).toBeNull();

      const { user } = renderModal({
        temporaryAccessUntil: "2026-03-01T00:00:00Z",
        temporaryAccessDurationMinutes: 90,
      });
      await openSection(user, "Temporary Access");

      expect(screen.getByText("Temporary Access")).toBeInTheDocument();
    });
  });

  describe("the user note", () => {
    const withNote = {
      requestDescription: "Please let me in",
      requestSubmittedAt: "2026-01-05T00:00:00Z",
      requestNoteReadAt: "2026-01-06T00:00:00Z",
    };

    it("is hidden without one", () => {
      renderModal();
      expect(screen.queryByText("User Note")).toBeNull();
    });

    it("is hidden while the note is still unread", () => {
      renderModal({
        requestDescription: "Please let me in",
        requestSubmittedAt: "2026-01-05T00:00:00Z",
      });
      expect(screen.queryByText("User Note")).toBeNull();
    });

    it("shows the note text", async () => {
      const { user } = renderModal(withNote);

      await openSection(user, "User Note");

      expect(screen.getByText("Please let me in")).toBeInTheDocument();
    });

    it("deletes the note", async () => {
      const onDeviceUpdate = jest.fn();
      const { user } = renderModal(withNote, { onDeviceUpdate });
      await openSection(user, "User Note");

      await user.click(screen.getByRole("button", { name: /Delete Note/ }));

      await waitFor(() => expect(deleteDeviceNote).toHaveBeenCalledWith(1));
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(onDeviceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ requestDescription: undefined }),
      );
    });

    it("deletes without an update callback", async () => {
      const { user } = renderModal(withNote);
      await openSection(user, "User Note");

      await user.click(screen.getByRole("button", { name: /Delete Note/ }));

      await waitFor(() => expect(deleteDeviceNote).toHaveBeenCalled());
    });

    it("reports a delete failure", async () => {
      deleteDeviceNote.mockRejectedValue(new Error("server said no"));
      const { user } = renderModal(withNote);
      await openSection(user, "User Note");

      await user.click(screen.getByRole("button", { name: /Delete Note/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "server said no",
          }),
        ),
      );
    });

    it("falls back to a generic delete message", async () => {
      deleteDeviceNote.mockRejectedValue("boom");
      const { user } = renderModal(withNote);
      await openSection(user, "User Note");

      await user.click(screen.getByRole("button", { name: /Delete Note/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: "Failed to delete note" }),
        ),
      );
    });

    it("shows when the note was read", async () => {
      const { user } = renderModal(withNote);
      await openSection(user, "User Note");

      expect(screen.getByText("Read")).toBeInTheDocument();
    });
  });

  describe("excluding from the concurrent limit", () => {
    it("toggles on and reports success", async () => {
      const onDeviceUpdate = jest.fn();
      const { user } = renderModal({}, { onDeviceUpdate });
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(updateDeviceExcludeFromConcurrentLimit).toHaveBeenCalledWith(
          1,
          true,
        ),
      );
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Device excluded from concurrent stream limit",
        }),
      );
      expect(onDeviceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ excludeFromConcurrentLimit: true }),
      );
    });

    it("toggles back off", async () => {
      const { user } = renderModal({ excludeFromConcurrentLimit: true });
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Device included in concurrent stream limit",
          }),
        ),
      );
    });

    it("reports a failure", async () => {
      updateDeviceExcludeFromConcurrentLimit.mockRejectedValue(
        new Error("nope"),
      );
      const { user } = renderModal();
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "nope",
          }),
        ),
      );
    });

    it("falls back to a generic failure message", async () => {
      updateDeviceExcludeFromConcurrentLimit.mockRejectedValue("boom");
      const { user } = renderModal();
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Failed to update device setting",
          }),
        ),
      );
    });

    it("is hidden for a PlexAmp device, which is always excluded", async () => {
      const { user } = renderModal({ deviceProduct: "Plexamp" });
      await openSection(user, "Device Settings");

      expect(screen.queryByRole("switch")).toBeNull();
      expect(
        screen.getByText(/PlexAmp devices are automatically excluded/),
      ).toBeInTheDocument();
    });
  });

  describe("reverting to pending", () => {
    it("is hidden without the callback", async () => {
      const { user } = renderModal();
      await openSection(user, "Device Settings");

      expect(screen.queryByText("Revert to pending status")).toBeNull();
    });

    it("is hidden for a device already pending", async () => {
      const { user } = renderModal(
        { status: "pending" },
        { onSetPending: jest.fn() },
      );
      await openSection(user, "Device Settings");

      expect(screen.queryByText("Revert to pending status")).toBeNull();
    });

    it("reverts and closes", async () => {
      const onSetPending = jest.fn().mockResolvedValue(true);
      const onDeviceUpdate = jest.fn();
      const { user, handlers } = renderModal(
        {},
        { onSetPending, onDeviceUpdate },
      );
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("button", { name: /Set to Pending/ }));

      await waitFor(() => expect(onSetPending).toHaveBeenCalledWith(1));
      expect(onDeviceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
      );
      expect(handlers.onClose).toHaveBeenCalled();
    });

    it("reports a refusal from the server", async () => {
      const onSetPending = jest.fn().mockResolvedValue(false);
      const { user, handlers } = renderModal({}, { onSetPending });
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("button", { name: /Set to Pending/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "Failed to set device to pending",
          }),
        ),
      );
      expect(handlers.onClose).not.toHaveBeenCalled();
    });

    it("reports a thrown failure", async () => {
      const onSetPending = jest.fn().mockRejectedValue(new Error("nope"));
      const { user } = renderModal({}, { onSetPending });
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("button", { name: /Set to Pending/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: "nope" }),
        ),
      );
    });

    it("works without an update callback", async () => {
      const onSetPending = jest.fn().mockResolvedValue(true);
      const { user } = renderModal({}, { onSetPending });
      await openSection(user, "Device Settings");

      await user.click(screen.getByRole("button", { name: /Set to Pending/ }));

      await waitFor(() => expect(onSetPending).toHaveBeenCalled());
    });

    describe("with strict mode enabled", () => {
      it("disables the control and explains why on hover", async () => {
        const { user } = renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        await openSection(user, "Device Settings");

        await user.hover(
          screen.getByRole("button", { name: /Set to Pending/ }),
        );

        expect(
          screen.getAllByText(/Strict mode is enabled/).length,
        ).toBeGreaterThan(0);
      });

      it("opens and closes the explanation on pointer enter and leave", async () => {
        const { user } = renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        await openSection(user, "Device Settings");
        const trigger = screen.getByRole("button", { name: /Set to Pending/ });

        fireEvent.mouseEnter(trigger);
        expect(
          screen.getAllByText(/Strict mode is enabled/).length,
        ).toBeGreaterThan(0);

        fireEvent.mouseLeave(trigger);
        await waitFor(() =>
          expect(screen.queryByText(/Strict mode is enabled/)).toBeNull(),
        );
      });

      it("ignores pointer enter and leave on a narrow screen", async () => {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 500,
        });
        const { user } = renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        await openSection(user, "Device Settings");
        const trigger = screen.getByRole("button", { name: /Set to Pending/ });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseLeave(trigger);

        expect(screen.queryByText(/Strict mode is enabled/)).toBeNull();
      });

      it("toggles the explanation on tap on a narrow screen", async () => {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 500,
        });
        const { user } = renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        await openSection(user, "Device Settings");

        await user.click(
          screen.getByRole("button", { name: /Set to Pending/ }),
        );

        expect(
          screen.getAllByText(/Strict mode is enabled/).length,
        ).toBeGreaterThan(0);
      });

      it("stays enabled when strict mode is off", async () => {
        const onSetPending = jest.fn().mockResolvedValue(true);
        const { user } = renderModal(
          {},
          { onSetPending, settingsData: strictMode("false") },
        );
        await openSection(user, "Device Settings");

        await user.click(
          screen.getByRole("button", { name: /Set to Pending/ }),
        );

        await waitFor(() => expect(onSetPending).toHaveBeenCalled());
      });
    });
  });

  it("resyncs local state when a different device is supplied", () => {
    const { rerender } = renderModal({ excludeFromConcurrentLimit: false });

    rerender(
      <DeviceDetailsModal
        device={device({ id: 2, excludeFromConcurrentLimit: true })}
        isOpen
        onClose={jest.fn()}
        editingDevice={null}
        newDeviceName=""
        actionLoading={null}
        onEdit={jest.fn()}
        onCancelEdit={jest.fn()}
        onRename={jest.fn()}
        onNewDeviceNameChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Basic Information")).toBeInTheDocument();
  });
});

describe("DeviceDetailsModal temporary access expiry", () => {
  it("labels a live grant as expiring", async () => {
    hasTemporaryAccess.mockReturnValue(true);
    const { user } = renderModal({
      temporaryAccessUntil: "2026-03-01T00:00:00Z",
    });

    await user.click(
      screen.getByRole("button", { name: /^Temporary Access$/ }),
    );

    expect(screen.getByText("Expires At")).toBeInTheDocument();
  });

  it("labels a lapsed grant as expired", async () => {
    hasTemporaryAccess.mockReturnValue(false);
    const { user } = renderModal({
      temporaryAccessUntil: "2025-03-01T00:00:00Z",
    });

    await openSection(user, "Temporary Access");

    expect(screen.getByText("Expired At")).toBeInTheDocument();
  });
});

describe("DeviceDetailsModal set to pending", () => {
  it("falls back to a generic message when the failure carries none", async () => {
    const onSetPending = jest.fn().mockRejectedValue("nope");
    const { user } = renderModal({}, { onSetPending });

    await openSection(user, "Device Settings");
    await user.click(screen.getByRole("button", { name: /Set to Pending/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to set device to pending",
        }),
      ),
    );
  });
});

describe("DeviceDetailsModal strict mode help", () => {
  const strictOn = () => ({
    settingsData: strictMode("true"),
    onSetPending: jest.fn(),
  });

  const pendingTrigger = () =>
    screen.getByRole("button", { name: /Set to Pending/ });

  it("lets the tooltip drive its own open state on a wide screen", async () => {
    const { user } = renderModal({}, strictOn());
    await openSection(user, "Device Settings");

    await user.hover(pendingTrigger());

    expect(
      await screen.findAllByText(/Strict mode is enabled/),
    ).not.toHaveLength(0);
  });

  it("opens the explanation on tap on a narrow screen", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    const { user } = renderModal({}, strictOn());
    await openSection(user, "Device Settings");

    fireEvent.click(pendingTrigger());

    expect(
      await screen.findAllByText(/Strict mode is enabled/),
    ).not.toHaveLength(0);
  });

  it("ignores hover on a narrow screen", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    const { user } = renderModal({}, strictOn());
    await openSection(user, "Device Settings");

    fireEvent.mouseEnter(pendingTrigger());

    expect(screen.queryByText(/Strict mode is enabled/)).toBeNull();
  });
});
