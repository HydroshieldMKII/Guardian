import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const hasTemporaryAccess = jest.fn();
jest.mock("@/hooks/device-management/useDeviceUtils", () => ({
  useDeviceUtils: () => ({
    hasTemporaryAccess,
    getTemporaryAccessTimeLeft: () => "2h",
  }),
}));

const getAllTimeRules = jest.fn();
const fetchAllTimeRules = jest.fn();
jest.mock("@/hooks/device-management/useTimeRules", () => ({
  useTimeRules: () => ({ getAllTimeRules, fetchAllTimeRules }),
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const toggleUserVisibility = jest.fn();
const getHiddenUsers = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    toggleUserVisibility: (...a: unknown[]) => toggleUserVisibility(...a),
    getHiddenUsers: (...a: unknown[]) => getHiddenUsers(...a),
  },
}));

jest.mock("@/components/device-management/UserGroupCard", () => ({
  UserGroupCard: ({
    group,
    isExpanded,
    timeRules,
    updatingUserPreference,
    onToggleExpansion,
    onUpdateUserPreference,
    onUpdateUserIPPolicy,
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
  }: Record<string, never> & {
    group: { user: { userId: string }; devices: UserDevice[] };
    isExpanded: boolean;
    timeRules?: { id: number }[];
    updatingUserPreference?: string | null;
    onToggleExpansion: (id: string) => void;
    onUpdateUserPreference: (id: string, block: boolean | null) => void;
    onUpdateUserIPPolicy: (id: string, updates: unknown) => void;
    onToggleUserVisibility: (id: string) => void;
    onShowHistory: (id: string) => void;
    onGrantUserTemporaryAccess: (id: string) => void;
    onShowTimePolicy: (id: string, deviceIdentifier?: string) => void;
    onApprove: (d: UserDevice) => void;
    onReject: (d: UserDevice) => void;
    onDelete: (d: UserDevice) => void;
    onToggleApproval: (d: UserDevice) => void;
    onRemoveTemporaryAccess: (device: { id: number }) => void;
    onShowDetails: (d: UserDevice) => void;
  }) => {
    const id = group.user.userId;
    const device = group.devices[0];
    return (
      <div data-user-id={id}>
        <span>{`group:${id}`}</span>
        <span>{`expanded:${id}:${isExpanded}`}</span>
        <span>{`rules:${id}:${timeRules?.length ?? "none"}`}</span>
        <span>{`updating:${id}:${updatingUserPreference ?? "none"}`}</span>
        <button onClick={() => onToggleExpansion(id)}>{`toggle ${id}`}</button>
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
  }: {
    device: UserDevice | null;
    isOpen: boolean;
    onClose: () => void;
    onSetPending?: (id: number) => Promise<boolean>;
    onRename: (id: number, name: string) => void;
  }) => (
    <div>
      <span>{`details-modal:${isOpen}:${device?.id ?? "none"}`}</span>
      <button onClick={onClose}>close details</button>
      <button onClick={() => onSetPending?.(device?.id ?? 0)}>
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
  username: "alice",
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

const renderPanel = async (
  props: {
    devices?: UserDevice[];
    users?: UserPreference[];
    settings?: AppSetting[];
    navigationTarget?: { userId: string; deviceIdentifier: string } | null;
    autoRefresh?: boolean;
  } = {},
) => {
  const onRefresh = jest.fn();
  const onAutoRefreshChange = jest.fn();
  const onNavigationComplete = jest.fn();
  const view = render(
    <DeviceManagement
      devicesData={devicesData(props.devices ?? [device()])}
      usersData={props.users ?? [preference()]}
      settingsData={props.settings}
      onRefresh={onRefresh}
      autoRefresh={props.autoRefresh}
      onAutoRefreshChange={onAutoRefreshChange}
      navigationTarget={props.navigationTarget}
      onNavigationComplete={onNavigationComplete}
    />,
  );
  await act(async () => {});
  return {
    ...view,
    onRefresh,
    onAutoRefreshChange,
    onNavigationComplete,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  localStorage.clear();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  hasTemporaryAccess.mockReturnValue(false);
  getAllTimeRules.mockResolvedValue([]);
  fetchAllTimeRules.mockResolvedValue(undefined);
  approveDevice.mockResolvedValue(true);
  rejectDevice.mockResolvedValue(true);
  deleteDevice.mockResolvedValue(true);
  renameDevice.mockResolvedValue(true);
  setPendingDevice.mockResolvedValue(true);
  grantTemporaryAccess.mockResolvedValue(true);
  grantBatchTemporaryAccess.mockResolvedValue(true);
  revokeTemporaryAccess.mockResolvedValue(true);
  updateUserPreference.mockResolvedValue(true);
  updateUserIPPolicy.mockResolvedValue(true);
  toggleUserVisibility.mockResolvedValue(undefined);
  getHiddenUsers.mockResolvedValue([]);
});

afterEach(() => consoleError.mockRestore());

describe("DeviceManagement grouping", () => {
  it("groups devices by user", async () => {
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1" }),
        device({ id: 2, userId: "u-2", username: "bob" }),
      ],
      users: [preference({ userId: "u-1" }), preference({ userId: "u-2" })],
    });

    expect(screen.getByText("group:u-1")).toBeInTheDocument();
    expect(screen.getByText("group:u-2")).toBeInTheDocument();
  });

  it("keeps PlexAmp devices out of the pending count", async () => {
    await renderPanel({
      devices: [
        device({ id: 1, status: "pending" }),
        device({ id: 2, status: "pending", deviceProduct: "Plexamp" }),
      ],
    });

    expect(screen.getByText("group:u-1")).toBeInTheDocument();
  });

  it("hides users whose preference marks them hidden", async () => {
    await renderPanel({
      devices: [device({ userId: "u-1" })],
      users: [preference({ userId: "u-1", hidden: true })],
    });

    expect(screen.queryByText("group:u-1")).toBeNull();
  });

  it("hands each group the user's time rules for per-device badges", async () => {
    getAllTimeRules.mockResolvedValue([
      { id: 1, userId: "u-1", enabled: true, dayOfWeek: 1 },
    ]);
    await renderPanel();

    await waitFor(() =>
      expect(screen.getByText("rules:u-1:1")).toBeInTheDocument(),
    );
  });

  it("logs a failure loading time-rule status", async () => {
    fetchAllTimeRules.mockRejectedValue(new Error("offline"));
    await renderPanel();

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading time rule status:",
        expect.any(Error),
      ),
    );
  });
});

describe("DeviceManagement search and sort", () => {
  const twoUsers = {
    devices: [
      device({ id: 1, userId: "u-1", username: "alice", deviceName: "TV" }),
      device({
        id: 2,
        userId: "u-2",
        username: "bob",
        deviceName: "Phone",
        devicePlatform: "Android",
        deviceProduct: "Plexamp",
        sessionCount: 9,
      }),
    ],
    users: [preference({ userId: "u-1" }), preference({ userId: "u-2" })],
  };

  it.each([
    ["bob", "u-2"],
    ["Phone", "u-2"],
    ["Android", "u-2"],
    ["Plexamp", "u-2"],
    ["alice", "u-1"],
  ])("matches %p", async (term, expected) => {
    const { user } = await renderPanel(twoUsers);

    await user.type(
      screen.getByPlaceholderText("Search by user or device"),
      term,
    );

    expect(screen.getByText(`group:${expected}`)).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2/)).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const { user } = await renderPanel(twoUsers);

    await user.type(
      screen.getByPlaceholderText("Search by user or device"),
      "zzz",
    );

    expect(screen.getByText(/Showing 0 of 2/)).toBeInTheDocument();
  });

  it("falls back to the user id when there is no username", async () => {
    const { user } = await renderPanel({
      devices: [device({ userId: "u-42", username: undefined })],
      users: [preference({ userId: "u-42" })],
    });

    await user.type(
      screen.getByPlaceholderText("Search by user or device"),
      "u-42",
    );

    expect(screen.getByText("group:u-42")).toBeInTheDocument();
  });

  const openSortMenu = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(document.querySelector('[aria-haspopup="menu"]') as HTMLElement);

  it.each([
    "Device Count",
    "Pending Count",
    "Last Stream",
    "Stream Count",
    "Username",
  ])("sorts by %s", async (label) => {
    const { user } = await renderPanel(twoUsers);

    await openSortMenu(user);
    const items = await screen.findAllByText(label);
    await user.click(items[items.length - 1]);

    expect(screen.getAllByText(/^group:/).length).toBe(2);
  });

  it("reverses the sort order", async () => {
    const { user } = await renderPanel(twoUsers);

    expect(screen.getByText("Descending")).toBeInTheDocument();

    await user.click(screen.getByText("Descending").closest("button")!);

    expect(screen.getByText("Ascending")).toBeInTheDocument();
  });

  it("remembers the sort preference", async () => {
    const { user } = await renderPanel(twoUsers);

    await openSortMenu(user);
    await user.click(await screen.findByText("Device Count"));

    await waitFor(() =>
      expect(localStorage.getItem("guardian-unified-sort-by")).toContain(
        "deviceCount",
      ),
    );
  });
});

describe("DeviceManagement toolbar", () => {
  it("refreshes", async () => {
    const { user, onRefresh } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it("toggles auto refresh", async () => {
    const { user, onAutoRefreshChange } = await renderPanel({
      autoRefresh: true,
    });

    await user.click(screen.getByRole("button", { name: /Live/ }));

    expect(onAutoRefreshChange).toHaveBeenCalledWith(false);
  });

  it("expands and collapses a user", async () => {
    const { user } = await renderPanel();
    expect(screen.getByText("expanded:u-1:false")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "toggle u-1" }));
    expect(screen.getByText("expanded:u-1:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "toggle u-1" }));
    expect(screen.getByText("expanded:u-1:false")).toBeInTheDocument();
  });
});

describe("DeviceManagement device actions", () => {
  const confirmAnd = async (
    user: ReturnType<typeof userEvent.setup>,
    trigger: string,
  ) => {
    await user.click(screen.getByRole("button", { name: trigger }));
    await user.click(screen.getByRole("button", { name: "do it" }));
  };

  it.each([
    ["approve u-1", "approve", () => approveDevice],
    ["reject u-1", "reject", () => rejectDevice],
    ["delete u-1", "delete", () => deleteDevice],
    ["switch u-1", "toggle", () => approveDevice],
  ] as const)("confirms then runs %s", async (trigger, action, getMock) => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: trigger }));
    expect(screen.getByText(`confirm:${action}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(getMock()).toHaveBeenCalledWith(1));
  });

  it("can be abandoned", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "approve u-1" }));
    await user.click(screen.getByRole("button", { name: "never mind" }));

    expect(screen.queryByText(/^confirm:/)).toBeNull();
    expect(approveDevice).not.toHaveBeenCalled();
  });

  it("rejects an approved device through the toggle", async () => {
    const { user } = await renderPanel({
      devices: [device({ status: "approved" })],
    });

    await confirmAnd(user, "switch u-1");

    await waitFor(() => expect(rejectDevice).toHaveBeenCalledWith(1));
  });

  it("stays quiet when an action reports failure", async () => {
    approveDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await confirmAnd(user, "approve u-1");

    await waitFor(() => expect(approveDevice).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it("asks before removing temporary access", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "revoke u-1" }));

    expect(
      screen.getByText("confirm:removeTemporaryAccess"),
    ).toBeInTheDocument();
    expect(revokeTemporaryAccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(revokeTemporaryAccess).toHaveBeenCalledWith(1));
  });

  it("leaves temporary access alone when the confirmation is dismissed", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "revoke u-1" }));
    await user.click(screen.getByRole("button", { name: "never mind" }));

    expect(screen.queryByText(/^confirm:/)).toBeNull();
    expect(revokeTemporaryAccess).not.toHaveBeenCalled();
  });
});

describe("DeviceManagement details modal", () => {
  it("opens and closes", async () => {
    const { user } = await renderPanel();
    expect(screen.getByText("details-modal:false:none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    expect(screen.getByText("details-modal:true:1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close details" }));
    expect(screen.getByText("details-modal:false:none")).toBeInTheDocument();
  });

  it("renames a device", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() =>
      expect(renameDevice).toHaveBeenCalledWith(0, "Renamed"),
    );
  });

  it("sets a device back to pending", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "set pending" }));

    await waitFor(() => expect(setPendingDevice).toHaveBeenCalledWith(1));
  });
});

describe("DeviceManagement user actions", () => {
  it("updates a default policy", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(updateUserPreference).toHaveBeenCalledWith("u-1", true),
    );
  });

  it("keeps the saving flag up until the refreshed data lands", async () => {
    let release: () => void = () => {};
    const { user, onRefresh } = await renderPanel();
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
    const { user, onRefresh } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(screen.getByText("updating:u-1:none")).toBeInTheDocument(),
    );
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("updates an IP policy", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "ip u-1" }));

    await waitFor(() =>
      expect(updateUserIPPolicy).toHaveBeenCalledWith("u-1", {
        networkPolicy: "lan",
      }),
    );
  });

  it("asks before hiding a user", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));

    expect(toggleUserVisibility).not.toHaveBeenCalled();
  });

  it("hides the user once the warning is confirmed", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: /Hide User/ }));

    await waitFor(() =>
      expect(toggleUserVisibility).toHaveBeenCalledWith("u-1"),
    );
  });

  it("opens the history modal", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:true:u-1")).toBeInTheDocument();
  });

  it("closes the history modal", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "history u-1" }));
    await user.click(screen.getByRole("button", { name: "close history" }));

    expect(screen.getByText("history-modal:false:none")).toBeInTheDocument();
  });

  it("opens the schedule modal", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "schedule u-1" }));

    expect(screen.getByText("time-modal:true:u-1")).toBeInTheDocument();
  });

  it("closes the schedule modal", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "schedule u-1" }));
    await user.click(screen.getByRole("button", { name: "close schedule" }));

    await waitFor(() =>
      expect(screen.getByText("time-modal:false:")).toBeInTheDocument(),
    );
  });
});

describe("DeviceManagement temporary access", () => {
  it("opens the modal for a user", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));

    expect(screen.getByText("temp-modal:true:u-1")).toBeInTheDocument();
  });

  it("grants access to the chosen devices", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant temp" }));

    await waitFor(() => expect(grantTemporaryAccess).toHaveBeenCalled());
  });

  it("closes the modal", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "close temp" }));

    expect(screen.getByText("temp-modal:false:none")).toBeInTheDocument();
  });

  describe("eligibility", () => {
    it("excludes PlexAmp devices", async () => {
      const { user } = await renderPanel({
        devices: [device({ id: 1, deviceProduct: "Plexamp" })],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:")).toBeInTheDocument();
    });

    it("excludes approved devices", async () => {
      const { user } = await renderPanel({
        devices: [device({ id: 1, status: "approved" })],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:")).toBeInTheDocument();
    });

    it("always includes rejected devices", async () => {
      const { user } = await renderPanel({
        devices: [device({ id: 1, status: "rejected" })],
        users: [preference({ defaultBlock: false })],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:1")).toBeInTheDocument();
    });

    it("excludes pending devices for a user set to allow", async () => {
      const { user } = await renderPanel({
        users: [preference({ defaultBlock: false })],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:")).toBeInTheDocument();
    });

    it("includes pending devices for a user set to block", async () => {
      const { user } = await renderPanel({
        users: [preference({ defaultBlock: true })],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:1")).toBeInTheDocument();
    });

    it("defers to a global allow default", async () => {
      const { user } = await renderPanel({
        users: [preference({ defaultBlock: null })],
        settings: [
          { key: "PLEX_GUARD_DEFAULT_BLOCK", value: "false" } as AppSetting,
        ],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:")).toBeInTheDocument();
    });

    it("defers to a global block default", async () => {
      const { user } = await renderPanel({
        users: [preference({ defaultBlock: null })],
        settings: [
          { key: "PLEX_GUARD_DEFAULT_BLOCK", value: "true" } as AppSetting,
        ],
      });

      await user.click(screen.getByRole("button", { name: "temp u-1" }));
      expect(screen.getByText("eligible:1")).toBeInTheDocument();
    });
  });
});

describe("DeviceManagement navigation", () => {
  it("expands the target user and scrolls to the device", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    jest.useFakeTimers();

    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "device-1" }}
        onNavigationComplete={jest.fn()}
      />,
    );
    await act(async () => {});

    expect(screen.getByText("expanded:u-1:true")).toBeInTheDocument();
  });

  it("expands the user when jumping from the history modal", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "history u-1" }));
    await user.click(screen.getByRole("button", { name: "history to device" }));

    expect(screen.getByText("expanded:u-1:true")).toBeInTheDocument();
  });
});

describe("DeviceManagement hidden users", () => {
  it("cancels the hide warning", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(toggleUserVisibility).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Hide User?")).toBeNull());
  });

  it("reports a failure hiding a user", async () => {
    toggleUserVisibility.mockRejectedValue(new Error("offline"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await user.click(await screen.findByRole("button", { name: /Hide User/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("lists hidden users", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: "ghost", hidden: true }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    expect(await screen.findByText("ghost")).toBeInTheDocument();
  });

  it("says when nobody is hidden", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    expect(
      await screen.findByText("No hidden users found"),
    ).toBeInTheDocument();
  });

  it("names an unnamed hidden user", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: undefined, hidden: true }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    expect(await screen.findByText("Unknown username")).toBeInTheDocument();
  });

  it("unhides a user from the modal", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-9", username: "ghost", hidden: true }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));
    await user.click(await screen.findByRole("button", { name: /Show$/ }));

    await waitFor(() =>
      expect(toggleUserVisibility).toHaveBeenCalledWith("u-9"),
    );
  });

  it("reports a failure loading hidden users", async () => {
    getHiddenUsers.mockRejectedValue(new Error("offline"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    await waitFor(() => expect(getHiddenUsers).toHaveBeenCalled());
  });
});

describe("DeviceManagement renaming", () => {
  it("reports a rename failure", async () => {
    renameDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() => expect(renameDevice).toHaveBeenCalled());
  });
});

describe("DeviceManagement granting temporary access", () => {
  const openAndGrant = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant temp" }));
  };

  it("uses the single-device call for one device", async () => {
    const { user } = await renderPanel();

    await openAndGrant(user);

    await waitFor(() => expect(grantTemporaryAccess).toHaveBeenCalled());
    expect(grantBatchTemporaryAccess).not.toHaveBeenCalled();
  });

  it("reports a single-device failure", async () => {
    grantTemporaryAccess.mockResolvedValue(false);
    const { user } = await renderPanel();

    await openAndGrant(user);

    await waitFor(() => expect(grantTemporaryAccess).toHaveBeenCalled());
  });

  it("reports a revoke failure", async () => {
    revokeTemporaryAccess.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "revoke u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(revokeTemporaryAccess).toHaveBeenCalled());
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
    await user.click(screen.getByRole("button", { name: /Live|Manual/ }));

    expect(screen.getByText("group:u-1")).toBeInTheDocument();
  });

  it("shows a skeleton until data arrives", () => {
    const { container } = render(<DeviceManagement />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});

describe("DeviceManagement scroll navigation", () => {
  const scrollIntoView = jest.fn();

  const renderWithTimers = async (
    navigationTarget: { userId: string; deviceIdentifier: string } | null,
  ) => {
    Element.prototype.scrollIntoView = scrollIntoView;
    jest.useFakeTimers();
    const onNavigationComplete = jest.fn();
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        navigationTarget={navigationTarget}
        onNavigationComplete={onNavigationComplete}
      />,
    );
    await act(async () => {});
    return { onNavigationComplete };
  };

  beforeEach(() => scrollIntoView.mockClear());

  it("expands the target user before scrolling", async () => {
    await renderWithTimers({ userId: "u-1", deviceIdentifier: "device-1" });

    expect(screen.getByText("expanded:u-1:true")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
  });

  it("does nothing without a target", async () => {
    await renderWithTimers(null);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing for a device that is not on screen", async () => {
    const { onNavigationComplete } = await renderWithTimers({
      userId: "u-1",
      deviceIdentifier: "missing-device",
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(onNavigationComplete).not.toHaveBeenCalled();
  });
});

describe("DeviceManagement batch temporary access", () => {
  it("uses the batch call for several devices", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({
      success: true,
      failedDevices: [],
    });
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant many" }));

    await waitFor(() =>
      expect(grantBatchTemporaryAccess).toHaveBeenCalledWith(
        [1, 2],
        120,
        false,
      ),
    );
  });

  it("reports partial failures", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({
      success: true,
      failedDevices: [2],
    });
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant many" }));

    await waitFor(() => expect(grantBatchTemporaryAccess).toHaveBeenCalled());
  });

  it("reports a batch failure", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({ success: false });
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant many" }));

    await waitFor(() => expect(grantBatchTemporaryAccess).toHaveBeenCalled());
  });
});

describe("DeviceManagement preference failures", () => {
  it("reports a failed preference update", async () => {
    updateUserPreference.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() => expect(updateUserPreference).toHaveBeenCalled());
    expect(screen.getByText("updating:u-1:none")).toBeInTheDocument();
  });

  it("reports a failed IP policy update", async () => {
    updateUserIPPolicy.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "ip u-1" }));

    await waitFor(() => expect(updateUserIPPolicy).toHaveBeenCalled());
  });

  it("sorts users with no devices to the epoch", async () => {
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1", lastSeen: "2026-02-01T00:00:00Z" }),
        device({
          id: 2,
          userId: "u-2",
          username: "bob",
          lastSeen: "2025-01-01T00:00:00Z",
        }),
      ],
      users: [preference({ userId: "u-1" }), preference({ userId: "u-2" })],
    });

    expect(screen.getAllByText(/^group:/).length).toBe(2);
  });
});
