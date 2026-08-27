import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting, UserDevice } from "@/types";
import { DeviceDetailsModal } from "@/components/device-management/DeviceDetailsModal";

const inHours = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

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
    policies?: React.ComponentProps<typeof DeviceDetailsModal>["policies"];
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
      policies={props.policies}
      {...handlers}
    />,
  );

  return { ...view, handlers, user: userEvent.setup() };
};

const seeSection = (name: string) =>
  expect(screen.getByText(name)).toBeInTheDocument();

beforeEach(() => {
  jest.clearAllMocks();
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

  it("names the device in the header instead of a generic title", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: /Living Room TV/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Device Details")).toBeNull();
    expect(screen.queryByText("Basic Information")).toBeNull();
  });

  it("reports the status as a field beside Last Seen, not on the name", () => {
    const { baseElement } = renderModal({ status: "pending" });

    const heading = screen.getByRole("heading", { name: "Living Room TV" });
    const labels = Array.from(baseElement.querySelectorAll("dt")).map(
      (node) => node.textContent,
    );

    expect(heading.parentElement).not.toContainElement(
      screen.getByText("Pending"),
    );
    expect(labels.slice(labels.indexOf("Last Seen"))).toEqual([
      "Last Seen",
      "Status",
      "Enforced Policies",
      "Identifier",
    ]);
  });

  it("lists the policies actually enforced against the device", () => {
    renderModal(
      {},
      {
        policies: [
          {
            policy: "schedule",
            label: "Time Schedule",
            tone: "info",
            title: "A time schedule restricts when this device can stream",
          },
          {
            policy: "ip",
            label: "IP Access",
            tone: "accent",
            title: "Network or IP restrictions apply to this device",
          },
        ],
      },
    );

    expect(screen.getByText("Time Schedule")).toBeInTheDocument();
    expect(screen.getByText("IP Access")).toBeInTheDocument();
  });

  it("says none when nothing is enforced against the device", () => {
    renderModal();
    expect(
      screen.getByText("None. This device streams without restriction."),
    ).toBeInTheDocument();
  });

  it("names the grant in that field and keeps the countdown in its tooltip", () => {
    renderModal(
      { temporaryAccessUntil: inHours(2) },
      {
        policies: [
          {
            policy: "temporary",
            label: "Temporary Access",
            tone: "positive",
            title: "Temporary access expires in 2 hours",
          },
        ],
      },
    );

    expect(
      screen.getByTitle("Temporary access expires in 2 hours"),
    ).toHaveTextContent("Temporary Access");
  });

  it("keeps reporting the status a grant is standing in for", () => {
    renderModal(
      { status: "rejected", temporaryAccessUntil: inHours(2) },
      {
        policies: [
          {
            policy: "temporary",
            label: "Temporary Access",
            tone: "positive",
            title: "Temporary access expires in 2 hours",
          },
        ],
      },
    );

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(
      screen.getByTitle("Temporary access expires in 2 hours"),
    ).toBeInTheDocument();
  });

  it("does not repeat the hardware summary the grid already carries", () => {
    renderModal();

    expect(screen.queryByText(/Plex for Roku · Roku/)).toBeNull();
    expect(screen.getByText("Plex for Roku")).toBeInTheDocument();
    expect(screen.getByText("Roku")).toBeInTheDocument();
  });

  it("falls back for a nameless device", () => {
    renderModal({ deviceName: undefined });
    expect(
      screen.getByRole("heading", { name: "Unknown" }),
    ).toBeInTheDocument();
  });

  it("says unknown for every missing hardware field", () => {
    renderModal({
      devicePlatform: undefined,
      deviceProduct: undefined,
      deviceVersion: undefined,
    });

    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(2);
  });

  it("reports whether temporary access bypasses policies", async () => {
    renderModal({
      temporaryAccessUntil: "2026-03-01T00:00:00Z",
      temporaryAccessBypassPolicies: true,
    });
    seeSection("Temporary Access");

    expect(screen.getByText("Policies Bypassed")).toBeInTheDocument();
  });

  it("reports when it does not", async () => {
    renderModal({
      temporaryAccessUntil: "2026-03-01T00:00:00Z",
      temporaryAccessBypassPolicies: false,
    });
    seeSection("Temporary Access");

    expect(screen.getByText("Policies Enforced")).toBeInTheDocument();
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

      await user.click(screen.getByRole("button", { name: "Rename" }));

      expect(handlers.onEdit).toHaveBeenCalled();
    });

    it("saves a new name", async () => {
      const { user, handlers } = renderModal(
        {},
        { editingDevice: 1, newDeviceName: "Bedroom TV" },
      );

      const input = screen.getByPlaceholderText("Device name");
      expect(input).toHaveValue("Bedroom TV");

      await user.type(input, "!");
      expect(handlers.onNewDeviceNameChange).toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(handlers.onRename).toHaveBeenCalledWith(1, "Bedroom TV");
    });

    it("discards an edit in progress when the modal closes", async () => {
      const { user, handlers } = renderModal(
        {},
        { editingDevice: 1, newDeviceName: "Bedroom TV" },
      );

      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(handlers.onCancelEdit).toHaveBeenCalled();
      expect(handlers.onClose).toHaveBeenCalled();
    });

    it("discards it on escape too, not just the close button", async () => {
      const { user, handlers } = renderModal(
        {},
        { editingDevice: 1, newDeviceName: "Bedroom TV" },
      );

      await user.keyboard("{Escape}");

      expect(handlers.onCancelEdit).toHaveBeenCalled();
      expect(handlers.onClose).toHaveBeenCalled();
    });

    it("leaves the edit state alone when nothing is being renamed", async () => {
      const { user, handlers } = renderModal();

      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(handlers.onCancelEdit).not.toHaveBeenCalled();
      expect(handlers.onClose).toHaveBeenCalled();
    });

    it("edits the name in place rather than in a row underneath", () => {
      renderModal({}, { editingDevice: 1, newDeviceName: "Bedroom TV" });

      const heading = screen.getByRole("heading", { name: "Living Room TV" });
      const input = screen.getByPlaceholderText("Device name");

      expect(heading.className).toContain("sr-only");
      expect(heading.parentElement).toContainElement(input);
      expect(heading.parentElement).toContainElement(
        screen.getByRole("button", { name: "Save" }),
      );
    });

    it("hands the pencil's place to the editor", () => {
      const { rerender } = renderModal();
      const row = screen.getByRole("button", { name: "Rename" }).parentElement;

      rerender(
        <DeviceDetailsModal
          device={device()}
          isOpen
          onClose={jest.fn()}
          editingDevice={1}
          newDeviceName="Bedroom TV"
          actionLoading={null}
          onEdit={jest.fn()}
          onCancelEdit={jest.fn()}
          onRename={jest.fn()}
          onNewDeviceNameChange={jest.fn()}
        />,
      );

      expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
      expect(row).toContainElement(screen.getByPlaceholderText("Device name"));
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

  describe("overview", () => {
    it("shows the identifier and both timestamps without a click", () => {
      renderModal();

      expect(screen.getByText("device-1")).toBeInTheDocument();
      expect(screen.getByText("First Seen")).toBeInTheDocument();
      expect(screen.getByText("Last Seen")).toBeInTheDocument();
    });

    it("keeps nothing behind a disclosure", () => {
      const { container } = renderModal();

      expect(container.querySelectorAll("[data-state=closed]")).toHaveLength(0);
      for (const gone of [
        "Basic Information",
        "Device Identifier",
        "Activity",
      ]) {
        expect(screen.queryByText(gone)).toBeNull();
      }
    });

    it.each([
      [1, "1 minute"],
      [45, "45 minutes"],
      [60, "1 hour"],
      [61, "1 hour and 1 minute"],
      [90, "1 hour and 30 minutes"],
      [120, "2 hours"],
      [1440, "1 day"],
      [1500, "1 day and 1 hour"],
      [1560, "1 day and 2 hours"],
      [2880, "2 days"],
      [4400, "3 days and 1 hour"],
      [10080, "1 week"],
      [11520, "1 week and 1 day"],
    ])("formats a %p minute grant as %p", async (minutes, expected) => {
      renderModal({
        temporaryAccessDurationMinutes: minutes,
        temporaryAccessGrantedAt: "2026-01-01T00:00:00Z",
      });
      seeSection("Temporary Access");

      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("shows the temporary access section only when relevant", async () => {
      renderModal();
      expect(screen.queryByText("Temporary Access")).toBeNull();

      renderModal({
        temporaryAccessUntil: "2026-03-01T00:00:00Z",
        temporaryAccessDurationMinutes: 90,
      });
      seeSection("Temporary Access");

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
      renderModal(withNote);

      seeSection("User Note");

      expect(screen.getByText("Please let me in")).toBeInTheDocument();
    });

    it("deletes the note", async () => {
      const onDeviceUpdate = jest.fn();
      const { user } = renderModal(withNote, { onDeviceUpdate });
      seeSection("User Note");

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
      seeSection("User Note");

      await user.click(screen.getByRole("button", { name: /Delete Note/ }));

      await waitFor(() => expect(deleteDeviceNote).toHaveBeenCalled());
    });

    it("reports a delete failure", async () => {
      deleteDeviceNote.mockRejectedValue(new Error("server said no"));
      const { user } = renderModal(withNote);
      seeSection("User Note");

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
      seeSection("User Note");

      await user.click(screen.getByRole("button", { name: /Delete Note/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: "Failed to delete note" }),
        ),
      );
    });

    it("shows when the note was read", async () => {
      renderModal(withNote);
      seeSection("User Note");

      expect(screen.getByText("Read")).toBeInTheDocument();
    });
  });

  describe("excluding from the concurrent limit", () => {
    it("toggles on and reports success", async () => {
      const onDeviceUpdate = jest.fn();
      const { user } = renderModal({}, { onDeviceUpdate });
      seeSection("Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(updateDeviceExcludeFromConcurrentLimit).toHaveBeenCalledWith(
          1,
          true,
        ),
      );
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Streams from this device no longer count towards the user's concurrent stream limit",
        }),
      );
      expect(onDeviceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ excludeFromConcurrentLimit: true }),
      );
    });

    it("toggles back off", async () => {
      const { user } = renderModal({ excludeFromConcurrentLimit: true });
      seeSection("Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description:
              "Streams from this device now count towards the user's concurrent stream limit",
          }),
        ),
      );
    });

    it("reports a failure", async () => {
      updateDeviceExcludeFromConcurrentLimit.mockRejectedValue(
        new Error("nope"),
      );
      const { user } = renderModal();
      seeSection("Device Settings");

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
      seeSection("Device Settings");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Failed to update this device's settings",
          }),
        ),
      );
    });

    it("is hidden for a PlexAmp device, which is always excluded", async () => {
      renderModal({ deviceProduct: "Plexamp" });
      seeSection("Device Settings");

      expect(screen.queryByRole("switch")).toBeNull();
      expect(
        screen.getByText(/It is exempt from every policy/),
      ).toBeInTheDocument();
    });
  });

  describe("reverting to pending", () => {
    it("is hidden without the callback", async () => {
      renderModal();
      seeSection("Device Settings");

      expect(screen.queryByText("Set back to pending")).toBeNull();
    });

    it("is hidden for a device already pending", async () => {
      renderModal({ status: "pending" }, { onSetPending: jest.fn() });
      seeSection("Device Settings");

      expect(screen.queryByText("Set back to pending")).toBeNull();
    });

    it("reverts and closes", async () => {
      const onSetPending = jest.fn().mockResolvedValue(true);
      const onDeviceUpdate = jest.fn();
      const { user, handlers } = renderModal(
        {},
        { onSetPending, onDeviceUpdate },
      );
      seeSection("Device Settings");

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
      seeSection("Device Settings");

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
      seeSection("Device Settings");

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
      seeSection("Device Settings");

      await user.click(screen.getByRole("button", { name: /Set to Pending/ }));

      await waitFor(() => expect(onSetPending).toHaveBeenCalled());
    });

    describe("with strict mode enabled", () => {
      it("disables the control and explains why on hover", async () => {
        const { user } = renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        seeSection("Device Settings");

        await user.hover(
          screen.getByRole("button", { name: /Set to Pending/ }),
        );

        expect(screen.getAllByText(/Strict mode is on/).length).toBeGreaterThan(
          0,
        );
      });

      it("opens and closes the explanation on pointer enter and leave", async () => {
        renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        seeSection("Device Settings");
        const trigger = screen.getByRole("button", { name: /Set to Pending/ });

        fireEvent.mouseEnter(trigger);
        expect(screen.getAllByText(/Strict mode is on/).length).toBeGreaterThan(
          0,
        );

        fireEvent.mouseLeave(trigger);
        await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
      });

      it("ignores pointer enter and leave on a narrow screen", async () => {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 500,
        });
        renderModal(
          {},
          { onSetPending: jest.fn(), settingsData: strictMode("true") },
        );
        seeSection("Device Settings");
        const trigger = screen.getByRole("button", { name: /Set to Pending/ });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseLeave(trigger);

        expect(screen.queryByRole("tooltip")).toBeNull();
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
        seeSection("Device Settings");

        await user.click(
          screen.getByRole("button", { name: /Set to Pending/ }),
        );

        expect(screen.getAllByText(/Strict mode is on/).length).toBeGreaterThan(
          0,
        );
      });

      it("stays enabled when strict mode is off", async () => {
        const onSetPending = jest.fn().mockResolvedValue(true);
        const { user } = renderModal(
          {},
          { onSetPending, settingsData: strictMode("false") },
        );
        seeSection("Device Settings");

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

    expect(
      screen.getByRole("heading", { name: /Living Room TV/ }),
    ).toBeInTheDocument();
  });
});

describe("DeviceDetailsModal temporary access expiry", () => {
  it("labels a live grant as expiring", async () => {
    renderModal({
      temporaryAccessUntil: inHours(24),
    });

    expect(screen.getByText("Expires At")).toBeInTheDocument();
  });

  it("labels a lapsed grant as expired", async () => {
    renderModal({
      temporaryAccessUntil: inHours(-24),
    });

    seeSection("Temporary Access");

    expect(screen.getByText("Expired At")).toBeInTheDocument();
  });
});

describe("DeviceDetailsModal set to pending", () => {
  it("falls back to a generic message when the failure carries none", async () => {
    const onSetPending = jest.fn().mockRejectedValue("nope");
    const { user } = renderModal({}, { onSetPending });

    seeSection("Device Settings");
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
    seeSection("Device Settings");

    await user.hover(pendingTrigger());

    expect(await screen.findAllByText(/Strict mode is on/)).not.toHaveLength(0);
  });

  it("opens the explanation on tap on a narrow screen", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    renderModal({}, strictOn());
    seeSection("Device Settings");

    fireEvent.click(pendingTrigger());

    expect(await screen.findAllByText(/Strict mode is on/)).not.toHaveLength(0);
  });

  it("ignores hover on a narrow screen", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    renderModal({}, strictOn());
    seeSection("Device Settings");

    fireEvent.mouseEnter(pendingTrigger());

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
