import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import { DeviceCard } from "@/components/device-management/DeviceCard";

const hasTemporaryAccess = jest.fn();
const getTemporaryAccessTimeLeft = jest.fn();
jest.mock("@/hooks/device-management/useDeviceUtils", () => ({
  useDeviceUtils: () => ({ hasTemporaryAccess, getTemporaryAccessTimeLeft }),
}));

const markDeviceNoteAsRead = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    markDeviceNoteAsRead: (...a: unknown[]) => markDeviceNoteAsRead(...a),
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
  ipAddress: "192.168.1.10",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-02-01T00:00:00Z",
  sessionCount: 7,
  ...overrides,
});

const renderCard = (
  overrides: Partial<UserDevice> = {},
  props: { actionLoading?: number | null; onDeviceUpdate?: jest.Mock } = {},
) => {
  const handlers = {
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onDelete: jest.fn(),
    onToggleApproval: jest.fn(),
    onRevokeTempAccess: jest.fn(),
    onShowDetails: jest.fn(),
  };

  const view = render(
    <DeviceCard
      device={device(overrides)}
      actionLoading={props.actionLoading ?? null}
      onDeviceUpdate={props.onDeviceUpdate}
      {...handlers}
    />,
  );

  return { ...view, handlers, user: userEvent.setup() };
};

const clickAll = async (
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp | string,
) => {
  for (const button of screen.getAllByRole("button", { name })) {
    await user.click(button);
  }
};

const clickFirst = async (
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp | string,
) => user.click(screen.getAllByRole("button", { name })[0]);

beforeEach(() => {
  jest.clearAllMocks();
  hasTemporaryAccess.mockReturnValue(false);
  getTemporaryAccessTimeLeft.mockReturnValue("2h");
  markDeviceNoteAsRead.mockResolvedValue(undefined);
});

describe("DeviceCard identity", () => {
  it("anchors itself for scroll targeting", () => {
    const { container } = renderCard();

    expect(container.querySelector("#device-1")).not.toBeNull();
    expect(
      container.querySelector('[data-device-identifier="device-1"]'),
    ).not.toBeNull();
  });

  it("shows the device name, platform, IP and stream count", () => {
    renderCard();

    expect(screen.getAllByText("Living Room TV").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Roku").length).toBeGreaterThan(0);
    expect(screen.getAllByText("192.168.1.10").length).toBeGreaterThan(0);
    expect(screen.getByText("Streams")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("falls back for a nameless device and unknown platform", () => {
    renderCard({ deviceName: undefined, devicePlatform: undefined });
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });

  it.each([
    ["approved", "bg-emerald-500/70", "Approved"],
    ["rejected", "bg-rose-500/70", "Rejected"],
    ["pending", "bg-amber-500/70", "Pending"],
  ] as const)("tones a %s device", (status, rail, label) => {
    const { container } = renderCard({ status });
    expect(container.innerHTML).toContain(rail);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("tones and labels a PlexAmp device", () => {
    const { container } = renderCard({ deviceProduct: "Plexamp" });

    expect(container.innerHTML).toContain("bg-violet-500/70");
    expect(screen.getAllByText("Plex Amp").length).toBeGreaterThan(0);
  });

  it("detects PlexAmp from the device name too", () => {
    renderCard({ deviceProduct: "Plex", deviceName: "Office PlexAmp" });
    expect(screen.getAllByText("Plex Amp").length).toBeGreaterThan(0);
  });

  it("shows the product and platform as the subtitle", () => {
    renderCard();
    expect(screen.getByText("Plex for Roku · Roku")).toBeInTheDocument();
  });
});

describe("DeviceCard badges", () => {
  it("shows the remaining temporary access", () => {
    hasTemporaryAccess.mockReturnValue(true);
    renderCard();
    expect(screen.getAllByText("2h").length).toBeGreaterThan(0);
  });

  it("flags a policy bypass", () => {
    hasTemporaryAccess.mockReturnValue(true);
    renderCard({ temporaryAccessBypassPolicies: true });
    expect(screen.getAllByText("Bypass").length).toBeGreaterThan(0);
  });

  it("omits the bypass flag without temporary access", () => {
    renderCard({ temporaryAccessBypassPolicies: true });
    expect(screen.queryByText("Bypass")).toBeNull();
  });

  it("flags an approved device excluded from the concurrent limit", () => {
    renderCard({ status: "approved", excludeFromConcurrentLimit: true });
    expect(screen.getAllByText("No Limit").length).toBeGreaterThan(0);
  });

  it("omits that flag while pending", () => {
    renderCard({ status: "pending", excludeFromConcurrentLimit: true });
    expect(screen.queryByText("No Limit")).toBeNull();
  });
});

describe("DeviceCard actions by status", () => {
  it("offers approve and reject while pending", async () => {
    const { user, handlers } = renderCard({ status: "pending" });

    await clickAll(user, /Approve/);
    await clickAll(user, /Reject/);

    expect(handlers.onApprove).toHaveBeenCalled();
    expect(handlers.onReject).toHaveBeenCalled();
  });

  it("offers approval again for a rejected device", async () => {
    const { user, handlers } = renderCard({ status: "rejected" });

    await clickAll(user, /Approve/);

    expect(handlers.onToggleApproval).toHaveBeenCalled();
  });

  it("offers rejection for an approved device", async () => {
    const { user, handlers } = renderCard({ status: "approved" });

    await clickAll(user, /Reject/);

    expect(handlers.onToggleApproval).toHaveBeenCalled();
  });

  it("always offers delete", async () => {
    const { user, handlers } = renderCard();

    await clickAll(user, /Delete/);

    expect(handlers.onDelete).toHaveBeenCalled();
  });

  it.each(["pending", "approved", "rejected"] as const)(
    "offers delete for a %s device",
    async (status) => {
      const { user, handlers } = renderCard({ status });

      await clickAll(user, /Delete/);

      expect(handlers.onDelete).toHaveBeenCalled();
    },
  );

  it.each(["pending", "rejected"] as const)(
    "revokes temporary access for a %s device",
    async (status) => {
      hasTemporaryAccess.mockReturnValue(true);
      const { user, handlers } = renderCard({ status });

      await clickAll(user, /Revoke/i);

      expect(handlers.onRevokeTempAccess).toHaveBeenCalledWith(1);
    },
  );

  it("offers only delete for a PlexAmp device", async () => {
    const { user, handlers } = renderCard({ deviceProduct: "Plexamp" });

    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reject/ })).toBeNull();

    await clickAll(user, /Delete/);
    expect(handlers.onDelete).toHaveBeenCalled();
  });

  it("opens the details", async () => {
    const { user, handlers } = renderCard();

    await clickAll(user, /View Details/);

    expect(handlers.onShowDetails).toHaveBeenCalled();
  });

  it("revokes temporary access", async () => {
    hasTemporaryAccess.mockReturnValue(true);
    const { user, handlers } = renderCard();

    await clickAll(user, /Revoke/i);

    expect(handlers.onRevokeTempAccess).toHaveBeenCalledWith(1);
  });

  it("disables every action while one is running", () => {
    const { container } = renderCard({}, { actionLoading: 1 });
    const buttons = Array.from(container.querySelectorAll("button"));
    const busy = buttons.filter((b) => b.querySelector(".animate-spin"));

    expect(busy.length).toBeGreaterThan(0);
    for (const button of busy) {
      expect(button).toBeDisabled();
    }
  });

  it.each([
    ["pending", false],
    ["pending", true],
    ["approved", false],
    ["rejected", false],
    ["rejected", true],
  ] as const)(
    "spins every control for a busy %s device (temp access: %p)",
    (status, temp) => {
      hasTemporaryAccess.mockReturnValue(temp);
      const { container } = renderCard({ status }, { actionLoading: 1 });
      const spinners = container.querySelectorAll("button .animate-spin");

      expect(spinners.length).toBeGreaterThan(0);
    },
  );

  it("spins the delete control for a busy PlexAmp device", () => {
    const { container } = renderCard(
      { deviceProduct: "Plexamp" },
      { actionLoading: 1 },
    );
    expect(
      container.querySelectorAll("button .animate-spin").length,
    ).toBeGreaterThan(0);
  });

  it("leaves actions enabled while another device is busy", () => {
    renderCard({}, { actionLoading: 99 });

    expect(
      screen.getAllByRole("button", { name: /Delete/ })[0],
    ).not.toBeDisabled();
  });
});

describe("DeviceCard user note", () => {
  const withNote = {
    requestDescription: "Please let me in",
    requestSubmittedAt: "2026-01-05T00:00:00Z",
  };

  it("shows an unread note", () => {
    renderCard(withNote);
    expect(screen.getAllByText("Please let me in").length).toBeGreaterThan(0);
  });

  it("hides a note already read", () => {
    renderCard({ ...withNote, requestNoteReadAt: "2026-01-06T00:00:00Z" });
    expect(screen.queryByText("Please let me in")).toBeNull();
  });

  it("hides the block without a submission time", () => {
    renderCard({ requestDescription: "orphan note" });
    expect(screen.queryByText("orphan note")).toBeNull();
  });

  it("marks the note as read and hides it", async () => {
    const onDeviceUpdate = jest.fn();
    const { user } = renderCard(withNote, { onDeviceUpdate });

    await clickAll(user, /Mark Read/);

    await waitFor(() => expect(markDeviceNoteAsRead).toHaveBeenCalledWith(1));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
    expect(onDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ requestNoteReadAt: expect.any(String) }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Please let me in")).toBeNull(),
    );
  });

  it("works without an update callback", async () => {
    const { user } = renderCard(withNote);

    await clickAll(user, /Mark Read/);

    await waitFor(() => expect(markDeviceNoteAsRead).toHaveBeenCalled());
  });

  it("reports a failure and keeps the note visible", async () => {
    markDeviceNoteAsRead.mockRejectedValue(new Error("server said no"));
    const { user } = renderCard(withNote);

    await clickAll(user, /Mark Read/);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "server said no",
        }),
      ),
    );
    expect(screen.getAllByText("Please let me in").length).toBeGreaterThan(0);
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    markDeviceNoteAsRead.mockRejectedValue("boom");
    const { user } = renderCard(withNote);

    await clickAll(user, /Mark Read/);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to mark note as read",
        }),
      ),
    );
  });

  it("re-hides the note when the device prop reports it read", async () => {
    const { rerender } = renderCard(withNote);
    expect(screen.getAllByText("Please let me in").length).toBeGreaterThan(0);

    rerender(
      <DeviceCard
        device={device({
          ...withNote,
          requestNoteReadAt: "2026-01-06T00:00:00Z",
        })}
        actionLoading={null}
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onDelete={jest.fn()}
        onToggleApproval={jest.fn()}
        onRevokeTempAccess={jest.fn()}
        onShowDetails={jest.fn()}
      />,
    );

    expect(screen.queryByText("Please let me in")).toBeNull();
  });
});

describe("DeviceCard action ordering", () => {
  const actionLabels = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("button"))
      .map((b) => b.textContent?.trim())
      .filter((text): text is string =>
        ["Approve", "Reject", "View Details", "Delete"].includes(text ?? ""),
      );

  it("puts the decision above the details on a pending device", () => {
    const { container } = renderCard({ status: "pending" });

    expect(actionLabels(container)).toEqual([
      "Approve",
      "Reject",
      "View Details",
      "Delete",
    ]);
  });

  it("offers re-approval and details on a rejected device", () => {
    const { container } = renderCard({ status: "rejected" });

    expect(actionLabels(container)).toEqual([
      "Approve",
      "Delete",
      "View Details",
    ]);
  });

  it("offers rejection and details on an approved device", () => {
    const { container } = renderCard({ status: "approved" });

    expect(actionLabels(container)).toEqual([
      "Reject",
      "Delete",
      "View Details",
    ]);
  });

  it("offers only delete and details on a PlexAmp device", () => {
    const { container } = renderCard({
      status: "pending",
      deviceProduct: "Plexamp",
    });

    expect(actionLabels(container)).toEqual(["Delete", "View Details"]);
  });

  it("renders each action once rather than in mobile and desktop copies", () => {
    const { container } = renderCard({ status: "pending" });
    const labels = actionLabels(container);

    expect(labels).toEqual([...new Set(labels)]);
  });

  it("opens the details modal from its new position", async () => {
    const { user, handlers } = renderCard({ status: "pending" });

    await user.click(screen.getByRole("button", { name: "View Details" }));

    expect(handlers.onShowDetails).toHaveBeenCalled();
  });
});
