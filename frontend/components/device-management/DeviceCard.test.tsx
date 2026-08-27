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

  return {
    ...view,
    handlers,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

type User = ReturnType<typeof userEvent.setup>;

const openMenu = async (user: User) => {
  await user.click(screen.getByRole("button", { name: /Actions/ }));
  return screen.findAllByRole("menuitem");
};

const choose = async (user: User, name: string) => {
  await openMenu(user);
  await user.click(await screen.findByRole("menuitem", { name }));
};

const menuLabels = async (user: User) =>
  (await openMenu(user)).map((item) => item.textContent?.trim());

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
    expect(screen.getByText(/7 streams/)).toBeInTheDocument();
  });

  it("falls back for a nameless device and unknown platform", () => {
    renderCard({ deviceName: undefined, devicePlatform: undefined });
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });

  it.each([
    ["approved", "bg-emerald-500/70"],
    ["rejected", "bg-rose-500/70"],
    ["pending", "bg-amber-500/70"],
  ] as const)("carries a %s device's status on the rail", (status, rail) => {
    const { container } = renderCard({ status });
    expect(container.innerHTML).toContain(rail);
  });

  it("tones a PlexAmp device", () => {
    const { container } = renderCard({ deviceProduct: "Plexamp" });

    expect(container.innerHTML).toContain("bg-violet-500/70");
  });

  it("detects PlexAmp from the device name too", () => {
    const { container } = renderCard({
      deviceProduct: "Plex",
      deviceName: "Office PlexAmp",
    });
    expect(container.innerHTML).toContain("bg-violet-500/70");
  });

  it("shows when the device was last seen as the subtitle", () => {
    renderCard();
    expect(screen.getByText(/^Last seen /)).toBeInTheDocument();
  });

  it("shows the product in the meta grid rather than repeating it", () => {
    renderCard();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Plex for Roku")).toBeInTheDocument();
  });
});

describe("DeviceCard dense row", () => {
  it("keeps every fact on one line instead of a labelled grid", () => {
    const { container } = renderCard();

    const facts = container.querySelectorAll("dl");

    expect(facts).toHaveLength(1);
    expect(facts[0].textContent).toContain("Plex for Roku");
    expect(facts[0].textContent).toContain("Roku");
    expect(facts[0].textContent).toContain("192.168.1.10");
    expect(facts[0].textContent).toContain("7 streams");
    expect(facts[0].textContent).toContain("Last seen");
  });

  it("keeps the field names for screen readers only", () => {
    const { container } = renderCard();

    const labels = Array.from(container.querySelectorAll("dt"));

    expect(labels.map((label) => label.textContent)).toEqual([
      "Product",
      "Platform",
      "IP Address",
      "Streams",
      "Last Seen",
    ]);
    for (const label of labels) {
      expect(label.className).toContain("sr-only");
    }
  });

  it.each([
    [1, "1 stream"],
    [2, "2 streams"],
    [0, "0 streams"],
  ])("counts %p session(s) in words", (sessionCount, expected) => {
    renderCard({ sessionCount });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("counts no sessions when the server omits the field", () => {
    renderCard({ sessionCount: undefined });
    expect(screen.getByText("0 streams")).toBeInTheDocument();
  });

  it("sits the status pill beside the name rather than across from it", () => {
    renderCard({ status: "pending" });

    const name = screen.getByRole("heading", { name: "Living Room TV" });
    const pill = screen.getByText("Pending");

    expect(name.parentElement).toContainElement(pill);
  });

  it("keeps the pill smaller than the name it annotates", () => {
    renderCard({ status: "pending" });

    expect(screen.getByText("Pending").className).toContain("text-[10px]");
    expect(
      screen.getByRole("heading", { name: "Living Room TV" }).className,
    ).toContain("text-sm");
  });

  it("keeps the note below the row rather than inside it", () => {
    const { container } = renderCard({
      requestDescription: "Please let me in",
      requestSubmittedAt: "2026-01-05T00:00:00Z",
    });

    const row = container.querySelector("dl")?.closest("div.lg\\:flex-row");

    expect(row).not.toContainElement(screen.getByText("Please let me in"));
  });
});

describe("DeviceCard status pill", () => {
  it("flags a pending device, the one row needing a decision", () => {
    renderCard({ status: "pending" });
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it.each(["approved", "rejected"] as const)(
    "leaves a %s device unlabelled",
    (status) => {
      const { container } = renderCard({ status });

      expect(container.querySelectorAll(".rounded-full")).toHaveLength(0);
    },
  );

  it("leaves an unmanageable PlexAmp device unlabelled too", () => {
    const { container } = renderCard({
      status: "pending",
      deviceProduct: "Plexamp",
    });

    expect(screen.queryByText("Pending")).toBeNull();
    expect(container.querySelectorAll(".rounded-full")).toHaveLength(0);
  });

  it("no longer repeats temporary access, bypass or limit state", () => {
    hasTemporaryAccess.mockReturnValue(true);
    renderCard({
      status: "approved",
      temporaryAccessBypassPolicies: true,
      excludeFromConcurrentLimit: true,
    });

    expect(screen.queryByText("2h")).toBeNull();
    expect(screen.queryByText("Bypass")).toBeNull();
    expect(screen.queryByText("No Limit")).toBeNull();
  });

  it("shows the pending pill without a leading dot", () => {
    renderCard({ status: "pending" });

    expect(
      screen.getByText("Pending").querySelectorAll("span[aria-hidden]"),
    ).toHaveLength(0);
  });
});

describe("DeviceCard actions", () => {
  it("collapses every action behind one trigger", () => {
    renderCard({ status: "pending" });

    expect(screen.getByRole("button", { name: /Actions/ })).toBeInTheDocument();
    for (const label of ["Approve", "Reject", "View Details", "Delete"]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("offers approve and reject while pending", async () => {
    const { user, handlers } = renderCard({ status: "pending" });

    await choose(user, "Approve");
    expect(handlers.onApprove).toHaveBeenCalled();

    await choose(user, "Reject");
    expect(handlers.onReject).toHaveBeenCalled();
  });

  it("offers approval again for a rejected device", async () => {
    const { user, handlers } = renderCard({ status: "rejected" });

    await choose(user, "Approve");

    expect(handlers.onToggleApproval).toHaveBeenCalled();
  });

  it("offers rejection for an approved device", async () => {
    const { user, handlers } = renderCard({ status: "approved" });

    await choose(user, "Reject");

    expect(handlers.onToggleApproval).toHaveBeenCalled();
  });

  it.each(["pending", "approved", "rejected"] as const)(
    "offers delete for a %s device",
    async (status) => {
      const { user, handlers } = renderCard({ status });

      await choose(user, "Delete");

      expect(handlers.onDelete).toHaveBeenCalled();
    },
  );

  it("opens the details", async () => {
    const { user, handlers } = renderCard();

    await choose(user, "View Details");

    expect(handlers.onShowDetails).toHaveBeenCalled();
  });

  it.each(["pending", "rejected"] as const)(
    "revokes temporary access for a %s device",
    async (status) => {
      hasTemporaryAccess.mockReturnValue(true);
      const { user, handlers } = renderCard({ status });

      await choose(user, "Revoke Temp Access");

      expect(handlers.onRevokeTempAccess).toHaveBeenCalledWith(1);
    },
  );

  it("omits the revoke entry without temporary access", async () => {
    const { user } = renderCard({ status: "pending" });

    expect(await menuLabels(user)).not.toContain("Revoke Temp Access");
  });

  it("offers only delete and details for a PlexAmp device", async () => {
    const { user, handlers } = renderCard({ deviceProduct: "Plexamp" });

    expect(await menuLabels(user)).toEqual(["View Details", "Delete"]);

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(handlers.onDelete).toHaveBeenCalled();
  });

  it("separates the destructive entry from the rest", async () => {
    const { user } = renderCard({ status: "pending" });
    await openMenu(user);

    const remove = screen.getByRole("menuitem", { name: "Delete" });
    const separator = remove.previousElementSibling;

    expect(separator?.getAttribute("role")).toBe("separator");
  });

  it("tones the approve entry apart from the destructive ones", async () => {
    const { user } = renderCard({ status: "pending" });
    await openMenu(user);

    expect(
      screen.getByRole("menuitem", { name: "Approve" }).className,
    ).toContain("text-emerald-700");
    for (const label of ["Reject", "Delete"]) {
      expect(screen.getByRole("menuitem", { name: label }).className).toContain(
        "text-rose-600",
      );
    }
  });

  it("leaves the details entry untinted", async () => {
    const { user } = renderCard({ status: "pending" });
    await openMenu(user);

    const details = screen.getByRole("menuitem", { name: "View Details" });

    expect(details.className).not.toContain("text-rose");
    expect(details.className).not.toContain("text-emerald");
  });

  it("disables the trigger and spins it while an action runs", () => {
    renderCard({}, { actionLoading: 1 });

    const trigger = screen.getByRole("button", { name: /Actions/ });

    expect(trigger).toBeDisabled();
    expect(trigger.querySelector(".animate-spin")).not.toBeNull();
  });

  it("leaves the trigger enabled while another device is busy", () => {
    renderCard({}, { actionLoading: 99 });

    expect(screen.getByRole("button", { name: /Actions/ })).not.toBeDisabled();
  });

  it("shows an overflow glyph, not the expander chevron the group header uses", () => {
    renderCard({ status: "pending" });

    const trigger = screen.getByRole("button", { name: /Actions/ });

    expect(
      trigger.querySelector("svg.lucide-ellipsis-vertical"),
    ).not.toBeNull();
    expect(trigger.querySelector("svg.lucide-chevron-down")).toBeNull();
  });

  it("hides the trigger label on wide screens but keeps its name", () => {
    renderCard({ status: "pending" });

    const trigger = screen.getByRole("button", { name: /Actions/ });

    expect(trigger.className).toContain("lg:size-8");
    expect(screen.getByText("Actions").className).toContain("lg:sr-only");
  });

  it("gives the trigger a taller mobile target", () => {
    renderCard({ status: "pending" });

    expect(screen.getByRole("button", { name: /Actions/ }).className).toContain(
      "h-10",
    );
  });

  it("sits the trigger alongside the device details rather than below them", () => {
    const { container } = renderCard({ status: "pending" });

    const row = container.querySelector("dl")?.closest("div.lg\\:flex-row");

    expect(row).not.toBeNull();
    expect(row).toContainElement(
      screen.getByRole("button", { name: /Actions/ }),
    );
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

    await user.click(screen.getByRole("button", { name: "Mark Read" }));

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

    await user.click(screen.getByRole("button", { name: "Mark Read" }));

    await waitFor(() => expect(markDeviceNoteAsRead).toHaveBeenCalled());
  });

  it("reports a failure and keeps the note visible", async () => {
    markDeviceNoteAsRead.mockRejectedValue(new Error("server said no"));
    const { user } = renderCard(withNote);

    await user.click(screen.getByRole("button", { name: "Mark Read" }));

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

    await user.click(screen.getByRole("button", { name: "Mark Read" }));

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
  it.each([
    ["pending", ["Approve", "Reject", "View Details", "Delete"]],
    ["rejected", ["Approve", "View Details", "Delete"]],
    ["approved", ["Reject", "View Details", "Delete"]],
  ] as const)(
    "puts the decision first on a %s device",
    async (status, order) => {
      const { user } = renderCard({ status });

      expect(await menuLabels(user)).toEqual(order);
    },
  );

  it("keeps delete last so it is never the accidental click", async () => {
    hasTemporaryAccess.mockReturnValue(true);
    const { user } = renderCard({ status: "pending" });

    const labels = await menuLabels(user);

    expect(labels).toEqual([
      "Approve",
      "Reject",
      "View Details",
      "Revoke Temp Access",
      "Delete",
    ]);
  });

  it("renders each entry once rather than in mobile and desktop copies", async () => {
    const { user } = renderCard({ status: "pending" });
    const labels = await menuLabels(user);

    expect(labels).toEqual([...new Set(labels)]);
  });
});
