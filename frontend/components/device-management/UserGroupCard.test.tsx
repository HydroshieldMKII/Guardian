import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice, UserPreference } from "@/types";
import { UserGroupCard } from "@/components/device-management/UserGroupCard";

const getGlobalDefaultBlock = jest.fn();
let configLoading = false;
jest.mock("@/contexts/settings-context", () => ({
  useSettings: () => ({ getGlobalDefaultBlock, loading: configLoading }),
}));

jest.mock("@/components/device-management/DeviceCard", () => ({
  DeviceCard: ({ device }: { device: UserDevice }) => (
    <div>{`device-card:${device.id}`}</div>
  ),
}));

jest.mock("@/components/device-management/IPAccessModal", () => ({
  IPAccessModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (
    <div>
      <span>{`ip-modal:${isOpen}`}</span>
      <button onClick={onClose}>close ip</button>
    </div>
  ),
}));

jest.mock("@/components/device-management/ConcurrentStreamModal", () => ({
  ConcurrentStreamModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (
    <div>
      <span>{`limit-modal:${isOpen}`}</span>
      <button onClick={onClose}>close limit</button>
    </div>
  ),
}));

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "TV",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 1,
  ...overrides,
});

const preference = (
  overrides: Partial<UserPreference> = {},
): UserPreference => ({
  id: 1,
  userId: "u-1",
  defaultBlock: null,
  hidden: false,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  allowedIPs: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const group = (overrides: Record<string, unknown> = {}) => ({
  user: { userId: "u-1", username: "testuser", preference: preference() },
  devices: [device()],
  pendingCount: 1,
  approvedCount: 0,
  rejectedCount: 0,
  ...overrides,
});

const renderCard = (
  overrides: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
) => {
  const handlers = {
    onToggleExpansion: jest.fn(),
    onUpdateUserPreference: jest.fn(),
    onUpdateUserIPPolicy: jest.fn(),
    onToggleUserVisibility: jest.fn(),
    onShowHistory: jest.fn(),
    onGrantUserTemporaryAccess: jest.fn(),
    onShowTimePolicy: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onDelete: jest.fn(),
    onToggleApproval: jest.fn(),
    onRemoveTemporaryAccess: jest.fn(),
    onShowDetails: jest.fn(),
  };

  const view = render(
    <UserGroupCard
      group={group(overrides) as never}
      isExpanded
      actionLoading={null}
      {...handlers}
      {...props}
    />,
  );

  return { ...view, handlers, user: userEvent.setup() };
};

beforeEach(() => {
  jest.clearAllMocks();
  configLoading = false;
  getGlobalDefaultBlock.mockReturnValue(false);
});

describe("UserGroupCard header", () => {
  it("names the user and counts devices", () => {
    renderCard();

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText(/1 device/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending/)).toBeInTheDocument();
  });

  it("falls back to the user id", () => {
    renderCard({ user: { userId: "u-9" } });
    expect(screen.getAllByText("u-9").length).toBeGreaterThan(0);
  });

  it("pluralises the device count", () => {
    renderCard({ devices: [device({ id: 1 }), device({ id: 2 })] });
    expect(screen.getByText(/2 devices/)).toBeInTheDocument();
  });

  it("hides the pending note when nothing is pending", () => {
    renderCard({ pendingCount: 0 });
    expect(screen.queryByText(/pending/)).toBeNull();
  });

  it("carries the user id for scroll targeting", () => {
    const { container } = renderCard();
    expect(container.querySelector('[data-user-id="u-1"]')).not.toBeNull();
  });

  it("swaps the chevron when collapsed", () => {
    const { container } = renderCard({}, { isExpanded: false });
    expect(container.querySelector(".lucide-chevron-right")).not.toBeNull();
  });

  it("toggles expansion when the header is clicked", async () => {
    const { user, handlers } = renderCard();

    await user.click(screen.getByText("testuser"));

    expect(handlers.onToggleExpansion).toHaveBeenCalledWith("u-1");
  });
});

const badges = (label: string) =>
  screen
    .queryAllByText(label)
    .map((node) => node.closest("span[title]"))
    .filter(Boolean);

describe("UserGroupCard badges", () => {
  it("raises a schedule badge when a rule reaches any device", () => {
    renderCard(
      {},
      {
        timeRules: [
          { id: 1, userId: "u-1", enabled: true, dayOfWeek: 1 },
        ] as never,
      },
    );

    expect(badges("Time Schedule").length).toBeGreaterThan(0);
  });

  it("raises a schedule badge for a device-specific rule too", () => {
    renderCard(
      {},
      {
        timeRules: [
          {
            id: 1,
            userId: "u-1",
            deviceIdentifier: "device-1",
            enabled: true,
            dayOfWeek: 1,
          },
        ] as never,
      },
    );

    expect(badges("Time Schedule").length).toBeGreaterThan(0);
  });

  it("ignores a rule aimed at some other device", () => {
    renderCard(
      {},
      {
        timeRules: [
          {
            id: 1,
            userId: "u-1",
            deviceIdentifier: "other-device",
            enabled: true,
            dayOfWeek: 1,
          },
        ] as never,
      },
    );

    expect(badges("Time Schedule")).toHaveLength(0);
  });

  it("raises an IP badge from the user's own preference", () => {
    renderCard({
      user: {
        userId: "u-1",
        username: "testuser",
        preference: preference({ ipAccessPolicy: "restricted" }),
      },
    });

    expect(badges("IP Access").length).toBeGreaterThan(0);
  });

  it("raises a temporary access badge when any device holds one", () => {
    renderCard({
      devices: [
        device({ id: 1 }),
        device({
          id: 2,
          deviceIdentifier: "device-2",
          temporaryAccessUntil: new Date(Date.now() + 3600_000).toISOString(),
        }),
      ],
    });

    expect(badges("Temporary Access").length).toBeGreaterThan(0);
  });

  it("omits them otherwise", () => {
    renderCard();
    expect(badges("Time Schedule")).toHaveLength(0);
    expect(badges("IP Access")).toHaveLength(0);
    expect(badges("Temporary Access")).toHaveLength(0);
  });

  it("shows a concurrent limit", () => {
    renderCard({
      user: {
        userId: "u-1",
        preference: preference({ concurrentStreamLimit: 2 }),
      },
    });
    expect(screen.getByText("2 Streams at Once")).toBeInTheDocument();
  });

  it("uses the singular for one stream", () => {
    renderCard({
      user: {
        userId: "u-1",
        preference: preference({ concurrentStreamLimit: 1 }),
      },
    });
    expect(screen.getByText("1 Stream at Once")).toBeInTheDocument();
  });

  it("reads zero as unlimited", () => {
    renderCard({
      user: {
        userId: "u-1",
        preference: preference({ concurrentStreamLimit: 0 }),
      },
    });
    expect(screen.getByText("Unlimited Streams")).toBeInTheDocument();
  });

  it("omits the limit badge when it is inherited", () => {
    renderCard();
    expect(screen.queryByText(/^\d+ Streams?$/)).toBeNull();
    expect(screen.queryByText("Blocked")).toBeNull();
  });

  it("counts devices excluded from the limit", () => {
    renderCard({
      devices: [
        device({ id: 1, excludeFromConcurrentLimit: true }),
        device({ id: 2 }),
      ],
    });
    expect(screen.getByText("1 Excluded")).toBeInTheDocument();
  });

  it("omits the excluded badge when none are", () => {
    renderCard();
    expect(screen.queryByText(/Excluded/)).toBeNull();
  });

  it("omits the preference badge without a preference", () => {
    renderCard({ user: { userId: "u-1" } });
    expect(screen.queryByText("Global Default")).toBeNull();
  });
});

describe("UserGroupCard user actions", () => {
  it.each([
    ["Time Schedule", "onShowTimePolicy"],
    ["Temporary Access", "onGrantUserTemporaryAccess"],
    ["Stream History", "onShowHistory"],
  ] as const)("invokes %s", async (label, handler) => {
    const { user, handlers } = renderCard();

    await user.click(screen.getByText(label));

    expect(handlers[handler]).toHaveBeenCalledWith("u-1");
  });

  it("toggles visibility", async () => {
    const { user, handlers } = renderCard();

    await user.click(
      screen.getByTitle(
        "Move this user to the hidden section at the bottom of the list",
      ),
    );

    expect(handlers.onToggleUserVisibility).toHaveBeenCalledWith("u-1");
  });

  it("offers to show a hidden user", () => {
    renderCard({
      user: { userId: "u-1", preference: preference({ hidden: true }) },
    });
    expect(
      screen.getByTitle("Move this user back into the main list"),
    ).toBeInTheDocument();
  });

  it("opens and closes the IP modal", async () => {
    const { user } = renderCard();
    expect(screen.getByText("ip-modal:false")).toBeInTheDocument();

    await user.click(screen.getByText("IP Access"));
    expect(screen.getByText("ip-modal:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close ip" }));
    expect(screen.getByText("ip-modal:false")).toBeInTheDocument();
  });

  it("opens and closes the concurrent limit modal", async () => {
    const { user } = renderCard();

    await user.click(screen.getByText("Stream Limit"));
    expect(screen.getByText("limit-modal:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close limit" }));
    expect(screen.getByText("limit-modal:false")).toBeInTheDocument();
  });

  it("hides the whole actions card when no handlers are supplied", () => {
    render(
      <UserGroupCard
        group={group() as never}
        isExpanded
        actionLoading={null}
        onToggleExpansion={jest.fn()}
        onUpdateUserPreference={jest.fn()}
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onDelete={jest.fn()}
        onToggleApproval={jest.fn()}
        onRemoveTemporaryAccess={jest.fn()}
        onShowDetails={jest.fn()}
      />,
    );

    expect(screen.queryByText("User Actions")).toBeNull();
    expect(screen.queryByText("ip-modal:false")).toBeNull();
  });
});

describe("UserGroupCard default device policy", () => {
  it.each([
    [/^Global/, null],
    [/^Allow$/, false],
    [/^Block$/, true],
  ] as const)("sets the policy from %s", async (name, expected) => {
    const { user, handlers } = renderCard();

    await user.click(screen.getByRole("button", { name }));

    expect(handlers.onUpdateUserPreference).toHaveBeenCalledWith(
      "u-1",
      expected,
    );
  });

  it("names the global default when settings are loaded", () => {
    getGlobalDefaultBlock.mockReturnValue(true);
    renderCard();
    expect(
      screen.getByRole("button", { name: "Global (Block)" }),
    ).toBeInTheDocument();
  });

  it("omits the global default while settings load", () => {
    configLoading = true;
    renderCard();
    expect(screen.getByRole("button", { name: "Global" })).toBeInTheDocument();
  });

  it("disables the buttons while the preference is saving", () => {
    renderCard({}, { updatingUserPreference: "u-1" });

    expect(screen.getByRole("button", { name: /^Global/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Allow$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Block$/ })).toBeDisabled();
  });

  it("leaves the buttons enabled while another user saves", () => {
    renderCard({}, { updatingUserPreference: "u-2" });
    expect(screen.getByRole("button", { name: /^Allow$/ })).not.toBeDisabled();
  });

  const pressed = (name: RegExp) =>
    screen.getByRole("button", { name }).getAttribute("aria-pressed");

  it("shows one saving indicator rather than one per option", () => {
    const { container } = renderCard({}, { updatingUserPreference: "u-1" });

    expect(container.querySelectorAll(".animate-spin")).toHaveLength(1);
    expect(
      screen.getByLabelText("Saving the default device policy"),
    ).toBeInTheDocument();
  });

  it("moves the selection before the save comes back", async () => {
    const { user, rerender } = renderCard();

    await user.click(screen.getByRole("button", { name: /^Block$/ }));
    rerender(
      <UserGroupCard
        group={group() as never}
        isExpanded
        actionLoading={null}
        updatingUserPreference="u-1"
        onToggleExpansion={jest.fn()}
        onUpdateUserPreference={jest.fn()}
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onDelete={jest.fn()}
        onToggleApproval={jest.fn()}
        onRemoveTemporaryAccess={jest.fn()}
        onShowDetails={jest.fn()}
      />,
    );

    expect(pressed(/^Block$/)).toBe("true");
    expect(pressed(/^Global/)).toBe("false");
  });

  it("falls back to the stored choice when the save fails", async () => {
    const { user, rerender } = renderCard();
    const stillGlobal = (updating: string | null) => (
      <UserGroupCard
        group={group() as never}
        isExpanded
        actionLoading={null}
        updatingUserPreference={updating}
        onToggleExpansion={jest.fn()}
        onUpdateUserPreference={jest.fn()}
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onDelete={jest.fn()}
        onToggleApproval={jest.fn()}
        onRemoveTemporaryAccess={jest.fn()}
        onShowDetails={jest.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /^Block$/ }));
    rerender(stillGlobal("u-1"));
    expect(pressed(/^Block$/)).toBe("true");

    rerender(stillGlobal(null));
    expect(pressed(/^Global/)).toBe("true");
    expect(pressed(/^Block$/)).toBe("false");
  });
});

describe("UserGroupCard device list", () => {
  it("renders one card per device", () => {
    renderCard({ devices: [device({ id: 1 }), device({ id: 2 })] });

    expect(screen.getByText("device-card:1")).toBeInTheDocument();
    expect(screen.getByText("device-card:2")).toBeInTheDocument();
  });

  it("says when there are none", () => {
    renderCard({ devices: [] });
    expect(screen.getByText(/No devices yet/)).toBeInTheDocument();
  });
});
