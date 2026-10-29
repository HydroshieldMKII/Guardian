import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice, UserPreference, UserTimeRule } from "@/types";
import {
  UserDetail,
  type DeviceFocus,
} from "@/components/device-management/UserDetail";
import type { UserDeviceGroup } from "@/components/device-management/user-group";
import type { PolicyBadge } from "@/lib/device-policies";

const getGlobalDefaultBlock = jest.fn();
let configLoading = false;
jest.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ getGlobalDefaultBlock, loading: configLoading }),
}));

jest.mock("@/components/device-management/DeviceRow", () => ({
  DeviceRow: ({
    device,
    policies,
    onApprove,
    onDeviceUpdate,
  }: {
    device: UserDevice;
    policies: PolicyBadge[];
    onApprove: (device: UserDevice) => void;
    onDeviceUpdate?: (device: UserDevice) => void;
  }) => (
    <div>
      <span>{`device-row:${device.id}:${policies.map((p) => p.policy).join(",")}`}</span>
      <button
        onClick={() => onApprove(device)}
      >{`approve ${device.id}`}</button>
      <button
        onClick={() => onDeviceUpdate?.(device)}
      >{`update ${device.id}`}</button>
    </div>
  ),
}));

jest.mock("@/components/device-management/IPAccessModal", () => ({
  IPAccessModal: ({
    isOpen,
    onClose,
    onSave,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userId: string, updates: Partial<UserPreference>) => void;
  }) => (
    <div>
      <span>{`ip-modal:${isOpen}`}</span>
      <button onClick={onClose}>close ip</button>
      <button onClick={() => onSave("u-1", { networkPolicy: "lan" })}>
        save ip
      </button>
    </div>
  ),
}));

jest.mock("@/components/device-management/ConcurrentStreamModal", () => ({
  ConcurrentStreamModal: ({
    isOpen,
    onClose,
    onUpdate,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: (changes: { concurrentStreamLimit: number }) => void;
  }) => (
    <div>
      <span>{`limit-modal:${isOpen}`}</span>
      <button onClick={onClose}>close limit</button>
      <button onClick={() => onUpdate?.({ concurrentStreamLimit: 2 })}>
        save limit
      </button>
    </div>
  ),
}));

const FUTURE = "2099-01-01T00:00:00Z";

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

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule => ({
  id: 1,
  userId: "u-1",
  ruleName: "School nights",
  enabled: true,
  action: "block",
  dayOfWeek: 1,
  startTime: "20:00",
  endTime: "22:00",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const group = (overrides: Partial<UserDeviceGroup> = {}): UserDeviceGroup => ({
  user: { userId: "u-1", username: "alex", preference: preference() },
  devices: [device()],
  pendingCount: 1,
  approvedCount: 0,
  rejectedCount: 0,
  ...overrides,
});

const withPreference = (overrides: Partial<UserPreference>) =>
  group({
    user: {
      userId: "u-1",
      username: "alex",
      preference: preference(overrides),
    },
  });

const makeHandlers = () => ({
  onBack: jest.fn(),
  onUpdateUserPreference: jest.fn(),
  onUpdateUserIPPolicy: jest.fn(),
  onUserPreferenceChange: jest.fn(),
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
  onDeviceUpdate: jest.fn(),
});

type Handlers = ReturnType<typeof makeHandlers>;

const detail = (
  props: {
    group?: UserDeviceGroup;
    timeRules?: UserTimeRule[];
    updatingUserPreference?: string | null;
    deviceFocus?: DeviceFocus | null;
  },
  handlers: Handlers,
) => (
  <UserDetail
    group={props.group ?? group()}
    actionLoading={null}
    timeRules={props.timeRules}
    updatingUserPreference={props.updatingUserPreference}
    deviceFocus={props.deviceFocus}
    {...handlers}
  />
);

const renderDetail = (
  props: {
    group?: UserDeviceGroup;
    timeRules?: UserTimeRule[];
    updatingUserPreference?: string | null;
    deviceFocus?: DeviceFocus | null;
  } = {},
) => {
  const handlers = makeHandlers();
  const view = render(detail(props, handlers));
  return {
    ...view,
    handlers,
    rerenderWith: (next: Parameters<typeof detail>[0]) =>
      view.rerender(detail(next, handlers)),
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

const ruleValue = (title: string) =>
  screen
    .getAllByText(title)
    .map((element) => element.closest("button")?.querySelector("span.shrink-0"))
    .find(Boolean)?.textContent;

const ruleDescription = (title: string) =>
  screen.getByText(title).nextElementSibling?.textContent;

const pressed = (name: RegExp) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

beforeEach(() => {
  jest.clearAllMocks();
  configLoading = false;
  getGlobalDefaultBlock.mockReturnValue(false);
});

describe("UserDetail header", () => {
  it("names the user and summarises their devices", () => {
    renderDetail({
      group: group({
        devices: [device({ id: 1 }), device({ id: 2 })],
        pendingCount: 2,
        lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }),
    });

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("alex");
    expect(
      screen.getByText("2 devices, 2 waiting, last seen 3 hours ago"),
    ).toBeInTheDocument();
  });

  it("leaves out the waiting count and last seen when there are none", () => {
    renderDetail({ group: group({ pendingCount: 0 }) });

    expect(screen.getByText("1 device")).toBeInTheDocument();
  });

  it("falls back to the user id", () => {
    renderDetail({ group: group({ user: { userId: "u-9" } }) });

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("u-9");
  });

  it("carries the user id for scroll targeting", () => {
    const { container } = renderDetail();
    expect(container.querySelector('[data-user-id="u-1"]')).not.toBeNull();
  });

  it("goes back to the approval queue", async () => {
    const { user, handlers } = renderDetail();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(handlers.onBack).toHaveBeenCalled();
  });

  it("opens the history", async () => {
    const { user, handlers } = renderDetail();

    await user.click(
      screen.getByTitle("Browse everything this user has streamed"),
    );

    expect(handlers.onShowHistory).toHaveBeenCalledWith("u-1");
  });

  it("hides a visible user from the more menu", async () => {
    const { user, handlers } = renderDetail();

    await user.click(screen.getByRole("button", { name: "More for alex" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Hide user" }),
    );

    expect(handlers.onToggleUserVisibility).toHaveBeenCalledWith("u-1");
  });

  it("pills the policies that reach any device", () => {
    renderDetail({
      group: group({
        devices: [device({ temporaryAccessUntil: FUTURE })],
      }),
      timeRules: [rule()],
    });

    expect(screen.getAllByText("Temporary access")).toHaveLength(2);
    expect(screen.getByText("Time schedule")).toBeInTheDocument();
  });

  it("shows no policy pills when nothing applies", () => {
    renderDetail();

    expect(screen.queryByText("Time schedule")).toBeNull();
    expect(screen.queryByText("Network access")).toBeNull();
  });
});

describe("UserDetail devices", () => {
  it("renders one row per device with its own policies", () => {
    renderDetail({
      group: group({
        devices: [
          device({ id: 1 }),
          device({ id: 2, deviceIdentifier: "device-2" }),
        ],
      }),
      timeRules: [rule({ deviceIdentifier: "device-2" })],
    });

    expect(screen.getByText("device-row:1:")).toBeInTheDocument();
    expect(screen.getByText("device-row:2:schedule")).toBeInTheDocument();
  });

  it("passes device actions through", async () => {
    const { user, handlers } = renderDetail();

    await user.click(screen.getByRole("button", { name: "approve 1" }));

    expect(handlers.onApprove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it("says when there are none", () => {
    renderDetail({ group: group({ devices: [], pendingCount: 0 }) });

    expect(
      screen.getByText(
        "No devices yet. They appear here the first time this user streams.",
      ),
    ).toBeInTheDocument();
  });
});

describe("UserDetail device updates", () => {
  it("passes row updates up to the parent", async () => {
    const { handlers } = renderDetail();
    const target = group().devices[0];

    await userEvent.click(screen.getByText(`update ${target.id}`));

    expect(handlers.onDeviceUpdate).toHaveBeenCalledWith(target);
  });
});

describe("UserDetail long device lists", () => {
  const devices = (count: number, overrides: Partial<UserDevice> = {}) =>
    Array.from({ length: count }, (_, index) =>
      device({
        id: index + 1,
        deviceIdentifier: `device-${index + 1}`,
        status: "approved",
        ...overrides,
      }),
    );

  const rows = () => screen.getAllByText(/^device-row:/);

  it("shows the first five and offers the rest", async () => {
    const { user } = renderDetail({ group: group({ devices: devices(9) }) });

    expect(rows()).toHaveLength(5);
    const toggle = screen.getByRole("button", { name: "Show all 9 devices" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(rows()).toHaveLength(9);
    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(rows()).toHaveLength(5);
  });

  it("does not hide just one or two devices", () => {
    renderDetail({ group: group({ devices: devices(7) }) });

    expect(rows()).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("never hides a device that is waiting for approval", () => {
    const list = devices(9);
    list[7] = { ...list[7], status: "pending" };
    renderDetail({ group: group({ devices: list }) });

    expect(rows()).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("reveals a hidden device another view points at", () => {
    const { rerenderWith } = renderDetail({
      group: group({ devices: devices(9) }),
    });
    expect(rows()).toHaveLength(5);

    rerenderWith({
      group: group({ devices: devices(9) }),
      deviceFocus: { deviceIdentifier: "device-8" },
    });

    expect(rows()).toHaveLength(9);
    expect(
      screen.getByRole("button", { name: "Show fewer" }),
    ).toBeInTheDocument();
  });

  it("stays collapsed when the focused device is already visible", () => {
    renderDetail({
      group: group({ devices: devices(9) }),
      deviceFocus: { deviceIdentifier: "device-2" },
    });

    expect(rows()).toHaveLength(5);
  });
});

describe("UserDetail rules", () => {
  it("explains that the rules cover every device", () => {
    renderDetail();
    expect(
      screen.getByText("These apply to every device this user owns."),
    ).toBeInTheDocument();
  });

  it.each([
    [null, "Global default"],
    [undefined, "Global default"],
    [0, "Unlimited"],
    [3, "3"],
  ])("reads a stream limit of %p as %s", (limit, label) => {
    renderDetail({ group: withPreference({ concurrentStreamLimit: limit }) });

    expect(ruleValue("Streams at once")).toBe(label);
  });

  it("reads a missing preference as the global stream limit", () => {
    renderDetail({ group: group({ user: { userId: "u-1" } }) });

    expect(ruleValue("Streams at once")).toBe("Global default");
    expect(ruleValue("Networks")).toBe("Anywhere");
  });

  it("counts devices left out of the stream limit", () => {
    renderDetail({
      group: group({
        devices: [
          device({ id: 1, excludeFromConcurrentLimit: true }),
          device({ id: 2, excludeFromConcurrentLimit: true }),
          device({ id: 3 }),
        ],
      }),
    });

    expect(ruleDescription("Streams at once")).toBe(
      "How many streams this user can run at the same time. 2 devices are not counted.",
    );
  });

  it("describes the stream limit when no device is left out", () => {
    renderDetail();

    expect(ruleDescription("Streams at once")).toBe(
      "How many streams this user can run at the same time",
    );
  });

  it("opens and closes the stream limit modal", async () => {
    const { user } = renderDetail();
    expect(screen.getByText("limit-modal:false")).toBeInTheDocument();

    await user.click(screen.getByText("Streams at once"));
    expect(screen.getByText("limit-modal:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close limit" }));
    expect(screen.getByText("limit-modal:false")).toBeInTheDocument();
  });

  it("reports a saved stream limit for the user", async () => {
    const { user, handlers } = renderDetail();

    await user.click(screen.getByRole("button", { name: "save limit" }));

    expect(handlers.onUserPreferenceChange).toHaveBeenCalledWith("u-1", {
      concurrentStreamLimit: 2,
    });
  });

  it("tolerates a saved stream limit with nobody listening", async () => {
    render(
      <UserDetail
        group={group()}
        actionLoading={null}
        {...makeHandlers()}
        onUserPreferenceChange={undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "save limit" }));

    expect(screen.getByText("limit-modal:false")).toBeInTheDocument();
  });

  it.each([
    [[], "None"],
    [[rule()], "1 rule"],
    [[rule({ id: 1 }), rule({ id: 2 })], "2 rules"],
    [[rule({ id: 1 }), rule({ id: 2, enabled: false })], "1 rule"],
  ])("counts enabled schedule rules %#", (rules, label) => {
    renderDetail({ timeRules: rules });

    expect(ruleValue("Schedule")).toBe(label);
  });

  it("reads no schedule when rules have not loaded", () => {
    renderDetail();
    expect(ruleValue("Schedule")).toBe("None");
  });

  it("opens the schedule", async () => {
    const { user, handlers } = renderDetail();

    await user.click(screen.getByText("Schedule"));

    expect(handlers.onShowTimePolicy).toHaveBeenCalledWith("u-1");
  });

  it.each([
    [{}, "Anywhere"],
    [{ networkPolicy: "lan" as const }, "Local network only"],
    [{ networkPolicy: "wan" as const }, "Internet only"],
    [
      { ipAccessPolicy: "restricted" as const, allowedIPs: ["10.0.0.1"] },
      "Any network, listed addresses",
    ],
    [
      {
        networkPolicy: "lan" as const,
        ipAccessPolicy: "restricted" as const,
        allowedIPs: ["10.0.0.1"],
      },
      "Local network only, listed addresses",
    ],
  ])("labels networks %p as %s", (overrides, label) => {
    renderDetail({ group: withPreference(overrides) });

    expect(ruleValue("Networks")).toBe(label);
  });

  it("opens the network modal and saves through it", async () => {
    const { user, handlers } = renderDetail();
    expect(screen.getByText("ip-modal:false")).toBeInTheDocument();

    await user.click(screen.getByText("Networks"));
    expect(screen.getByText("ip-modal:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "save ip" }));
    expect(handlers.onUpdateUserIPPolicy).toHaveBeenCalledWith("u-1", {
      networkPolicy: "lan",
    });

    await user.click(screen.getByRole("button", { name: "close ip" }));
    expect(screen.getByText("ip-modal:false")).toBeInTheDocument();
  });

  it("counts devices holding temporary access, Plexamp aside", () => {
    renderDetail({
      group: group({
        devices: [
          device({ id: 1, temporaryAccessUntil: FUTURE }),
          device({ id: 2, temporaryAccessUntil: FUTURE }),
          device({
            id: 3,
            temporaryAccessUntil: FUTURE,
            deviceProduct: "Plexamp",
          }),
          device({ id: 4, temporaryAccessUntil: "2000-01-01T00:00:00Z" }),
        ],
      }),
    });

    expect(ruleValue("Temporary access")).toBe("2 devices");
  });

  it("reads no temporary access as none", () => {
    renderDetail();
    expect(ruleValue("Temporary access")).toBe("None");
  });

  it("opens temporary access", async () => {
    const { user, handlers } = renderDetail();

    await user.click(screen.getByText("Temporary access"));

    expect(handlers.onGrantUserTemporaryAccess).toHaveBeenCalledWith("u-1");
  });
});

describe("UserDetail default device policy", () => {
  it.each([
    [/^Global/, null],
    [/^Allow$/, false],
    [/^Block$/, true],
  ] as const)("saves %s", async (name, expected) => {
    const { user, handlers } = renderDetail({
      group: withPreference({ defaultBlock: expected === null ? true : null }),
    });

    await user.click(screen.getByRole("button", { name }));

    expect(handlers.onUpdateUserPreference).toHaveBeenCalledWith(
      "u-1",
      expected,
    );
  });

  it("leaves the rule alone when its current choice is clicked again", async () => {
    const { user, handlers } = renderDetail({
      group: withPreference({ defaultBlock: true }),
    });

    await user.click(screen.getByRole("button", { name: /^Block$/ }));

    expect(handlers.onUpdateUserPreference).not.toHaveBeenCalled();
  });

  it.each([
    [true, "Global (Block)"],
    [false, "Global (Allow)"],
  ])("names a global default that blocks: %p", (blocks, label) => {
    getGlobalDefaultBlock.mockReturnValue(blocks);
    renderDetail();

    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });

  it("omits the global default while settings load", () => {
    configLoading = true;
    renderDetail();

    expect(screen.getByRole("button", { name: "Global" })).toBeInTheDocument();
  });

  it("selects the stored choice", () => {
    renderDetail({ group: withPreference({ defaultBlock: false }) });

    expect(pressed(/^Allow$/)).toBe("true");
    expect(pressed(/^Global/)).toBe("false");
  });

  it("shows one saving indicator while this user saves", () => {
    const { container } = renderDetail({ updatingUserPreference: "u-1" });

    expect(
      screen.getByLabelText("Saving the New devices rule"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-spin")).toHaveLength(1);
  });

  it("shows no saving indicator while another user saves", () => {
    renderDetail({ updatingUserPreference: "u-2" });

    expect(screen.queryByLabelText("Saving the New devices rule")).toBeNull();
  });

  it("moves the selection before the save comes back", async () => {
    const { user, rerenderWith } = renderDetail();

    await user.click(screen.getByRole("button", { name: /^Block$/ }));
    rerenderWith({ updatingUserPreference: "u-1" });

    expect(pressed(/^Block$/)).toBe("true");
    expect(pressed(/^Global/)).toBe("false");
  });

  it("falls back to the stored choice when the save fails", async () => {
    const { user, rerenderWith } = renderDetail();

    await user.click(screen.getByRole("button", { name: /^Block$/ }));
    rerenderWith({ updatingUserPreference: "u-1" });
    expect(pressed(/^Block$/)).toBe("true");

    rerenderWith({ updatingUserPreference: null });
    expect(pressed(/^Global/)).toBe("true");
    expect(pressed(/^Block$/)).toBe("false");
  });

  it("holds the new choice when a refresh lands on a different value mid-save", async () => {
    const { user, rerenderWith } = renderDetail();

    await user.click(screen.getByRole("button", { name: /^Block$/ }));
    rerenderWith({
      group: withPreference({ defaultBlock: false }),
      updatingUserPreference: "u-1",
    });

    expect(pressed(/^Block$/)).toBe("true");
    expect(pressed(/^Allow$/)).toBe("false");

    rerenderWith({
      group: withPreference({ defaultBlock: false }),
      updatingUserPreference: null,
    });
    expect(pressed(/^Allow$/)).toBe("true");
  });

  it("holds the new choice from the press through to the refreshed group", async () => {
    const { user, rerenderWith } = renderDetail();

    await user.click(screen.getByRole("button", { name: /^Block$/ }));
    expect(pressed(/^Block$/)).toBe("true");

    rerenderWith({
      group: withPreference({ defaultBlock: null }),
      updatingUserPreference: "u-1",
    });
    expect(pressed(/^Block$/)).toBe("true");

    rerenderWith({
      group: withPreference({ defaultBlock: true }),
      updatingUserPreference: "u-1",
    });
    expect(pressed(/^Block$/)).toBe("true");

    rerenderWith({
      group: withPreference({ defaultBlock: true }),
      updatingUserPreference: null,
    });
    expect(pressed(/^Block$/)).toBe("true");
    expect(pressed(/^Global/)).toBe("false");
  });
});
