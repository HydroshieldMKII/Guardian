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
import type { toast as showToast } from "@/hooks/use-toast";

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

const toast = jest.fn<void, Parameters<typeof showToast>>();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const toggleUserVisibility = jest.fn<Promise<unknown>, unknown[]>();
const getHiddenUsers = jest.fn<Promise<unknown>, unknown[]>();
jest.mock("@/lib/api", () => ({
  apiClient: {
    toggleUserVisibility: (...a: unknown[]) => toggleUserVisibility(...a),
    getHiddenUsers: (...a: unknown[]) => getHiddenUsers(...a),
  },
}));

type DetailProps = {
  group: {
    user: { userId: string; username?: string };
    devices: UserDevice[];
  };
  onUpdateUserPreference: (id: string, block: boolean | null) => void;
  onToggleUserVisibility: (id: string) => void;
  onShowHistory: (id: string) => void;
  onGrantUserTemporaryAccess: (id: string) => void;
  onShowTimePolicy: (id: string, deviceIdentifier?: string) => void;
  onApprove: (d: UserDevice) => void;
  onReject: (d: UserDevice) => void;
  onDelete: (d: UserDevice) => void;
  onToggleApproval: (d: UserDevice) => void;
  onShowDetails: (d: UserDevice) => void;
};

jest.mock("@/components/device-management/UserDetail", () => ({
  UserDetail: ({
    group,
    onUpdateUserPreference,
    onToggleUserVisibility,
    onShowHistory,
    onGrantUserTemporaryAccess,
    onShowTimePolicy,
    onApprove,
    onReject,
    onDelete,
    onToggleApproval,
    onShowDetails,
  }: DetailProps) => {
    const id = group.user.userId;
    const device = group.devices[0];
    return (
      <div data-user-id={id}>
        <span>{`detail:${id}`}</span>
        <span>{`devices:${group.devices.map((d) => d.id).join(",")}`}</span>
        {group.devices
          .filter((d) => d.deviceName)
          .map((d) => (
            <div key={d.id} data-device-identifier={d.deviceIdentifier} />
          ))}
        <button onClick={() => onUpdateUserPreference(id, true)}>
          {`block ${id}`}
        </button>
        <button
          onClick={() => onToggleUserVisibility(id)}
        >{`hide ${id}`}</button>
        <button onClick={() => onShowHistory(id)}>{`history ${id}`}</button>
        <button
          onClick={() => onGrantUserTemporaryAccess(id)}
        >{`temp ${id}`}</button>
        <button onClick={() => onGrantUserTemporaryAccess("ghost")}>
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
      <button onClick={() => void onSetPending?.(device?.id ?? 0)}>
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
    confirmAction: {
      action: string;
      title: string;
      description: string;
    } | null;
    onConfirm: () => void;
  }) =>
    confirmAction ? (
      <div>
        <span>{`titled:${confirmAction.title}`}</span>
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

const renderPanel = async (
  props: {
    devices?: UserDevice[];
    users?: UserPreference[];
    settings?: AppSetting[];
    withRefresh?: boolean;
    selectedUserId?: string | null;
  } = {},
) => {
  const onRefresh = jest.fn();
  const view = render(
    <DeviceManagement
      devicesData={devicesData(props.devices ?? [device()])}
      usersData={props.users ?? [preference()]}
      settingsData={props.settings}
      onRefresh={props.withRefresh === false ? undefined : onRefresh}
      selectedUserId={props.selectedUserId}
    />,
  );
  await act(async () => {});
  return {
    ...view,
    onRefresh,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

const renderSelected = (props: Parameters<typeof renderPanel>[0] = {}) =>
  renderPanel({ selectedUserId: "u-1", ...props });

const userList = () => {
  const list = screen.getByRole("button", { name: "Hidden users" })
    .parentElement?.parentElement;
  if (!list) throw new Error("user list not rendered");
  return list;
};

const orderedIds = () =>
  within(userList())
    .queryAllByRole("listitem")
    .map((item) => item.querySelector("span.block")?.textContent);

const lastToast = () => toast.mock.calls.at(-1)?.[0];

const toastWithTitle = (title: string) =>
  toast.mock.calls.map((call) => call[0]).filter((arg) => arg.title === title);

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
    [11520, "1 week and 1 day"],
    [20160, "2 weeks"],
    [12960, "1 week and 2 days"],
    [33120, "3 weeks and 2 days"],
  ];

  it.each(cases)("renders %i minutes as %s", async (minutes, expected) => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: `grant ${minutes}` }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Temporary access granted",
        description: `Temporary access granted to 1 device for ${expected}`,
      }),
    );
  });

  it("pluralises the device count for a batch grant", async () => {
    const { user } = await renderSelected({
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
    const { user } = await renderSelected({
      devices: [device({ id: 1 }), device({ id: 2, deviceIdentifier: "d-2" })],
    });

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant batch" }));

    await waitFor(() =>
      expect(
        toastWithTitle("Some devices were not granted access")[0],
      ).toMatchObject({
        description:
          "1 of 2 devices were granted temporary access. Try the remaining 1 again.",
      }),
    );
  });

  it("stops after reporting a failed batch grant", async () => {
    grantBatchTemporaryAccess.mockResolvedValue({ success: false });
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant batch" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        description: "Failed to grant temporary access to these devices",
      }),
    );
    expect(toastWithTitle("Temporary access granted")).toHaveLength(0);
  });

  it("stops after reporting a failed single grant", async () => {
    grantTemporaryAccess.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "temp u-1" }));
    await user.click(screen.getByRole("button", { name: "grant 60" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        description: "Failed to grant temporary access",
      }),
    );
    expect(toastWithTitle("Temporary access granted")).toHaveLength(0);
  });

  it("ignores a temp access request for a user with no group", async () => {
    const { user } = await renderSelected();

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
    users: [
      preference({ userId: "u-1" }),
      preference({ id: 2, userId: "u-2" }),
    ],
  };

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

  it("defaults to sorting by pending count", async () => {
    await renderPanel(twoUsers);

    expect(orderedIds()).toEqual(["u-1", "u-2"]);
    expect(screen.getByRole("button", { name: "Sort users" })).toHaveAttribute(
      "title",
      "Sorted by pending count",
    );
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
      devices: [device({ id: 1, userId: "u-1", username: undefined })],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    expect(orderedIds()).toEqual(["u-1", "u-2"]);
  });

  it("flips the order from ascending to descending", async () => {
    localStorage.setItem("guardian-unified-sort-by", "deviceCount");
    localStorage.setItem("guardian-unified-sort-order", "asc");
    const { user } = await renderPanel(twoUsers);
    expect(orderedIds()).toEqual(["u-1", "u-2"]);

    await user.click(screen.getByRole("button", { name: "Sort users" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Descending" }),
    );

    expect(orderedIds()).toEqual(["u-2", "u-1"]);
    expect(localStorage.getItem("guardian-unified-sort-order")).toBe("desc");
  });

  it("changes the sort field from the dropdown", async () => {
    const { user } = await renderPanel(twoUsers);

    await user.click(screen.getByRole("button", { name: "Sort users" }));
    await user.click(await screen.findByRole("menuitem", { name: "Username" }));

    await waitFor(() =>
      expect(localStorage.getItem("guardian-unified-sort-by")).toBe("username"),
    );
  });

  it("survives storage that throws", async () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    try {
      await renderPanel(twoUsers);
      expect(orderedIds()).toEqual(["u-1", "u-2"]);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("search filtering", () => {
  it("matches a device with no name by its identifier", async () => {
    const { user } = await renderPanel({
      devices: [
        device({
          id: 1,
          userId: "u-1",
          username: undefined,
          deviceName: undefined,
          deviceIdentifier: "kitchen-box",
        }),
        device({
          id: 2,
          userId: "u-2",
          username: undefined,
          deviceIdentifier: "device-2",
        }),
      ],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    await user.type(screen.getByRole("searchbox"), "kitchen");

    await waitFor(() => expect(orderedIds()).toEqual(["u-1"]));
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

    await user.type(screen.getByRole("searchbox"), "zzz");

    expect(await screen.findByText("No users match")).toBeInTheDocument();
  });

  it("matches on device platform", async () => {
    const { user } = await renderPanel({
      devices: [device({ devicePlatform: "tvOS", deviceProduct: undefined })],
    });

    await user.type(screen.getByRole("searchbox"), "tvos");

    expect(orderedIds()).toEqual(["alex"]);
  });

  it("matches on device product", async () => {
    const { user } = await renderPanel({
      devices: [device({ deviceName: undefined, deviceProduct: "Plexamp" })],
    });

    await user.type(screen.getByRole("searchbox"), "plexamp");

    expect(orderedIds()).toEqual(["alex"]);
  });

  it("treats a blank search as no search", async () => {
    const { user } = await renderPanel();

    await user.type(screen.getByRole("searchbox"), "   ");

    expect(orderedIds()).toEqual(["alex"]);
  });
});

describe("device action failures", () => {
  it("stays quiet when rejecting fails", async () => {
    rejectDevice.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "reject u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(rejectDevice).toHaveBeenCalled());
    expect(toastWithTitle("Device rejected")).toHaveLength(0);
  });

  it("stays quiet when deleting fails", async () => {
    deleteDevice.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "delete u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() => expect(deleteDevice).toHaveBeenCalled());
    expect(toastWithTitle("Device deleted")).toHaveLength(0);
  });

  it("announces a deleted device", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "delete u-1" }));
    await user.click(screen.getByRole("button", { name: "do it" }));

    await waitFor(() =>
      expect(toastWithTitle("Device deleted")).toHaveLength(1),
    );
  });

  it("stays quiet when setting a device back to pending fails", async () => {
    setPendingDevice.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "set pending" }));

    await waitFor(() => expect(setPendingDevice).toHaveBeenCalled());
    expect(toastWithTitle("Device set to pending")).toHaveLength(0);
  });

  it("stays quiet when renaming fails", async () => {
    renameDevice.mockResolvedValue(false);
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));
    await user.click(screen.getByRole("button", { name: "rename device" }));

    await waitFor(() => expect(renameDevice).toHaveBeenCalled());
    expect(screen.getByText("editing:1:TV")).toBeInTheDocument();
  });

  it("rejects an approved device when the approval is toggled", async () => {
    const { user } = await renderSelected({
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
    const { user } = await renderSelected();

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
    const { user } = await renderSelected({
      devices: [device({ deviceName: undefined })],
    });

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));

    expect(screen.getByText("editing:1:empty")).toBeInTheDocument();
  });

  it("clears the draft name when editing is cancelled", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "details u-1" }));
    await user.click(screen.getByRole("button", { name: "start editing" }));
    await user.click(screen.getByRole("button", { name: "cancel editing" }));

    expect(screen.getByText("editing:none:empty")).toBeInTheDocument();
  });
});

describe("confirmation wording", () => {
  it.each([
    ["approve u-1", "Approve device", "able to stream"],
    ["reject u-1", "Reject device", "blocked from streaming"],
    ["delete u-1", "Delete device", "removed for good"],
    ["switch u-1", "Approve device", "able to stream"],
  ])(
    "titles the %s dialog and states the consequence",
    async (button, title, phrase) => {
      const { user } = await renderSelected({
        devices: [device({ deviceName: undefined })],
      });

      await user.click(screen.getByRole("button", { name: button }));

      expect(screen.getByText(`titled:${title}`)).toBeInTheDocument();
      expect(screen.getByText(/^described:/).textContent).toContain(phrase);
    },
  );

  it.each(["approve u-1", "reject u-1", "delete u-1", "switch u-1"])(
    "leaves the device out of the %s description, the dialog shows it",
    async (button) => {
      const { user } = await renderSelected({
        devices: [device({ deviceName: undefined })],
      });

      await user.click(screen.getByRole("button", { name: button }));

      expect(screen.getByText(/^described:/).textContent).not.toContain(
        "device-1",
      );
    },
  );

  it("describes rejecting when toggling an approved device", async () => {
    const { user } = await renderSelected({
      devices: [device({ deviceName: undefined, status: "approved" })],
    });

    await user.click(screen.getByRole("button", { name: "switch u-1" }));

    expect(screen.getByText("titled:Reject device")).toBeInTheDocument();
    expect(screen.getByText(/^described:/).textContent).toContain(
      "blocked from streaming",
    );
  });
});

describe("hidden users", () => {
  it("shows the empty state when nobody is hidden", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));

    expect(
      await screen.findByText("No hidden users found"),
    ).toBeInTheDocument();
  });

  it("logs a failure to load the hidden user list", async () => {
    getHiddenUsers.mockRejectedValue(new Error("nope"));
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

  it("confirms before hiding a visible user", async () => {
    const { user } = await renderSelected({
      users: [preference({ username: "alex" })],
    });

    await user.click(screen.getByRole("button", { name: "hide u-1" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("alex")).toBeInTheDocument();
    expect(toggleUserVisibility).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: /Hide user/ }));

    await waitFor(() =>
      expect(toggleUserVisibility).toHaveBeenCalledWith("u-1"),
    );
    expect(lastToast()).toMatchObject({ title: "User hidden" });
  });

  it("names the user by id when the preference has no username", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("u-1")).toBeInTheDocument();
  });

  it("reports a failure to hide a user", async () => {
    toggleUserVisibility.mockRejectedValue(new Error("nope"));
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Hide user/ }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Error",
        description: "Failed to hide user",
      }),
    );
  });

  it("shows a hidden user again without confirmation", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-2", hidden: true, username: "sam" }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));
    await user.click(await screen.findByRole("button", { name: /Show$/ }));

    await waitFor(() =>
      expect(toggleUserVisibility).toHaveBeenCalledWith("u-2"),
    );
    expect(lastToast()).toMatchObject({
      title: "User shown",
      description: "sam is back in the main user list",
    });
    expect(getHiddenUsers).toHaveBeenCalledTimes(2);
  });

  it("labels a hidden user with no username", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-2", hidden: true }),
    ]);
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));

    expect(await screen.findByText("Unknown username")).toBeInTheDocument();
  });

  it("reports a failure to show a hidden user", async () => {
    getHiddenUsers.mockResolvedValue([
      preference({ userId: "u-2", hidden: true, username: "sam" }),
    ]);
    toggleUserVisibility.mockRejectedValue(new Error("nope"));
    const { user } = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));
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
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:u-1:alex")).toBeInTheDocument();
  });

  it("falls back to the stored preference username", async () => {
    const { user } = await renderSelected({
      devices: [device({ username: undefined })],
      users: [preference({ username: "stored" })],
    });

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:u-1:stored")).toBeInTheDocument();
  });

  it("selects the user and highlights the device the entry points at", async () => {
    jest.useFakeTimers();
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
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
    expect(screen.getByText("detail:u-1")).toBeInTheDocument();
    const target = document.querySelector(
      '[data-device-identifier="device-1"]',
    );

    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(scrollIntoView).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(target).toHaveClass("ring-2");

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(target).not.toHaveClass("ring-2");
  });

  it("uses the short delay when the user is already selected", async () => {
    jest.useFakeTimers();
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    await renderSelected();

    act(() => {
      screen.getByRole("button", { name: "history to device" }).click();
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(scrollIntoView).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
  });

  it("does nothing when the device element is not on the page", async () => {
    jest.useFakeTimers();
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    await renderPanel({ devices: [device({ deviceName: undefined })] });

    act(() => {
      screen.getByRole("button", { name: "history to device" }).click();
    });
    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(toastWithTitle("Device not found")).toHaveLength(0);
  });

  it("warns when the history entry points at an unknown device", async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole("button", { name: "history to missing device" }),
    );

    expect(lastToast()).toMatchObject({
      title: "Device not found",
      variant: "destructive",
    });
  });
});

describe("time policy modal", () => {
  it("ignores a schedule request for a user with no group", async () => {
    const { user } = await renderSelected();

    await user.click(
      screen.getByRole("button", { name: "schedule ghost via u-1" }),
    );

    expect(screen.getByText("time-modal:false:none")).toBeInTheDocument();
  });

  it("asks for no time rules when there are no users", async () => {
    await renderPanel({ devices: [], users: [] });

    expect(useTimeRulesForUsers).toHaveBeenLastCalledWith([]);
  });
});

describe("preference updates without a refresh callback", () => {
  it("still reports success when no refresh handler is wired up", async () => {
    const { user } = await renderSelected({ withRefresh: false });

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Default device policy updated",
      }),
    );
  });

  it("keeps the success message when the reload after an update fails", async () => {
    const { user, onRefresh } = await renderSelected();
    onRefresh.mockRejectedValue(new Error("offline"));

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Default device policy updated",
      }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refresh:",
      expect.any(Error),
    );
  });

  it("reports a thrown preference update", async () => {
    updateUserPreference.mockRejectedValue(new Error("nope"));
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "block u-1" }));

    await waitFor(() =>
      expect(lastToast()).toMatchObject({
        title: "Update failed",
        description: "Failed to update the New devices rule",
      }),
    );
  });
});

describe("grouping details", () => {
  it("adopts a username from a later device for the group", async () => {
    const { user } = await renderSelected({
      devices: [
        device({ id: 1, username: undefined, deviceIdentifier: "device-1" }),
        device({ id: 2, username: "alex", deviceIdentifier: "device-2" }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "history u-1" }));

    expect(screen.getByText("history-modal:u-1:alex")).toBeInTheDocument();
  });

  it("groups a device that has never been seen", async () => {
    await renderPanel({
      devices: [device({ lastSeen: undefined })],
    });

    expect(orderedIds()).toEqual(["alex"]);
  });

  it("orders devices waiting, rejected, approved, then Plexamp by last stream", async () => {
    await renderSelected({
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
          deviceProduct: "plexamp",
          lastSeen: "2026-01-01T00:00:00Z",
        }),
        device({ id: 3, deviceIdentifier: "tv", status: "approved" }),
        device({ id: 4, deviceIdentifier: "phone", status: "rejected" }),
        device({
          id: 5,
          deviceIdentifier: "old-pending",
          lastSeen: "2025-01-01T00:00:00Z",
        }),
        device({ id: 6, deviceIdentifier: "new-pending" }),
      ],
    });

    expect(screen.getByText("devices:6,5,4,3,2,1")).toBeInTheDocument();
  });

  it("sorts a user with no devices below one that has streamed", async () => {
    localStorage.setItem("guardian-unified-sort-by", "lastSeen");
    localStorage.setItem("guardian-unified-sort-order", "asc");
    await renderPanel({
      devices: [device({ id: 1, userId: "u-1", username: undefined })],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    expect(orderedIds()).toEqual(["u-2", "u-1"]);
  });

  it("counts a device with no session count as zero streams", async () => {
    localStorage.setItem("guardian-unified-sort-by", "streamCount");
    localStorage.setItem("guardian-unified-sort-order", "desc");
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1", username: undefined, sessionCount: 5 }),
        device({
          id: 2,
          userId: "u-2",
          username: undefined,
          deviceIdentifier: "device-2",
          sessionCount: undefined,
        }),
      ],
      users: [
        preference({ userId: "u-1" }),
        preference({ id: 2, userId: "u-2" }),
      ],
    });

    expect(orderedIds()).toEqual(["u-1", "u-2"]);
  });

  it("names a user with no devices from their preference", async () => {
    await renderPanel({
      devices: [],
      users: [preference({ userId: "u-7", username: "robin" })],
    });

    expect(orderedIds()).toEqual(["robin"]);
  });
});

describe("navigation from streams", () => {
  const scrollIntoView = jest.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it("scrolls to and highlights the target device, then reports completion", async () => {
    jest.useFakeTimers();
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
    const node = document.querySelector('[data-device-identifier="device-1"]');

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(scrollIntoView).toHaveBeenCalled();

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

  it("completes without a callback", async () => {
    jest.useFakeTimers();
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "device-1" }}
      />,
    );
    await act(async () => {});

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("uses the short delay when the user is already selected", async () => {
    jest.useFakeTimers();
    const panel = (target: { userId: string; deviceIdentifier: string }) => (
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        onRefresh={jest.fn()}
        navigationTarget={target}
      />
    );
    const view = render(panel({ userId: "u-1", deviceIdentifier: "device-1" }));
    await act(async () => {});
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    scrollIntoView.mockClear();

    view.rerender(panel({ userId: "u-1", deviceIdentifier: "device-1" }));
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(scrollIntoView).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2500);
    });
  });

  it("asks a controlling parent to select the target user", async () => {
    jest.useFakeTimers();
    const onSelectUser = jest.fn();
    render(
      <DeviceManagement
        devicesData={devicesData([device()])}
        usersData={[preference()]}
        navigationTarget={{ userId: "u-1", deviceIdentifier: "device-1" }}
        selectedUserId={null}
        onSelectUser={onSelectUser}
      />,
    );
    await act(async () => {});

    expect(onSelectUser).toHaveBeenCalledWith("u-1");

    act(() => {
      jest.advanceTimersByTime(2500);
    });
  });
});

describe("hide user dialog", () => {
  it("clears the pending hide when the dialog is dismissed", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "hide u-1" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toggleUserVisibility).not.toHaveBeenCalled();
  });

  it("refreshes the hidden user list when hiding while the list is open", async () => {
    const { user } = await renderSelected();

    await user.click(screen.getByRole("button", { name: "Hidden users" }));
    await screen.findByText("No hidden users found");

    fireEvent.click(screen.getByText("hide u-1"));
    fireEvent.click(await screen.findByText("Hide user"));

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
        device({
          id: 1,
          userId: "u-1",
          username: undefined,
          lastSeen: "2026-02-01T00:00:00Z",
        }),
        device({
          id: 3,
          userId: "u-3",
          username: undefined,
          deviceIdentifier: "device-3",
          lastSeen: "2026-03-01T00:00:00Z",
        }),
      ],
      users: three,
    });

    expect(orderedIds()).toEqual(["u-3", "u-1", "u-2"]);
  });

  it("keeps a user with no devices last by stream count", async () => {
    localStorage.setItem("guardian-unified-sort-by", "streamCount");
    localStorage.setItem("guardian-unified-sort-order", "desc");
    await renderPanel({
      devices: [
        device({ id: 1, userId: "u-1", username: undefined, sessionCount: 2 }),
        device({
          id: 3,
          userId: "u-3",
          username: undefined,
          deviceIdentifier: "device-3",
          sessionCount: 9,
        }),
      ],
      users: three,
    });

    expect(orderedIds()).toEqual(["u-3", "u-1", "u-2"]);
  });
});
