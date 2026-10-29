import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "@/test-utils/query";
import type { AppSetting, UserDevice, UserPreference } from "@/types";
import { DeviceManagement } from "@/components/device-management";

const approveDevice = jest.fn();
const rejectDevice = jest.fn();
const deleteDevice = jest.fn();
const renameDevice = jest.fn();
const setPendingDevice = jest.fn();
const grantTemporaryAccess = jest.fn();
const grantBatchTemporaryAccess = jest.fn();
const revokeTemporaryAccess = jest.fn();

const render = renderWithQuery;

jest.mock("@/hooks/device-management/useDeviceActions", () => ({
  useDeviceActions: () => ({
    approveDevice,
    rejectDevice,
    deleteDevice,
    renameDevice,
    setPendingDevice,
    grantTemporaryAccess,
    grantBatchTemporaryAccess,
    revokeTemporaryAccess,
  }),
}));

const updateUserPreference = jest.fn();
const updateUserIPPolicy = jest.fn();
jest.mock("@/hooks/device-management/useUserPreferences", () => ({
  useUserPreferences: () => ({ updateUserPreference, updateUserIPPolicy }),
}));

const useTimeRulesForUsers = jest.fn<
  { data?: Record<string, unknown[]> },
  [string[]]
>();
jest.mock("@/hooks/device-management/useTimeRules", () => ({
  useTimeRulesForUsers: (userIds: string[]) => useTimeRulesForUsers(userIds),
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const toggleUserVisibility = jest.fn<Promise<unknown>, unknown[]>();
const getHiddenUsers = jest.fn<Promise<unknown>, unknown[]>();
jest.mock("@/lib/api", () => ({
  apiClient: {
    toggleUserVisibility: (...a: unknown[]) => toggleUserVisibility(...a),
    getHiddenUsers: (...a: unknown[]) => getHiddenUsers(...a),
  },
}));

const READ_AT = "2026-03-01T00:00:00Z";

type DetailProps = {
  group: {
    user: { userId: string; preference?: UserPreference };
    devices: UserDevice[];
  };
  timeRules?: { id: number }[];
  updatingUserPreference?: string | null;
  onBack: () => void;
  onUpdateUserPreference: (id: string, block: boolean | null) => void;
  onUpdateUserIPPolicy: (id: string, updates: unknown) => void;
  onUserPreferenceChange?: (
    id: string,
    changes: Partial<UserPreference>,
  ) => void;
  onToggleUserVisibility: (id: string) => void;
  onShowHistory: (id: string) => void;
  onGrantUserTemporaryAccess: (id: string) => void;
  onShowTimePolicy: (id: string, deviceIdentifier?: string) => void;
  onApprove: (d: UserDevice) => void;
  onReject: (d: UserDevice) => void;
  onDelete: (d: UserDevice) => void;
  onToggleApproval: (d: UserDevice) => void;
  onRemoveTemporaryAccess: (d: UserDevice) => void;
  onShowDetails: (d: UserDevice) => void;
  onDeviceUpdate?: (d: UserDevice) => void;
  deviceFocus?: { deviceIdentifier: string } | null;
};

jest.mock("@/components/device-management/UserDetail", () => ({
  UserDetail: ({
    group,
    timeRules,
    updatingUserPreference,
    onBack,
    onUpdateUserPreference,
    onUpdateUserIPPolicy,
    onUserPreferenceChange,
    onToggleUserVisibility,
    onShowHistory,
    onGrantUserTemporaryAccess,
    onShowTimePolicy,
    onApprove,
    onReject,
    onDelete,
    onToggleApproval,
    onRemoveTemporaryAccess,
    onShowDetails,
    onDeviceUpdate,
    deviceFocus,
  }: DetailProps) => {
    const id = group.user.userId;
    const device = group.devices[0];
    return (
      <div data-user-id={id}>
        <span>{`detail:${id}`}</span>
        <span>{`rules:${id}:${timeRules?.length ?? "none"}`}</span>
        <span>{`updating:${id}:${updatingUserPreference ?? "none"}`}</span>
        <span>{`focus:${id}:${deviceFocus?.deviceIdentifier ?? "none"}`}</span>
        <span>{`limit:${id}:${group.user.preference?.concurrentStreamLimit ?? "default"}`}</span>
        <button
          onClick={() =>
            onUserPreferenceChange?.(id, { concurrentStreamLimit: 2 })
          }
        >
          {`limit ${id}`}
        </button>
        {group.devices.map((d) => (
          <div key={d.id} data-device-identifier={d.deviceIdentifier} />
        ))}
        <button onClick={onBack}>{`back ${id}`}</button>
        <button onClick={() => onUpdateUserPreference(id, true)}>
          {`block ${id}`}
        </button>
        <button
          onClick={() => onUpdateUserIPPolicy(id, { networkPolicy: "lan" })}
        >
          {`ip ${id}`}
        </button>
        <button
          onClick={() => onToggleUserVisibility(id)}
        >{`hide ${id}`}</button>
        <button onClick={() => onShowHistory(id)}>{`history ${id}`}</button>
        <button
          onClick={() => onGrantUserTemporaryAccess(id)}
        >{`temp ${id}`}</button>
        <button onClick={() => onShowTimePolicy(id)}>{`schedule ${id}`}</button>
        {device && (
          <>
            <button onClick={() => onApprove(device)}>{`approve ${id}`}</button>
            <button onClick={() => onReject(device)}>{`reject ${id}`}</button>
            <button onClick={() => onDelete(device)}>{`delete ${id}`}</button>
            <button onClick={() => onToggleApproval(device)}>
              {`switch ${id}`}
            </button>
            <button onClick={() => onRemoveTemporaryAccess(device)}>
              {`revoke ${id}`}
            </button>
            <button onClick={() => onShowDetails(device)}>
              {`details ${id}`}
            </button>
            <span>{`note:${id}:${device.requestNoteReadAt ?? "unread"}`}</span>
            <button
              onClick={() =>
                onDeviceUpdate?.({ ...device, requestNoteReadAt: READ_AT })
              }
            >
              {`read note ${id}`}
            </button>
          </>
        )}
      </div>
    );
  },
}));

jest.mock("@/components/device-management/DeviceDetailsModal", () => ({
  DeviceDetailsModal: ({
    device,
    isOpen,
    onClose,
    onSetPending,
    onRename,
    onDeviceUpdate,
  }: {
    device: UserDevice | null;
    isOpen: boolean;
    onClose: () => void;
    onSetPending?: (id: number) => Promise<boolean>;
    onRename: (id: number, name: string) => void;
    onDeviceUpdate?: (d: UserDevice) => void;
  }) => (
    <div>
      <span>{`details-modal:${isOpen}:${device?.id ?? "none"}`}</span>
      <span>{`modal-note:${device?.requestNoteReadAt ?? "unread"}`}</span>
      <span>{`modal-exclude:${device?.excludeFromConcurrentLimit ? "yes" : "no"}`}</span>
      <button
        onClick={() =>
          device &&
          onDeviceUpdate?.({ ...device, excludeFromConcurrentLimit: true })
        }
      >
        exclude device
      </button>
      <button onClick={onClose}>close details</button>
      <button onClick={() => void onSetPending?.(device?.id ?? 0)}>
        set pending
      </button>
      <button onClick={() => onRename(device?.id ?? 0, "Renamed")}>
        rename device
      </button>
    </div>
  ),
}));

jest.mock("@/components/device-management/TemporaryAccessModal", () => ({
  TemporaryAccessModal: ({
    user,
    isOpen,
    onClose,
    onGrantAccess,
    canGrantTemporaryAccess,
    userDevices,
  }: {
    user: { userId: string } | null;
    isOpen: boolean;
    onClose: () => void;
    onGrantAccess: (ids: number[], minutes: number, bypass?: boolean) => void;
    canGrantTemporaryAccess: (d: UserDevice) => boolean;
    userDevices: UserDevice[];
  }) => (
    <div>
      <span>{`temp-modal:${isOpen}:${user?.userId ?? "none"}`}</span>
      <span>{`eligible:${userDevices
        .filter(canGrantTemporaryAccess)
        .map((d) => d.id)
        .join(",")}`}</span>
      <button onClick={onClose}>close temp</button>
      <button onClick={() => onGrantAccess([1], 60, true)}>grant temp</button>
      <button onClick={() => onGrantAccess([1, 2], 120, false)}>
        grant many
      </button>
    </div>
  ),
}));

jest.mock("@/components/device-management/ConfirmationModal", () => ({
  ConfirmationModal: ({
    confirmAction,
    onConfirm,
    onCancel,
  }: {
    confirmAction: { action: string } | null;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    confirmAction ? (
      <div>
        <span>{`confirm:${confirmAction.action}`}</span>
        <button onClick={() => onConfirm()}>do it</button>
        <button onClick={() => onCancel()}>never mind</button>
      </div>
    ) : null,
}));

jest.mock("@/components/device-management/UserHistoryModal", () => ({
  UserHistoryModal: ({
    userId,
    isOpen,
    onClose,
    onNavigateToDevice,
  }: {
    userId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  }) => (
    <div>
      <span>{`history-modal:${isOpen}:${userId ?? "none"}`}</span>
      <button onClick={onClose}>close history</button>
      <button onClick={() => onNavigateToDevice?.("u-1", "device-1")}>
        history to device
      </button>
    </div>
  ),
}));

jest.mock("@/components/device-management/TimeRuleModal", () => ({
  TimeRuleModal: ({
    isOpen,
    userId,
    onClose,
  }: {
    isOpen: boolean;
    userId: string;
    onClose: () => void;
  }) => (
    <div>
      <span>{`time-modal:${isOpen}:${userId}`}</span>
      <button onClick={onClose}>close schedule</button>
    </div>
  ),
}));

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  username: "alex",
  deviceIdentifier: "device-1",
  deviceName: "TV",
  devicePlatform: "Roku",
  deviceProduct: "Plex for Roku",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-02-01T00:00:00Z",
  sessionCount: 3,
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

const devicesData = (all: UserDevice[]) => ({
  all,
  processed: all,
  pending: all.filter((d) => d.status === "pending"),
  approved: all.filter((d) => d.status === "approved"),
});

type User = ReturnType<typeof userEvent.setup>;

const renderPanel = async (
  props: {
    devices?: UserDevice[];
    users?: UserPreference[];
    settings?: AppSetting[];
    navigationTarget?: { userId: string; deviceIdentifier: string } | null;
    selectedUserId?: string | null;
    onSelectUser?: (userId: string | null) => void;
  } = {},
) => {
  const onRefresh = jest.fn();
  const onNavigationComplete = jest.fn();
  const view = render(
    <DeviceManagement
      devicesData={devicesData(props.devices ?? [device()])}
      usersData={props.users ?? [preference()]}
      settingsData={props.settings}
      onRefresh={onRefresh}
      navigationTarget={props.navigationTarget}
      onNavigationComplete={onNavigationComplete}
      selectedUserId={props.selectedUserId}
      onSelectUser={props.onSelectUser}
    />,
  );
  await act(async () => {});
  return {
    ...view,
    onRefresh,
    onNavigationComplete,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

const userList = () => {
  const list = screen.getByRole("button", { name: "Hidden users" })
    .parentElement?.parentElement;
  if (!list) throw new Error("user list not rendered");
  return list;
};

const listedUsers = () =>
  within(userList())
    .queryAllByRole("listitem")
    .map((item) => item.querySelector("span.block")?.textContent);

const openUser = async (user: User, name = "alex") => {
  await user.click(within(userList()).getByText(name));
};

const renderSelected = async (
  props: Parameters<typeof renderPanel>[0] = {},
) => {
  const view = await renderPanel(props);
  await openUser(view.user);
  return view;
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  localStorage.clear();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  useTimeRulesForUsers.mockReturnValue({ data: {} });
  approveDevice.mockResolvedValue(true);
  rejectDevice.mockResolvedValue(true);
  deleteDevice.mockResolvedValue(true);
  renameDevice.mockResolvedValue(true);
  setPendingDevice.mockResolvedValue(true);
  grantTemporaryAccess.mockResolvedValue(true);
  grantBatchTemporaryAccess.mockResolvedValue({ success: true, results: [] });
  revokeTemporaryAccess.mockResolvedValue(true);
  updateUserPreference.mockResolvedValue(true);
  updateUserIPPolicy.mockResolvedValue(true);
  toggleUserVisibility.mockResolvedValue(undefined);
  getHiddenUsers.mockResolvedValue([]);
});

afterEach(() => consoleError.mockRestore());

const twoUsers = {
  devices: [
    device({ id: 1, userId: "u-1", username: "alex", deviceName: "TV" }),
    device({
      id: 2,
      userId: "u-2",
      username: "sam",
      deviceIdentifier: "device-2",
      deviceName: "Phone",
      devicePlatform: "Android",
      deviceProduct: "Plexamp",
      status: "rejected",
      sessionCount: 9,
    }),
  ],
  users: [preference({ userId: "u-1" }), preference({ id: 2, userId: "u-2" })],
};

describe("DeviceManagement page header", () => {
  it("titles the page", async () => {
    await renderPanel(twoUsers);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Users",
    );
  });

  it("shows skeletons before any data arrives", () => {
    const { container } = render(<DeviceManagement />);

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});

describe("DeviceManagement grouping", () => {
  it("lists one row per user", async () => {
    await renderPanel(twoUsers);

    expect(listedUsers()).toEqual(expect.arrayContaining(["alex", "sam"]));
    expect(listedUsers()).toHaveLength(2);
  });

  it("keeps Plexamp devices out of the waiting count", async () => {
    await renderPanel({
      devices: [
        device({ id: 1, status: "pending" }),
        device({
          id: 2,
          status: "pending",
          deviceIdentifier: "d-2",
          deviceProduct: "Plexamp",
        }),
      ],
    });

    expect(
      screen.getByText("Approval queue").closest("button"),
    ).toHaveTextContent(/1 waiting$/);
  });

  it("leaves out users whose preference marks them hidden", async () => {
    await renderPanel({
      devices: [device({ userId: "u-1" })],
      users: [preference({ userId: "u-1", hidden: true })],
    });

    expect(listedUsers()).toEqual([]);
    expect(
      screen.getByText(
        "No users yet. They appear here the first time they stream.",
      ),
    ).toBeInTheDocument();
  });

  it("hands the selected user's time rules to the detail pane", async () => {
    useTimeRulesForUsers.mockReturnValue({
      data: { "u-1": [{ id: 1, userId: "u-1", enabled: true, dayOfWeek: 1 }] },
    });
    await renderSelected();

    expect(screen.getByText("rules:u-1:1")).toBeInTheDocument();
  });

  it("asks for the time rules of every listed user", async () => {
    await renderPanel();

    expect(useTimeRulesForUsers).toHaveBeenLastCalledWith(["u-1"]);
  });

  it("shows no rules for a user the overview has not loaded", async () => {
    useTimeRulesForUsers.mockReturnValue({ data: undefined });
    await renderSelected();

    expect(screen.getByText("rules:u-1:none")).toBeInTheDocument();
  });
});

describe("DeviceManagement user list", () => {
  it.each([
    ["sam", "sam"],
    ["Phone", "sam"],
    ["Android", "sam"],
    ["Plexamp", "sam"],
    ["alex", "alex"],
  ])("matches %p", async (term, expected) => {
    const { user } = await renderPanel(twoUsers);

    await user.type(screen.getByRole("searchbox"), term);

    await waitFor(() => expect(listedUsers()).toEqual([expected]));
  });

  it("says when nothing matches", async () => {
    const { user } = await renderPanel(twoUsers);

    await user.type(
      screen.getByPlaceholderText("Search by user or device"),
      "zzz",
    );

    expect(await screen.findByText("No users match")).toBeInTheDocument();
  });

  it("falls back to the user id when there is no username", async () => {
    const { user } = await renderPanel({
      devices: [device({ userId: "u-42", username: undefined })],
      users: [preference({ userId: "u-42" })],
    });

    await user.type(screen.getByRole("searchbox"), "u-42");

    expect(listedUsers()).toEqual(["u-42"]);
  });

  it.each([
    [/^All/, ["alex", "sam"]],
    [/^Waiting/, ["alex"]],
    [/^Blocked/, ["sam"]],
  ])("filters with the %s chip", async (chip, expected) => {
    const { user } = await renderPanel(twoUsers);

    await user.click(screen.getByRole("button", { name: chip }));

    expect(screen.getByRole("button", { name: chip })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(listedUsers().sort()).toEqual(expected);
  });

  it("labels the chips without counts", async () => {
    await renderPanel(twoUsers);

    for (const name of ["All", "Waiting", "Blocked"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("says no users match when a chip filters everyone out", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /^Blocked/ }));

    expect(screen.getByText("No users match")).toBeInTheDocument();
  });

  it.each([
    ["Device count", "deviceCount"],
    ["Pending count", "pendingCount"],
    ["Last stream", "lastSeen"],
    ["Stream count", "streamCount"],
    ["Username", "username"],
  ])("sorts by %s and remembers it", async (label, stored) => {
    const { user } = await renderPanel(twoUsers);

    await user.click(screen.getByRole("button", { name: "Sort users" }));
    await user.click(await screen.findByRole("menuitem", { name: label }));

    await waitFor(() =>
      expect(localStorage.getItem("guardian-unified-sort-by")).toBe(stored),
    );
    expect(screen.getByRole("button", { name: "Sort users" })).toHaveAttribute(
      "title",
      `Sorted by ${label.toLowerCase()}`,
    );
  });

  it("remembers the sort order", async () => {
    const { user } = await renderPanel(twoUsers);
    expect(localStorage.getItem("guardian-unified-sort-order")).toBe("desc");

    await user.click(screen.getByRole("button", { name: "Sort users" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Ascending" }),
    );

    await waitFor(() =>
      expect(localStorage.getItem("guardian-unified-sort-order")).toBe("asc"),
    );
  });
});

describe("DeviceManagement selection", () => {
  it("shows the approval queue in both layouts until a user is picked", async () => {
    await renderPanel();

    expect(screen.getAllByText("Waiting for approval")).toHaveLength(2);
    expect(screen.queryByText(/^detail:/)).toBeNull();
  });

  it("opens the user picked from the list", async () => {
    const { user } = await renderPanel(twoUsers);

    await openUser(user, "sam");

    expect(screen.getByText("detail:u-2")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for approval")).toBeNull();
    expect(
      within(userList()).getByText("sam").closest("button"),
    ).toHaveAttribute("aria-current", "true");
  });

  it("opens a user from the approval queue", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getAllByTitle("Show in alex")[0]);

    expect(screen.getByText("detail:u-1")).toBeInTheDocument();
  });

  it("asks before approving from the queue", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(screen.getByText("confirm:approve")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(approveDevice).toHaveBeenCalledWith(1));
  });

  it("asks before rejecting from the queue", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getAllByRole("button", { name: "Reject" })[0]);

    expect(screen.getByText("confirm:reject")).toBeInTheDocument();
  });

  it("goes back to the queue", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "back u-1" }));

    expect(screen.queryByText("detail:u-1")).toBeNull();
    expect(screen.getAllByText("Waiting for approval")).toHaveLength(2);
  });

  it("reports selection to a parent that controls it", async () => {
    const onSelectUser = jest.fn();
    const { user } = await renderPanel({
      ...twoUsers,
      selectedUserId: "u-1",
      onSelectUser,
    });
    expect(screen.getByText("detail:u-1")).toBeInTheDocument();

    await openUser(user, "sam");

    expect(onSelectUser).toHaveBeenCalledWith("u-2");
    expect(screen.getByText("detail:u-1")).toBeInTheDocument();
  });

  it("tells a controlling parent when the user goes back", async () => {
    const onSelectUser = jest.fn();
    const { user } = await renderPanel({ selectedUserId: "u-1", onSelectUser });

    await user.click(screen.getByRole("button", { name: "back u-1" }));

    expect(onSelectUser).toHaveBeenCalledWith(null);
  });

  it("explains when the selected user is not in the list", async () => {
    const onSelectUser = jest.fn();
    const { user } = await renderPanel({
      selectedUserId: "u-missing",
      onSelectUser,
    });

    expect(
      screen.getByText("This user is not in the list"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to all users" }));

    expect(onSelectUser).toHaveBeenCalledWith(null);
  });

  it("shows the detail skeleton while a selected user loads", () => {
    const { container } = render(<DeviceManagement selectedUserId="u-1" />);

    expect(screen.queryByText("This user is not in the list")).toBeNull();
    expect(container.querySelector(".h-64.animate-pulse")).not.toBeNull();
  });
});

describe("DeviceManagement refresh controls", () => {
  it("keeps the current time rules on screen while refreshing", async () => {
    useTimeRulesForUsers.mockReturnValue({
      data: { "u-1": [{ id: 1, userId: "u-1", enabled: true, dayOfWeek: 1 }] },
    });
    const { user, onRefresh } = await renderSelected();
    await waitFor(() =>
      expect(screen.getByText("rules:u-1:1")).toBeInTheDocument(),
    );
    onRefresh.mockReturnValue(new Promise(() => {}));

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(onRefresh).toHaveBeenCalled();
    expect(screen.getByText("rules:u-1:1")).toBeInTheDocument();
  });

  it("refreshes", async () => {
    const { user, onRefresh } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it("logs a refresh that fails instead of leaving the button spinning", async () => {
    const { user, onRefresh } = await renderPanel();
    onRefresh.mockRejectedValue(new Error("offline"));

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to refresh:",
        expect.any(Error),
      ),
    );
    expect(screen.getByRole("button", { name: /Refresh/ })).toBeEnabled();
  });
});

describe("DeviceManagement device actions", () => {
  it.each([
    ["approve u-1", "approve", () => approveDevice],
    ["reject u-1", "reject", () => rejectDevice],
    ["delete u-1", "delete", () => deleteDevice],
    ["switch u-1", "toggle", () => approveDevice],
  ] as const)("confirms then runs %s", async (trigger, action, getMock) => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: trigger }));
    expect(screen.getByText(`confirm:${action}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(getMock()).toHaveBeenCalledWith(1));
  });

  it("can be abandoned", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "approve u-1" }));
    await user.click(screen.getByRole("button", { name: "never mind" }));

    expect(screen.queryByText(/^confirm:/)).toBeNull();
    expect(approveDevice).not.toHaveBeenCalled();
  });

  it("rejects an approved device through the toggle", async () => {
    const { user } = await renderSelected({
      devices: [device({ status: "approved" })],
    });

    await user.click(screen.getByRole("button", { name: "switch u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(rejectDevice).toHaveBeenCalledWith(1));
  });

  it("stays quiet when an action reports failure", async () => {
    approveDevice.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "approve u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(approveDevice).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it("refreshes shortly after a successful action", async () => {
    const { user, onRefresh } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "approve u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("asks before removing temporary access", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "revoke u-1" }));

    expect(
      screen.getByText("confirm:removeTemporaryAccess"),
    ).toBeInTheDocument();
    expect(revokeTemporaryAccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(revokeTemporaryAccess).toHaveBeenCalledWith(1));
  });

  it("leaves temporary access alone when the confirmation is dismissed", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "revoke u-1" }));
    await user.click(screen.getByRole("button", { name: "never mind" }));

    expect(screen.queryByText(/^confirm:/)).toBeNull();
    expect(revokeTemporaryAccess).not.toHaveBeenCalled();
  });

  it("reports a revoke failure", async () => {
    revokeTemporaryAccess.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "revoke u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(revokeTemporaryAccess).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("DeviceManagement details modal", () => {
  it("opens and closes", async () => {
    const { user } = await renderSelected();
    expect(screen.getByText("details-modal:false:none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    expect(screen.getByText("details-modal:true:1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close details" }));
    expect(screen.getByText("details-modal:false:none")).toBeInTheDocument();
  });

  it("renames a device", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() =>
      expect(renameDevice).toHaveBeenCalledWith(1, "Renamed"),
    );
  });

  it("reports a rename failure", async () => {
    renameDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() =>
      expect(renameDevice).toHaveBeenCalledWith(0, "Renamed"),
    );
  });

  it("sets a device back to pending and closes the modal", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "set pending" }));

    await waitFor(() => expect(setPendingDevice).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(screen.getByText("details-modal:false:none")).toBeInTheDocument(),
    );
  });
});

describe("DeviceManagement user actions", () => {
  it("updates a default policy", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(updateUserPreference).toHaveBeenCalledWith("u-1", true),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Default device policy updated" }),
    );
  });

  it("keeps the saving flag up until the refreshed data lands", async () => {
    let release: () => void = () => {};
    const { user, onRefresh } = await renderSelected();
    onRefresh.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(screen.getByText("updating:u-1:u-1")).toBeInTheDocument();

    await act(async () => {
      release();
    });

    expect(screen.getByText("updating:u-1:none")).toBeInTheDocument();
  });

  it("drops the saving flag when the save itself fails", async () => {
    updateUserPreference.mockResolvedValue(false);
    const { user, onRefresh } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(screen.getByText("updating:u-1:none")).toBeInTheDocument(),
    );
    expect(onRefresh).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Update failed" }),
    );
  });

  it("shows a new stream limit on the row before the refresh lands", async () => {
    const { user, onRefresh } = await renderSelected();
    onRefresh.mockReturnValue(new Promise(() => {}));
    expect(screen.getByText("limit:u-1:default")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "limit u-1" }));

    expect(screen.getByText("limit:u-1:2")).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalled();
  });

  it("updates an IP policy and refreshes", async () => {
    const { user, onRefresh } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "ip u-1" }));

    await waitFor(() =>
      expect(updateUserIPPolicy).toHaveBeenCalledWith("u-1", {
        networkPolicy: "lan",
      }),
    );
    expect(onRefresh).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "IP access updated" }),
    );
  });

  it("reports a failed IP policy update", async () => {
    updateUserIPPolicy.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "ip u-1" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to update the IP access policies",
        }),
      ),
    );
  });

  it("opens and closes the history modal", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "history u-1" }));
    expect(screen.getByText("history-modal:true:u-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close history" }));
    expect(screen.getByText("history-modal:false:none")).toBeInTheDocument();
  });

  it("opens the schedule modal", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "schedule u-1" }));

    expect(screen.getByText("time-modal:true:u-1")).toBeInTheDocument();
  });

  it("closes the schedule modal", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "schedule u-1" }));
    await user.click(screen.getByRole("button", { name: "close schedule" }));

    expect(screen.getByText("time-modal:false:")).toBeInTheDocument();
  });
});

describe("DeviceManagement temporary access", () => {
  it("opens the modal for a user and closes it", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    expect(screen.getByText("temp-modal:true:u-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close temp" }));
    expect(screen.getByText("temp-modal:false:none")).toBeInTheDocument();
  });

  it("uses the single-device call for one device", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant temp" }));

    await waitFor(() =>
      expect(grantTemporaryAccess).toHaveBeenCalledWith(1, 60, true),
    );
    expect(grantBatchTemporaryAccess).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("temp-modal:false:none")).toBeInTheDocument(),
    );
  });

  it("reports a single-device failure", async () => {
    grantTemporaryAccess.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant temp" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to grant temporary access",
        }),
      ),
    );
    expect(screen.getByText("temp-modal:true:u-1")).toBeInTheDocument();
  });

  it("uses the batch call for several devices", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant many" }));

    await waitFor(() =>
      expect(grantBatchTemporaryAccess).toHaveBeenCalledWith(
        [1, 2],
        120,
        false,
      ),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Temporary access granted" }),
    );
  });

  it("reports partial failures", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({
      success: true,
      results: [{ success: true }, { success: false }],
    });
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant many" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Some devices were not granted access",
        }),
      ),
    );
  });

  it("reports a batch failure", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({ success: false });
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant many" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to grant temporary access to these devices",
        }),
      ),
    );
  });

  describe("eligibility", () => {
    const eligible = async (props: Parameters<typeof renderPanel>[0]) => {
      const { user } = await renderSelected(props);
      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      return screen.getByText(/^eligible:/).textContent;
    };

    it("excludes Plexamp devices", async () => {
      expect(
        await eligible({ devices: [device({ deviceProduct: "Plexamp" })] }),
      ).toBe("eligible:");
    });

    it("excludes approved devices", async () => {
      expect(
        await eligible({ devices: [device({ status: "approved" })] }),
      ).toBe("eligible:");
    });

    it("always includes rejected devices", async () => {
      expect(
        await eligible({
          devices: [device({ status: "rejected" })],
          users: [preference({ defaultBlock: false })],
        }),
      ).toBe("eligible:1");
    });

    it("excludes pending devices for a user set to allow", async () => {
      expect(
        await eligible({ users: [preference({ defaultBlock: false })] }),
      ).toBe("eligible:");
    });

    it("includes pending devices for a user set to block", async () => {
      expect(
        await eligible({ users: [preference({ defaultBlock: true })] }),
      ).toBe("eligible:1");
    });

    it("includes pending devices for a user with no preference", async () => {
      expect(await eligible({ users: [] })).toBe("eligible:1");
    });

    it("defers to a global allow default", async () => {
      expect(
        await eligible({
          settings: [
            { key: "PLEX_GUARD_DEFAULT_BLOCK", value: "false" } as AppSetting,
          ],
        }),
      ).toBe("eligible:");
    });

    it("defers to a global block default", async () => {
      expect(
        await eligible({
          settings: [
            { key: "PLEX_GUARD_DEFAULT_BLOCK", value: "true" } as AppSetting,
          ],
        }),
      ).toBe("eligible:1");
    });
  });
});

describe("DeviceManagement hidden users", () => {
  const openHidden = async (user: User) => {
    await user.click(screen.getByRole("button", { name: "Hidden users" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).queryByText("Loading hidden users...")).toBeNull(),
    );
    return dialog;
  };

  it("asks before hiding a user", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));

    expect(await screen.findByText("Hide user?")).toBeInTheDocument();
    expect(
      screen.getByText(/show them again from "Hidden users"/),
    ).toBeInTheDocument();
    expect(toggleUserVisibility).not.toHaveBeenCalled();
  });

  it("hides the user once the warning is confirmed", async () => {
    const { user, onRefresh } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: /Hide user/ }));

    await waitFor(() =>
      expect(toggleUserVisibility).toHaveBeenCalledWith("u-1"),
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it("closes the user it just hid", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: /Hide user/ }));

    await waitFor(() => expect(screen.queryByText("detail:u-1")).toBeNull());
  });

  it("cancels the hide warning", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(toggleUserVisibility).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Hide user?")).toBeNull());
  });

  it("reports a failure hiding a user", async () => {
    toggleUserVisibility.mockRejectedValue(new Error("offline"));
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: /Hide user/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("lists hidden users", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: "robin", hidden: true }),
    ]);
    const { user } = await renderPanel();

    const dialog = await openHidden(user);

    expect(within(dialog).getByText("Hidden users")).toBeInTheDocument();
    expect(within(dialog).getByText("robin")).toBeInTheDocument();
  });

  it("says when nobody is hidden and closes", async () => {
    const { user } = await renderPanel();

    const dialog = await openHidden(user);
    expect(
      within(dialog).getByText("No hidden users found"),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(screen.queryByText("No hidden users found")).toBeNull(),
    );
  });

  it("names an unnamed hidden user", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: undefined, hidden: true }),
    ]);
    const { user } = await renderPanel();

    const dialog = await openHidden(user);

    expect(within(dialog).getByText("Unknown username")).toBeInTheDocument();
  });

  it("shows a hidden user again from the dialog", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: "robin", hidden: true }),
    ]);
    const { user } = await renderPanel();

    const dialog = await openHidden(user);
    await user.click(within(dialog).getByRole("button", { name: /Show$/ }));

    await waitFor(() =>
      expect(toggleUserVisibility).toHaveBeenCalledWith("u-9"),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "User shown" }),
    );
  });

  it("says the hidden users are loading", async () => {
    getHiddenUsers.mockReturnValue(new Promise(() => {}));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));

    expect(
      await screen.findByText("Loading hidden users..."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No hidden users found")).toBeNull();
  });

  it("drops a user from the list once they are shown again", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: "robin", hidden: true }),
    ]);
    const { user } = await renderPanel();
    const dialog = await openHidden(user);
    getHiddenUsers.mockResolvedValue([]);

    await user.click(within(dialog).getByRole("button", { name: /Show$/ }));

    expect(
      await within(dialog).findByText("No hidden users found"),
    ).toBeInTheDocument();
    expect(getHiddenUsers).toHaveBeenCalledTimes(2);
  });

  it("only loads hidden users once the dialog is opened", async () => {
    await renderPanel();

    expect(getHiddenUsers).not.toHaveBeenCalled();
  });

  it("shows the last hidden users at once when the dialog reopens", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: "robin", hidden: true }),
    ]);
    const { user } = await renderPanel();
    let dialog = await openHidden(user);
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    getHiddenUsers.mockReturnValue(new Promise(() => {}));

    await user.click(screen.getByRole("button", { name: "Hidden users" }));
    dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("robin")).toBeInTheDocument();
  });

  it("logs a failure loading hidden users", async () => {
    getHiddenUsers.mockRejectedValue(new Error("offline"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Request failed:",
        ["users", "hidden"],
        expect.any(Error),
      ),
    );
  });
});

describe("DeviceManagement navigation", () => {
  const scrollIntoView = jest.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  const renderWithTarget = async (
    navigationTarget: { userId: string; deviceIdentifier: string } | null,
    devices: UserDevice[] = [device()],
  ) => {
    jest.useFakeTimers();
    const onNavigationComplete = jest.fn();
    render(
      <DeviceManagement
        devicesData={devicesData(devices)}
        usersData={[preference()]}
        navigationTarget={navigationTarget}
        onNavigationComplete={onNavigationComplete}
      />,
    );
    await act(async () => {});
    return { onNavigationComplete };
  };

  it("selects the target user, then highlights the device", async () => {
    const { onNavigationComplete } = await renderWithTarget({
      userId: "u-1",
      deviceIdentifier: "device-1",
    });

    expect(screen.getByText("detail:u-1")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(scrollIntoView).toHaveBeenCalled();

    const target = document.querySelector(
      '[data-device-identifier="device-1"]',
    );
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(target).toHaveClass("ring-2", "ring-info");

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(target).not.toHaveClass("ring-2");
    expect(onNavigationComplete).toHaveBeenCalled();
  });

  it("highlights a device whose identifier has quotes in it", async () => {
    const identifier = 'tv "den" \\ 2';
    await renderWithTarget({ userId: "u-1", deviceIdentifier: identifier }, [
      device({ deviceIdentifier: identifier }),
    ]);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-device-identifier]"),
    ).find((element) => element.dataset.deviceIdentifier === identifier);
    expect(target).toHaveClass("ring-2", "ring-info");
  });

  it("highlights a device picked from the approval queue", async () => {
    await renderWithTarget(null);

    fireEvent.click(screen.getAllByTitle("Show in alex")[0]);
    expect(screen.getByText("detail:u-1")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(600);
    });
    const target = document.querySelector(
      '[data-device-identifier="device-1"]',
    );
    expect(scrollIntoView).toHaveBeenCalled();
    expect(target).toHaveClass("ring-2", "ring-info");

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(target).not.toHaveClass("ring-2");
  });

  it("forgets the highlighted device once the user is left", async () => {
    await renderWithTarget(null);

    fireEvent.click(screen.getAllByTitle("Show in alex")[0]);
    expect(screen.getByText("focus:u-1:device-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("back u-1"));
    fireEvent.click(screen.getAllByRole("button", { name: /alex/ })[0]);

    expect(screen.getByText("focus:u-1:none")).toBeInTheDocument();
  });

  it("does nothing without a target", async () => {
    await renderWithTarget(null);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.queryByText(/^detail:/)).toBeNull();
  });

  it("gives up on a device that never appears and clears the target", async () => {
    const { onNavigationComplete } = await renderWithTarget({
      userId: "u-1",
      deviceIdentifier: "missing-device",
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onNavigationComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onNavigationComplete).toHaveBeenCalledTimes(1);
  });

  it("waits for a device that renders late", async () => {
    jest.useFakeTimers();
    const onNavigationComplete = jest.fn();
    const target = { userId: "u-1", deviceIdentifier: "device-2" };
    const { rerender } = render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        navigationTarget={target}
        onNavigationComplete={onNavigationComplete}
      />,
    );
    await act(async () => {});

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <DeviceManagement
        devicesData={devicesData([
          device(),
          device({ id: 2, deviceIdentifier: "device-2" }),
        ])}
        usersData={[preference()]}
        navigationTarget={target}
        onNavigationComplete={onNavigationComplete}
      />,
    );
    await act(async () => {});
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("selects the user when jumping from the history modal", async () => {
    jest.useRealTimers();
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "history to device" }));

    expect(screen.getByText("detail:u-1")).toBeInTheDocument();
  });

  it("asks a controlling parent to select the history user", async () => {
    jest.useRealTimers();
    const onSelectUser = jest.fn();
    const { user } = await renderPanel({ onSelectUser, selectedUserId: null });

    await user.click(screen.getByRole("button", { name: "history to device" }));

    expect(onSelectUser).toHaveBeenCalledWith("u-1");
  });
});

describe("DeviceManagement without callbacks", () => {
  it("renders and refreshes with no parent handlers", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
      />,
    );
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(listedUsers()).toEqual(["alex"]);
  });
});

describe("DeviceManagement device updates", () => {
  it("shows a note read from the row in the open details right away", async () => {
    const { user } = await renderSelected({
      devices: [
        device({
          requestDescription: "Please let me in",
          requestSubmittedAt: "2026-02-01T00:00:00Z",
        }),
      ],
    });

    await user.click(screen.getByText("details u-1"));
    await user.click(screen.getByText("read note u-1"));

    expect(screen.getByText(`modal-note:${READ_AT}`)).toBeInTheDocument();
    expect(screen.getByText(`note:u-1:${READ_AT}`)).toBeInTheDocument();
  });

  it("keeps the list in step with changes made in the details", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByText("details u-1"));
    await user.click(screen.getByText("exclude device"));
    await user.click(screen.getByText("close details"));
    await user.click(screen.getByText("details u-1"));

    expect(screen.getByText("details-modal:true:1")).toBeInTheDocument();
    expect(screen.getByText("modal-exclude:yes")).toBeInTheDocument();
  });

  it("leaves a closed details modal closed", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByText("read note u-1"));

    expect(screen.getByText("details-modal:false:none")).toBeInTheDocument();
    expect(screen.getByText(`note:u-1:${READ_AT}`)).toBeInTheDocument();
  });
});
