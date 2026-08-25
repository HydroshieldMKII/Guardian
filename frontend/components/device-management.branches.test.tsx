import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const hasTimeRules = jest.fn();
const fetchAllTimeRules = jest.fn();
jest.mock("@/hooks/device-management/useTimeRules", () => ({
  useTimeRules: () => ({ hasTimeRules, fetchAllTimeRules }),
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

type GroupCardProps = {
  group: {
    user: { userId: string; username?: string };
    devices: UserDevice[];
  };
  hasIPPolicies: boolean;
  onUpdateUserPreference: (id: string, block: boolean | null) => void;
  onToggleUserVisibility: (id: string) => void;
  onShowHistory: (id: string) => void;
  onGrantUserTempAccess: (id: string) => void;
  onShowTimePolicy: (id: string, deviceIdentifier?: string) => void;
  onApprove: (d: UserDevice) => void;
  onReject: (d: UserDevice) => void;
  onDelete: (d: UserDevice) => void;
  onToggleApproval: (d: UserDevice) => void;
  onShowDetails: (d: UserDevice) => void;
};

jest.mock("@/components/device-management/UserGroupCard", () => ({
  UserGroupCard: ({
    group,
    hasIPPolicies,
    onUpdateUserPreference,
    onToggleUserVisibility,
    onShowHistory,
    onGrantUserTempAccess,
    onShowTimePolicy,
    onApprove,
    onReject,
    onDelete,
    onToggleApproval,
    onShowDetails,
  }: GroupCardProps) => {
    const id = group.user.userId;
    const device = group.devices[0];
    return (
      <div data-user-id={id}>
        <span>{`order:${id}`}</span>
        <span>{`ip-badge:${id}:${hasIPPolicies}`}</span>
        <button onClick={() => onUpdateUserPreference(id, true)}>
          {`block ${id}`}
        </button>
        <button
          onClick={() => onToggleUserVisibility(id)}
        >{`hide ${id}`}</button>
        <button onClick={() => onShowHistory(id)}>{`history ${id}`}</button>
        <button
          onClick={() => onGrantUserTempAccess(id)}
        >{`temp ${id}`}</button>
        <button onClick={() => onGrantUserTempAccess("ghost")}>
          {`temp ghost via ${id}`}
        </button>
        <button onClick={() => onShowTimePolicy("ghost")}>
          {`schedule ghost via ${id}`}
        </button>
        {device && (
          <>
            <button onClick={() => onApprove(device)}>{`approve ${id}`}</button>
            <button onClick={() => onReject(device)}>{`reject ${id}`}</button>
            <button onClick={() => onDelete(device)}>{`delete ${id}`}</button>
            <button onClick={() => onToggleApproval(device)}>
              {`switch ${id}`}
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
    editingDevice,
    newDeviceName,
    onSetPending,
    onEdit,
    onCancelEdit,
    onRename,
    onNewDeviceNameChange,
  }: {
    device: UserDevice | null;
    editingDevice: number | null;
    newDeviceName: string;
    onSetPending?: (id: number) => Promise<boolean>;
    onEdit: (d: UserDevice) => void;
    onCancelEdit: () => void;
    onRename: (id: number, name: string) => void;
    onNewDeviceNameChange: (name: string) => void;
  }) => (
    <div>
      <span>{`editing:${editingDevice ?? "none"}:${newDeviceName || "empty"}`}</span>
      <button onClick={() => device && onEdit(device)}>start editing</button>
      <button onClick={onCancelEdit}>cancel editing</button>
      <button onClick={() => onNewDeviceNameChange("Typed")}>type name</button>
      <button onClick={() => onRename(device?.id ?? 0, "Renamed")}>
        rename device
      </button>
      <button onClick={() => onSetPending?.(device?.id ?? 0)}>
        set pending
      </button>
    </div>
  ),
}));

const DURATIONS = [
  1, 5, 60, 180, 61, 135, 1440, 2880, 1560, 4380, 10080, 11520, 20160, 12960,
  33120,
];

jest.mock("@/components/device-management/TemporaryAccessModal", () => ({
  TemporaryAccessModal: ({
    user,
    isOpen,
    onGrantAccess,
  }: {
    user: { userId: string } | null;
    isOpen: boolean;
    onGrantAccess: (ids: number[], minutes: number, bypass?: boolean) => void;
  }) => (
    <div>
      <span>{`temp-modal:${isOpen}:${user?.userId ?? "none"}`}</span>
      {DURATIONS.map((minutes) => (
        <button key={minutes} onClick={() => onGrantAccess([1], minutes)}>
          {`grant ${minutes}`}
        </button>
      ))}
      <button onClick={() => onGrantAccess([1, 2], 30, false)}>
        grant batch
      </button>
    </div>
  ),
}));

jest.mock("@/components/device-management/ConfirmationModal", () => ({
  ConfirmationModal: ({
    confirmAction,
    onConfirm,
  }: {
    confirmAction: { action: string; description: string } | null;
    onConfirm: () => void;
  }) =>
    confirmAction ? (
      <div>
        <span>{`described:${confirmAction.description}`}</span>
        <button onClick={() => onConfirm()}>do it</button>
      </div>
    ) : null,
}));

jest.mock("@/components/device-management/UserHistoryModal", () => ({
  UserHistoryModal: ({
    userId,
    username,
    onNavigateToDevice,
  }: {
    userId: string | null;
    username?: string;
    onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  }) => (
    <div>
      <span>{`history-modal:${userId ?? "none"}:${username ?? "anonymous"}`}</span>
      <button onClick={() => onNavigateToDevice?.("u-1", "device-1")}>
        history to device
      </button>
      <button onClick={() => onNavigateToDevice?.("u-1", "does-not-exist")}>
        history to missing device
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
      <span>{`time-modal:${isOpen}:${userId || "none"}`}</span>
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
    withRefresh?: boolean;
  } = {},
) => {
  const onRefresh = jest.fn();
  const view = render(
    <DeviceManagement
      devicesData={devicesData(props.devices ?? [device()])}
      usersData={props.users ?? [preference()]}
      settingsData={props.settings}
      onRefresh={props.withRefresh === false ? undefined : onRefresh}
    />,
  );
  await act(async () => {});
  return {
    ...view,
    onRefresh,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

const lastToast = () => toast.mock.calls.at(-1)?.[0];

const toastWithTitle = (title: string) =>
  toast.mock.calls.map((call) => call[0]).filter((arg) => arg.title === title);

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  localStorage.clear();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  hasTemporaryAccess.mockReturnValue(false);
  hasTimeRules.mockResolvedValue(false);
  fetchAllTimeRules.mockResolvedValue(undefined);
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

describe("temporary access duration wording", () => {
  const cases: Array<[number, string]> = [
    [1, "1 minute"],
    [5, "5 minutes"],
    [60, "1 hour"],
    [180, "3 hours"],
    [61, "1 hour and 1 minute"],
    [135, "2 hours and 15 minutes"],
    [1440, "1 day"],
    [2880, "2 days"],
    [1560, "1 day and 2 hours"],
    [4380, "3 days and 1 hour"],
    [10080, "1 week"],
    [20160, "2 weeks"],
    [12960, "1 week and 2 days"],
    [33120, "3 weeks and 2 days"],
  ];

  it.each(cases)("renders %i minutes as %s", async (minutes, expected) => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: `grant ${minutes}` }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Temporary Access Granted",
        description: `Temporary access granted to 1 device for ${expected}`,
      }),
    );
  });

  it("pluralises the device count for a batch grant", async () => {
    const { user } = await renderPanel({
      devices: [device({ id: 1 }), device({ id: 2, deviceIdentifier: "d-2" })],
    });

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant batch" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        description: "Temporary access granted to 2 devices for 30 minutes",
      }),
    );
  });

  it("reports how many devices failed in a partial batch grant", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({
      success: true,
      results: [{ success: true }, { success: false }],
    });
    const { user } = await renderPanel({
      devices: [device({ id: 1 }), device({ id: 2, deviceIdentifier: "d-2" })],
    });

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant batch" }));

    await waitFor(() =>
      expect(toastWithTitle("Partial Success")[0]).toMatchObject({
        description: "1 devices granted access, 1 failed",
      }),
    );
  });

  it("stops after reporting a failed batch grant", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({ success: false });
    const { user } = await renderPanel({
      devices: [device({ id: 1 }), device({ id: 2, deviceIdentifier: "d-2" })],
    });

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant batch" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        description: "Failed to grant temporary access to devices",
      }),
    );
    expect(toastWithTitle("Temporary Access Granted")).toHaveLength(0);
  });

  it("stops after reporting a failed single grant", async () => {
    grantTemporaryAccess.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant 60" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        description: "Failed to grant temporary access",
      }),
    );
    expect(toastWithTitle("Temporary Access Granted")).toHaveLength(0);
  });

  it("ignores a temp access request for a user with no group", async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole("button", { name: "temp ghost via u-1" }),
    );

    expect(screen.getByText("temp-modal:false:none")).toBeInTheDocument();
  });
});

describe("sorting", () => {
  const twoUsers = {
    devices: [
      device({
        id: 1,
        userId: "u-1",
        username: undefined,
        lastSeen: "2026-02-01T00:00:00Z",
        sessionCount: 1,
      }),
      device({
        id: 2,
        userId: "u-2",
        username: undefined,
        deviceIdentifier: "device-2",
        lastSeen: "2025-01-01T00:00:00Z",
        sessionCount: undefined,
      }),
      device({
        id: 3,
        userId: "u-2",
        username: undefined,
        deviceIdentifier: "device-3",
        status: "approved" as const,
        lastSeen: "2025-06-01T00:00:00Z",
      }),
    ],
    users: [preference({ userId: "u-1" }), preference({ id: 2, userId: "u-2" })],
  };

  const orderedIds = () =>
    screen
      .getAllByText(/^order:/)
      .map((node) => node.textContent?.replace("order:", ""));

  it.each([
    ["username", "asc", ["u-1", "u-2"]],
    ["username", "desc", ["u-2", "u-1"]],
    ["deviceCount", "asc", ["u-1", "u-2"]],
    ["deviceCount", "desc", ["u-2", "u-1"]],
    ["pendingCount", "desc", ["u-1", "u-2"]],
    ["lastSeen", "asc", ["u-2", "u-1"]],
    ["lastSeen", "desc", ["u-1", "u-2"]],
    ["streamCount", "asc", ["u-1", "u-2"]],
    ["streamCount", "desc", ["u-2", "u-1"]],
    ["unrecognised", "asc", ["u-1", "u-2"]],
  ])("sorts by %s %s", async (sortBy, sortOrder, expected) => {
    localStorage.setItem("guardian-unified-sort-by", sortBy);
    localStorage.setItem("guardian-unified-sort-order", sortOrder);
    await renderPanel(twoUsers);

    expect(orderedIds()).toEqual(expected);
  });

  it("falls back to the user id when no username is known", async () => {
    localStorage.setItem("guardian-unified-sort-by", "username");
    await renderPanel(twoUsers);

    expect(orderedIds()).toEqual(["u-2", "u-1"]);
  });

  it("treats a user with no devices as the oldest last stream", async () => {
    localStorage.setItem("guardian-unified-sort-by", "lastSeen");
    localStorage.setItem("guardian-unified-sort-order", "desc");
    await renderPanel({
      devices: [device({ id: 1, userId: "u-1" })],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    expect(orderedIds()).toEqual(["u-1", "u-2"]);
  });

  it("flips the order from ascending to descending", async () => {
    localStorage.setItem("guardian-unified-sort-order", "asc");
    const { user } = await renderPanel(twoUsers);

    expect(screen.getByRole("button", { name: /Ascending/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Ascending/ }));

    expect(screen.getByRole("button", { name: /Descending/ })).toBeVisible();
    expect(localStorage.getItem("guardian-unified-sort-order")).toBe("desc");
  });

  it("changes the sort field from the dropdown", async () => {
    const { user } = await renderPanel(twoUsers);

    await user.click(screen.getByRole("button", { name: /Pending Count/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Username" }));

    await waitFor(() =>
      expect(localStorage.getItem("guardian-unified-sort-by")).toBe("username"),
    );
  });
});

describe("search filtering", () => {
  it("matches a device with no name by its identifier", async () => {
    const { user } = await renderPanel({
      devices: [
        device({
          id: 1,
          userId: "u-1",
          deviceName: undefined,
          deviceIdentifier: "kitchen-box",
        }),
        device({ id: 2, userId: "u-2", deviceIdentifier: "device-2" }),
      ],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    await user.type(
      screen.getByPlaceholderText("Search by username or device..."),
      "kitchen",
    );

    expect(screen.getByText("order:u-1")).toBeInTheDocument();
    expect(screen.queryByText("order:u-2")).toBeNull();
  });

  it("matches a device with no name and no identifier against nothing", async () => {
    const { user } = await renderPanel({
      devices: [
        device({
          id: 1,
          deviceName: undefined,
          deviceIdentifier: "",
          devicePlatform: undefined,
          deviceProduct: undefined,
        }),
      ],
    });

    await user.type(
      screen.getByPlaceholderText("Search by username or device..."),
      "zzz",
    );

    expect(screen.getByText("No users match your search")).toBeInTheDocument();
  });

  it("matches on device platform", async () => {
    const { user } = await renderPanel({
      devices: [device({ devicePlatform: "tvOS", deviceProduct: undefined })],
    });

    await user.type(
      screen.getByPlaceholderText("Search by username or device..."),
      "tvos",
    );

    expect(screen.getByText("order:u-1")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 users/)).toBeInTheDocument();
  });

  it("matches on device product", async () => {
    const { user } = await renderPanel({
      devices: [device({ deviceName: undefined, deviceProduct: "Plexamp" })],
    });

    await user.type(
      screen.getByPlaceholderText("Search by username or device..."),
      "plexamp",
    );

    expect(screen.getByText("order:u-1")).toBeInTheDocument();
  });
});

describe("IP policy badge", () => {
  it("is off for a user with no stored preference", async () => {
    await renderPanel({ devices: [device({ userId: "u-9" })], users: [] });

    expect(screen.getByText("ip-badge:u-9:false")).toBeInTheDocument();
  });

  it("is on when allowed IPs are stored as a non-empty string", async () => {
    await renderPanel({
      users: [preference({ allowedIPs: "10.0.0.0/8" as unknown as string[] })],
    });

    expect(screen.getByText("ip-badge:u-1:true")).toBeInTheDocument();
  });

  it("is off when allowed IPs are stored as a blank string", async () => {
    await renderPanel({
      users: [preference({ allowedIPs: "   " as unknown as string[] })],
    });

    expect(screen.getByText("ip-badge:u-1:false")).toBeInTheDocument();
  });

  it("is on for a custom network policy", async () => {
    await renderPanel({ users: [preference({ networkPolicy: "lan" })] });

    expect(screen.getByText("ip-badge:u-1:true")).toBeInTheDocument();
  });

  it("is on for a custom IP access policy", async () => {
    await renderPanel({ users: [preference({ ipAccessPolicy: "restricted" })] });

    expect(screen.getByText("ip-badge:u-1:true")).toBeInTheDocument();
  });
});

describe("device action failures", () => {
  it("stays quiet when rejecting fails", async () => {
    rejectDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "reject u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(rejectDevice).toHaveBeenCalled());
    expect(toastWithTitle("Device Rejected")).toHaveLength(0);
  });

  it("stays quiet when deleting fails", async () => {
    deleteDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "delete u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(deleteDevice).toHaveBeenCalled());
    expect(toastWithTitle("Device Deleted")).toHaveLength(0);
  });

  it("stays quiet when setting a device back to pending fails", async () => {
    setPendingDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "set pending" }));

    await waitFor(() => expect(setPendingDevice).toHaveBeenCalled());
    expect(toastWithTitle("Device Set to Pending")).toHaveLength(0);
  });

  it("stays quiet when renaming fails", async () => {
    renameDevice.mockResolvedValue(false);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));
    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() => expect(renameDevice).toHaveBeenCalled());
    expect(screen.getByText("editing:1:TV")).toBeInTheDocument();
  });

  it("rejects an approved device when the approval is toggled", async () => {
    const { user } = await renderPanel({
      devices: [device({ status: "approved", approved: true })],
    });

    await user.click(screen.getByRole("button", { name: "switch u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(rejectDevice).toHaveBeenCalledWith(1));
    expect(approveDevice).not.toHaveBeenCalled();
  });
});

describe("device renaming", () => {
  it("keeps the open details modal in step with the new name", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));
    expect(screen.getByText("editing:1:TV")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "type name" }));
    expect(screen.getByText("editing:1:Typed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() =>
      expect(screen.getByText("editing:none:empty")).toBeInTheDocument(),
    );
    expect(renameDevice).toHaveBeenCalledWith(1, "Renamed");
  });

  it("starts editing an unnamed device with an empty field", async () => {
    const { user } = await renderPanel({
      devices: [device({ deviceName: undefined })],
    });

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));

    expect(screen.getByText("editing:1:empty")).toBeInTheDocument();
  });

  it("clears the draft name when editing is cancelled", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));
    await user.click(screen.getByRole("button", { name: "cancel editing" }));

    expect(screen.getByText("editing:none:empty")).toBeInTheDocument();
  });
});

describe("confirmation wording", () => {
  it.each([
    ["approve u-1", "approve this device"],
    ["reject u-1", "reject this device"],
    ["delete u-1", "permanently delete this device record"],
    ["switch u-1", "approve"],
  ])(
    "names an unnamed device by its identifier in the %s dialog",
    async (button, phrase) => {
      const { user } = await renderPanel({
        devices: [device({ deviceName: undefined })],
      });

      await user.click(screen.getByRole("button", { name: button }));

      const described = screen.getByText(/^described:/).textContent ?? "";
      expect(described).toContain("device-1");
      expect(described).toContain(phrase);
    },
  );

  it("describes rejecting when toggling an approved device", async () => {
    const { user } = await renderPanel({
      devices: [device({ deviceName: undefined, status: "approved" })],
    });

    await user.click(screen.getByRole("button", { name: "switch u-1" }));

    expect(screen.getByText(/^described:/).textContent).toContain(
      'reject "device-1"',
    );
  });
});

describe("hidden users", () => {
  it("shows the empty state when nobody is hidden", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    expect(await screen.findByText("No hidden users found")).toBeInTheDocument();
  });

  it("logs a failure to load the hidden user list", async () => {
    getHiddenUsers.mockRejectedValue(new Error("nope"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to load hidden users:",
        expect.any(Error),
      ),
    );
  });

  it("confirms before hiding a visible user", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("u-1")).toBeInTheDocument();
    expect(toggleUserVisibility).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: /Hide User/ }));

    await waitFor(() => expect(toggleUserVisibility).toHaveBeenCalledWith("u-1"));
    expect(lastToast()).toMatchObject({ title: "User Hidden" });
  });

  it("reports a failure to hide a user", async () => {
    toggleUserVisibility.mockRejectedValue(new Error("nope"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Hide User/ }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Error",
        description: "Failed to hide user",
      }),
    );
  });

  it("shows a hidden user again without confirmation", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-2", hidden: true, username: "bob" }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));
    await user.click(await screen.findByRole("button", { name: /Show$/ }));

    await waitFor(() => expect(toggleUserVisibility).toHaveBeenCalledWith("u-2"));
    expect(lastToast()).toMatchObject({
      title: "User Shown",
      description: "bob is now visible in the user list",
    });
    expect(getHiddenUsers).toHaveBeenCalledTimes(2);
  });

  it("labels a hidden user with no username", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-2", hidden: true }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));

    expect(await screen.findByText("Unknown username")).toBeInTheDocument();
  });

  it("reports a failure to show a hidden user", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-2", hidden: true, username: "bob" }),
    ]);
    toggleUserVisibility.mockRejectedValue(new Error("nope"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));
    await user.click(await screen.findByRole("button", { name: /Show$/ }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Error",
        description: "Failed to update user visibility",
      }),
    );
  });
});

describe("history navigation", () => {
  it("names the history user from their device", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:u-1:alice")).toBeInTheDocument();
  });

  it("falls back to the stored preference username", async () => {
    const { user } = await renderPanel({
      devices: [device({ username: undefined })],
      users: [preference({ username: "stored" })],
    });

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:u-1:stored")).toBeInTheDocument();
  });

  it("highlights the device the history entry points at", async () => {
    jest.useFakeTimers();
    const { container } = render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
      />,
    );
    await act(async () => {});

    const target = document.createElement("div");
    target.setAttribute("data-device-identifier", "device-1");
    target.scrollIntoView = jest.fn();
    container.appendChild(target);

    act(() => {
      screen.getByRole("button", { name: "history to device" }).click();
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(target.scrollIntoView).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(target).toHaveClass("ring-2");

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(target).not.toHaveClass("ring-2");
  });

  it("uses the short delay when the user group is already expanded", async () => {
    jest.useFakeTimers();
    const { container } = render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
      />,
    );
    await act(async () => {});

    const target = document.createElement("div");
    target.setAttribute("data-device-identifier", "device-1");
    target.scrollIntoView = jest.fn();
    container.appendChild(target);

    act(() => {
      screen.getByRole("button", { name: "history to device" }).click();
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    (target.scrollIntoView as jest.Mock).mockClear();

    act(() => {
      screen.getByRole("button", { name: "history to device" }).click();
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it("does nothing when the device element is gone from the page", async () => {
    jest.useFakeTimers();
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
      />,
    );
    await act(async () => {});

    act(() => {
      screen.getByRole("button", { name: "history to device" }).click();
    });
    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(toastWithTitle("Device Not Found")).toHaveLength(0);
  });

  it("warns when the history entry points at an unknown device", async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole("button", { name: "history to missing device" }),
    );

    expect(lastToast()).toMatchObject({
      title: "Device Not Found",
      variant: "destructive",
    });
  });
});

describe("time policy modal", () => {
  it("ignores a schedule request for a user with no group", async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole("button", { name: "schedule ghost via u-1" }),
    );

    expect(screen.getByText("time-modal:false:none")).toBeInTheDocument();
  });

  it("skips the refresh when there are no user groups", async () => {
    const { user } = await renderPanel({ devices: [], users: [] });

    await user.click(screen.getByRole("button", { name: "close schedule" }));

    expect(fetchAllTimeRules).not.toHaveBeenCalled();
  });

  it("logs a failure to refresh time rule status", async () => {
    fetchAllTimeRules.mockRejectedValue(new Error("nope"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "close schedule" }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Error refreshing time rule status:",
        expect.any(Error),
      ),
    );
  });
});

describe("preference updates without a refresh callback", () => {
  it("still reports success when no refresh handler is wired up", async () => {
    const { user } = await renderPanel({ withRefresh: false });

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({ title: "Device Policy Updated" }),
    );
  });

  it("reports a thrown preference update", async () => {
    updateUserPreference.mockRejectedValue(new Error("nope"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Update Failed",
        description: "Failed to update device policy",
      }),
    );
  });
});

describe("grouping details", () => {
  it("adopts a username from a later device for the group", async () => {
    await renderPanel({
      devices: [
        device({ id: 1, username: undefined, deviceIdentifier: "device-1" }),
        device({ id: 2, username: "alice", deviceIdentifier: "device-2" }),
      ],
      users: [preference()],
    });
    const { user } = { user: userEvent.setup({ pointerEventsCheck: 0 }) };

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:u-1:alice")).toBeInTheDocument();
  });

  it("groups a device that has never been seen", async () => {
    await renderPanel({
      devices: [device({ lastSeen: undefined as unknown as string })],
    });

    expect(screen.getByText("order:u-1")).toBeInTheDocument();
  });

  it("orders PlexAmp devices last and among themselves by last stream", async () => {
    const { user } = await renderPanel({
      devices: [
        device({
          id: 1,
          deviceIdentifier: "amp-old",
          deviceProduct: "Plexamp",
          lastSeen: "2025-01-01T00:00:00Z",
        }),
        device({
          id: 2,
          deviceIdentifier: "amp-new",
          deviceName: "Plexamp Kitchen",
          deviceProduct: undefined,
          lastSeen: "2026-01-01T00:00:00Z",
        }),
        device({ id: 3, deviceIdentifier: "tv", status: "approved" }),
        device({ id: 4, deviceIdentifier: "phone", status: "rejected" }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "details u-1" }));

    expect(screen.getByText(/^editing:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "approve u-1" })).toBeVisible();
  });

  it("renders a week and a single trailing day", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant 11520" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        description: "Temporary access granted to 1 device for 1 week and 1 day",
      }),
    );
  });

  it("sorts a user with no devices below one that has streamed", async () => {
    localStorage.setItem("guardian-unified-sort-by", "lastSeen");
    localStorage.setItem("guardian-unified-sort-order", "asc");
    await renderPanel({
      devices: [device({ id: 1, userId: "u-1" })],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    expect(
      screen.getAllByText(/^order:/).map((n) => n.textContent),
    ).toEqual(["order:u-2", "order:u-1"]);
  });

  it("counts a device with no session count as zero streams", async () => {
    localStorage.setItem("guardian-unified-sort-by", "streamCount");
    localStorage.setItem("guardian-unified-sort-order", "desc");
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1", sessionCount: 5 }),
        device({
          id: 2,
          userId: "u-2",
          deviceIdentifier: "device-2",
          sessionCount: undefined,
        }),
      ],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    expect(
      screen.getAllByText(/^order:/).map((n) => n.textContent),
    ).toEqual(["order:u-1", "order:u-2"]);
  });
});

describe("navigation from streams", () => {
  const target = () => {
    const node = document.createElement("div");
    node.setAttribute("data-device-identifier", "device-1");
    node.scrollIntoView = jest.fn();
    document.body.appendChild(node);
    return node;
  };

  afterEach(() => {
    document
      .querySelectorAll("[data-device-identifier]")
      .forEach((node) => node.remove());
  });

  it("scrolls to and highlights the target device, then reports completion", async () => {
    jest.useFakeTimers();
    const node = target();
    const onNavigationComplete = jest.fn();
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "device-1" }}
        onNavigationComplete={onNavigationComplete}
      />,
    );
    await act(async () => {});

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(node.scrollIntoView).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(node).toHaveClass("ring-2");

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(node).not.toHaveClass("ring-2");
    expect(onNavigationComplete).toHaveBeenCalled();
  });

  it("uses the short delay when the group is already expanded", async () => {
    jest.useFakeTimers();
    const node = target();
    const view = render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "device-1" }}
      />,
    );
    await act(async () => {});
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    (node.scrollIntoView as jest.Mock).mockClear();

    view.rerender(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "device-1" }}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(node.scrollIntoView).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2500);
    });
  });

  it("does nothing when the target device is not on the page", async () => {
    jest.useFakeTimers();
    const onNavigationComplete = jest.fn();
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "missing" }}
        onNavigationComplete={onNavigationComplete}
      />,
    );
    await act(async () => {});

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(onNavigationComplete).not.toHaveBeenCalled();
  });
});

describe("hide user dialog", () => {
  it("clears the pending hide when the dialog is dismissed", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toggleUserVisibility).not.toHaveBeenCalled();
  });

  it("refreshes the hidden user list when hiding while the list is open", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: /Show Hidden Users/ }));
    await screen.findByText("No hidden users found");

    fireEvent.click(screen.getByText("hide u-1"));
    fireEvent.click(await screen.findByText("Hide User"));

    await waitFor(() => expect(getHiddenUsers).toHaveBeenCalledTimes(2));
  });
});

describe("comparing against a user with nothing to compare", () => {
  const three = [
    preference({ userId: "u-1" }),
    preference({ id: 2, userId: "u-2" }),
    preference({ id: 3, userId: "u-3" }),
  ];

  it("keeps a user with no devices last by stream date", async () => {
    localStorage.setItem("guardian-unified-sort-by", "lastSeen");
    localStorage.setItem("guardian-unified-sort-order", "desc");
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1", lastSeen: "2026-02-01T00:00:00Z" }),
        device({
          id: 3,
          userId: "u-3",
          deviceIdentifier: "device-3",
          lastSeen: "2026-03-01T00:00:00Z",
        }),
      ],
      users: three,
    });

    expect(
      screen.getAllByText(/^order:/).map((n) => n.textContent),
    ).toEqual(["order:u-3", "order:u-1", "order:u-2"]);
  });

  it("keeps a user with no devices last by stream count", async () => {
    localStorage.setItem("guardian-unified-sort-by", "streamCount");
    localStorage.setItem("guardian-unified-sort-order", "desc");
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1", sessionCount: 2 }),
        device({
          id: 3,
          userId: "u-3",
          deviceIdentifier: "device-3",
          sessionCount: 9,
        }),
      ],
      users: three,
    });

    expect(
      screen.getAllByText(/^order:/).map((n) => n.textContent),
    ).toEqual(["order:u-3", "order:u-1", "order:u-2"]);
  });
});
