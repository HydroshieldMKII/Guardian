import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import { DeviceRow } from "@/components/device-management/DeviceRow";

const markDeviceNoteAsRead = jest.fn<Promise<unknown>, unknown[]>();
jest.mock("@/lib/api", () => ({
  apiClient: {
    markDeviceNoteAsRead: (...a: unknown[]) => markDeviceNoteAsRead(...a),
  },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const FUTURE = "2099-01-01T00:00:00Z";

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  devicePlatform: "Roku",
  deviceProduct: "Plex for Roku",
  ipAddress: "192.168.1.10",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-02-01T00:00:00Z",
  sessionCount: 7,
  ...overrides,
});

const handlers = () => ({
  onApprove: jest.fn(),
  onReject: jest.fn(),
  onDelete: jest.fn(),
  onToggleApproval: jest.fn(),
  onRemoveTemporaryAccess: jest.fn(),
  onShowDetails: jest.fn(),
  onDeviceUpdate: jest.fn<void, [UserDevice]>(),
});

const renderRow = (
  overrides: Partial<UserDevice> = {},
  props: {
    actionLoading?: number | null;
    policies?: React.ComponentProps<typeof DeviceRow>["policies"];
  } = {},
) => {
  const callbacks = handlers();
  const view = render(
    <DeviceRow
      device={device(overrides)}
      actionLoading={props.actionLoading ?? null}
      policies={props.policies}
      {...callbacks}
    />,
  );
  return {
    ...view,
    handlers: callbacks,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

type User = ReturnType<typeof userEvent.setup>;

const openMenu = async (user: User) => {
  await user.click(screen.getByRole("button", { name: /Actions/ }));
  return screen.findAllByRole("menuitem");
};

const menuLabels = async (user: User) =>
  (await openMenu(user)).map((item) => item.textContent?.trim());

const choose = async (user: User, name: string) => {
  await openMenu(user);
  await user.click(await screen.findByRole("menuitem", { name }));
};

beforeEach(() => {
  jest.clearAllMocks();
  markDeviceNoteAsRead.mockResolvedValue(undefined);
});

describe("DeviceRow identity", () => {
  it("anchors itself for scroll targeting", () => {
    const { container } = renderRow();

    expect(container.querySelector("#device-1")).not.toBeNull();
    expect(
      container.querySelector('[data-device-identifier="device-1"]'),
    ).not.toBeNull();
  });

  it("lists the product, platform, IP, streams and last seen", () => {
    renderRow();

    expect(screen.getByText("Plex for Roku")).toBeInTheDocument();
    expect(screen.getByText("Roku")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
    expect(screen.getByText("7 streams")).toBeInTheDocument();
    expect(
      screen.getByText(/^Seen Feb 1, 2026$|^Seen Jan 31, 2026$/),
    ).toBeInTheDocument();
  });

  it("keeps the field names for screen readers", () => {
    renderRow();

    for (const label of [
      "Product",
      "Platform",
      "IP address",
      "Streams",
      "Last seen",
    ]) {
      expect(screen.getByText(label)).toHaveClass("sr-only");
    }
  });

  it("uses the singular for one stream", () => {
    renderRow({ sessionCount: 1 });
    expect(screen.getByText("1 stream")).toBeInTheDocument();
  });

  it("counts no streams when the server omits the field", () => {
    renderRow({ sessionCount: undefined });
    expect(screen.getByText("0 streams")).toBeInTheDocument();
  });

  it("falls back for a nameless device with no product or platform", () => {
    renderRow({
      deviceName: undefined,
      deviceProduct: undefined,
      devicePlatform: undefined,
    });

    expect(screen.getAllByText("Unknown")).toHaveLength(3);
  });

  it("opens the details from the device name", async () => {
    const { user, handlers } = renderRow();

    await user.click(screen.getByRole("button", { name: "Living Room TV" }));

    expect(handlers.onShowDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });
});

describe("DeviceRow status", () => {
  it.each(["approved", "rejected", "pending"] as const)(
    "draws no status mark for a %s device",
    (status) => {
      renderRow({ status });
      expect(screen.queryByRole("img")).toBeNull();
    },
  );

  it("pills a Plexamp device by its product", () => {
    renderRow({ deviceProduct: "Plexamp" });
    expect(
      screen.getByRole("button", { name: /always allowed to stream/ }),
    ).toHaveTextContent("Plexamp");
  });

  it("does not treat a device named like Plexamp as Plexamp", () => {
    renderRow({ deviceProduct: "Plex", deviceName: "Office Plexamp" });
    expect(
      screen.queryByRole("button", { name: /always allowed to stream/ }),
    ).not.toBeInTheDocument();
  });

  it("treats an unknown status as pending", () => {
    renderRow({ status: "mystery" as UserDevice["status"] });
    expect(
      screen.getByRole("button", { name: /waiting for your decision/i }),
    ).toHaveTextContent("Pending");
  });

  it("pills a pending device", () => {
    renderRow({ status: "pending" });
    expect(
      screen.getByRole("button", {
        name: /waiting for your decision/i,
      }),
    ).toHaveTextContent("Pending");
  });

  it("explains which rule a pending device follows meanwhile", () => {
    renderRow({ status: "pending" });
    expect(
      screen.getByRole("button", {
        name: /Until then, this user's New devices rule applies/,
      }),
    ).toBeInTheDocument();
  });

  it("pills a rejected device", () => {
    renderRow({ status: "rejected" });
    expect(
      screen.getByRole("button", { name: /not allowed to stream/ }),
    ).toHaveTextContent("Rejected");
  });

  it("leaves an approved device unpilled", () => {
    renderRow({ status: "approved" });
    expect(screen.queryByText("Approved")).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
  });

  it("pills a Plexamp device as Plexamp instead of its status", () => {
    renderRow({ status: "rejected", deviceProduct: "Plexamp" });

    expect(
      screen.getByRole("button", { name: /always allowed to stream/ }),
    ).toHaveTextContent("Plexamp");
    expect(screen.queryByText("Rejected")).toBeNull();
  });

  it("renders the policy pills it is handed", () => {
    renderRow(
      { status: "approved" },
      {
        policies: [
          {
            policy: "schedule",
            label: "Time schedule",
            tone: "info",
            hint: "A time schedule blocks streaming during set hours",
          },
          {
            policy: "ip",
            label: "Network access",
            tone: "accent",
            hint: "Network and IP access rules apply to this device",
          },
        ],
      },
    );

    expect(screen.getByText("Time schedule")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Network and IP access rules apply to this device/,
      }),
    ).toHaveTextContent("Network access");
  });
});

describe("DeviceRow decision buttons", () => {
  it("offers approve and reject on a pending device", async () => {
    const { user, handlers } = renderRow();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(handlers.onApprove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    expect(handlers.onReject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it.each(["approved", "rejected"] as const)(
    "leaves them off a %s device",
    (status) => {
      renderRow({ status });
      expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    },
  );

  it("leaves them off a pending Plexamp device", () => {
    renderRow({ deviceProduct: "Plexamp" });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("disables them while this device is busy", () => {
    renderRow({}, { actionLoading: 1 });

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Actions/ })).toBeDisabled();
  });

  it("leaves them enabled while another device is busy", () => {
    renderRow({}, { actionLoading: 2 });

    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Actions/ })).toBeEnabled();
  });
});

describe("DeviceRow menu", () => {
  it.each([
    ["pending", ["View details", "Delete"]],
    ["rejected", ["View details", "Approve", "Delete"]],
    ["approved", ["View details", "Reject", "Delete"]],
  ] as const)("lists the actions for a %s device", async (status, labels) => {
    const { user } = renderRow({ status });

    expect(await menuLabels(user)).toEqual(labels);
  });

  it("offers only details and delete for a Plexamp device", async () => {
    const { user } = renderRow({
      status: "rejected",
      deviceProduct: "Plexamp",
      temporaryAccessUntil: FUTURE,
    });

    expect(await menuLabels(user)).toEqual(["View details", "Delete"]);
  });

  it.each(["pending", "rejected"] as const)(
    "offers to remove temporary access from a %s device",
    async (status) => {
      const { user, handlers } = renderRow({
        status,
        temporaryAccessUntil: FUTURE,
      });

      await choose(user, "Remove temporary access");

      expect(handlers.onRemoveTemporaryAccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      );
    },
  );

  it("leaves temporary access removal off an approved device", async () => {
    const { user } = renderRow({
      status: "approved",
      temporaryAccessUntil: FUTURE,
    });

    expect(await menuLabels(user)).not.toContain("Remove temporary access");
  });

  it("leaves temporary access removal off once the grant expired", async () => {
    const { user } = renderRow({
      temporaryAccessUntil: "2000-01-01T00:00:00Z",
    });

    expect(await menuLabels(user)).not.toContain("Remove temporary access");
  });

  it.each([
    ["rejected", "Approve", "onToggleApproval"],
    ["approved", "Reject", "onToggleApproval"],
    ["pending", "View details", "onShowDetails"],
    ["pending", "Delete", "onDelete"],
  ] as const)("routes %s %s to its handler", async (status, label, handler) => {
    const { user, handlers } = renderRow({ status });

    await choose(user, label);

    expect(handlers[handler]).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });
});

describe("DeviceRow user note", () => {
  const withNote = {
    requestDescription: "Please let me in",
    requestSubmittedAt: "2026-01-05T00:00:00Z",
  };

  it("shows an unread note", () => {
    renderRow(withNote);

    expect(screen.getByText("Note from user")).toBeInTheDocument();
    expect(screen.getByText("Please let me in")).toBeInTheDocument();
  });

  it("hides a note already read", () => {
    renderRow({ ...withNote, requestNoteReadAt: "2026-01-06T00:00:00Z" });
    expect(screen.queryByText("Please let me in")).toBeNull();
  });

  it("hides a note without a submission time", () => {
    renderRow({ requestDescription: "orphan note" });
    expect(screen.queryByText("orphan note")).toBeNull();
  });

  it("tells the parent the note is now read", async () => {
    const { user, handlers } = renderRow(withNote);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() =>
      expect(handlers.onDeviceUpdate).toHaveBeenCalledTimes(1),
    );
    const [updated] = handlers.onDeviceUpdate.mock.calls[0];
    expect(updated.id).toBe(1);
    expect(updated.requestDescription).toBe("Please let me in");
    expect(Number.isNaN(Date.parse(updated.requestNoteReadAt ?? ""))).toBe(
      false,
    );
  });

  it("does not tell the parent when marking fails", async () => {
    markDeviceNoteAsRead.mockRejectedValue(new Error("server said no"));
    const { user, handlers } = renderRow(withNote);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(handlers.onDeviceUpdate).not.toHaveBeenCalled();
  });

  it("marks the note as read and hides it", async () => {
    const { user } = renderRow(withNote);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() => expect(markDeviceNoteAsRead).toHaveBeenCalledWith(1));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Note marked as read",
        variant: "success",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Please let me in")).toBeNull(),
    );
  });

  it("spins while the note is being marked", async () => {
    let finish: () => void = () => {};
    markDeviceNoteAsRead.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { user, container } = renderRow(withNote);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    finish();
    await waitFor(() =>
      expect(screen.queryByText("Please let me in")).toBeNull(),
    );
  });

  it("reports a failure and keeps the note visible", async () => {
    markDeviceNoteAsRead.mockRejectedValue(new Error("server said no"));
    const { user } = renderRow(withNote);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          variant: "destructive",
          description: "server said no",
        }),
      ),
    );
    expect(screen.getByText("Please let me in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeEnabled();
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    markDeviceNoteAsRead.mockRejectedValue("boom");
    const { user } = renderRow(withNote);

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to mark the note as read",
        }),
      ),
    );
  });

  it("hides the note when the device prop reports it read", () => {
    const callbacks = handlers();
    const { rerender } = render(
      <DeviceRow
        device={device(withNote)}
        actionLoading={null}
        {...callbacks}
      />,
    );
    expect(screen.getByText("Please let me in")).toBeInTheDocument();

    rerender(
      <DeviceRow
        device={device({
          ...withNote,
          requestNoteReadAt: "2026-01-06T00:00:00Z",
        })}
        actionLoading={null}
        {...callbacks}
      />,
    );

    expect(screen.queryByText("Please let me in")).toBeNull();
  });
});

describe("DeviceRow concurrent limit", () => {
  it("pills a device left out of the stream limit", () => {
    renderRow({ excludeFromConcurrentLimit: true });
    expect(
      screen.getByRole("button", { name: /not counted towards/ }),
    ).toHaveTextContent("Not counted in limit");
  });

  it("leaves the pill off a counted device", () => {
    renderRow({ excludeFromConcurrentLimit: false });
    expect(screen.queryByText("Not counted in limit")).toBeNull();
  });
});
