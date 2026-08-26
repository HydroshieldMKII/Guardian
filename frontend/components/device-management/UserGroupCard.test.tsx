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
    onGrantUserTempAccess: jest.fn(),
    onShowTimePolicy: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onDelete: jest.fn(),
    onToggleApproval: jest.fn(),
    onRevokeTempAccess: jest.fn(),
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

describe("UserGroupCard badges", () => {
  it("shows the schedule and IP badges when flagged", () => {
    renderCard({}, { hasTimeSchedules: true, hasIPPolicies: true });

    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IP Policy").length).toBeGreaterThan(0);
  });

  it("omits them otherwise", () => {
    renderCard();
    expect(screen.queryByText("Scheduled")).toBeNull();
    expect(screen.queryByText("IP Policy")).toBeNull();
  });

  it("shows a concurrent limit", () => {
    renderCard({
      user: {
        userId: "u-1",
        preference: preference({ concurrentStreamLimit: 2 }),
      },
    });
    expect(screen.getByText("2 Streams")).toBeInTheDocument();
  });

  it("uses the singular for one stream", () => {
    renderCard({
      user: {
        userId: "u-1",
        preference: preference({ concurrentStreamLimit: 1 }),
      },
    });
    expect(screen.getByText("1 Stream")).toBeInTheDocument();
  });

  it("reads zero as unlimited", () => {
    renderCard({
      user: {
        userId: "u-1",
        preference: preference({ concurrentStreamLimit: 0 }),
      },
    });
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
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
    ["Temporary Access", "onGrantUserTempAccess"],
    ["Stream History", "onShowHistory"],
  ] as const)("invokes %s", async (label, handler) => {
    const { user, handlers } = renderCard();

    await user.click(screen.getByText(label));

    expect(handlers[handler]).toHaveBeenCalledWith("u-1");
  });

  it("toggles visibility", async () => {
    const { user, handlers } = renderCard();

    await user.click(screen.getByTitle("Hide user"));

    expect(handlers.onToggleUserVisibility).toHaveBeenCalledWith("u-1");
  });

  it("offers to show a hidden user", () => {
    renderCard({
      user: { userId: "u-1", preference: preference({ hidden: true }) },
    });
    expect(screen.getByTitle("Show user")).toBeInTheDocument();
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
        onRevokeTempAccess={jest.fn()}
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
});

describe("UserGroupCard device list", () => {
  it("renders one card per device", () => {
    renderCard({ devices: [device({ id: 1 }), device({ id: 2 })] });

    expect(screen.getByText("device-card:1")).toBeInTheDocument();
    expect(screen.getByText("device-card:2")).toBeInTheDocument();
  });

  it("says when there are none", () => {
    renderCard({ devices: [] });
    expect(
      screen.getByText("No devices found for this user"),
    ).toBeInTheDocument();
  });
});
