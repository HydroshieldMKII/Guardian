import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import { TemporaryAccessModal } from "@/components/device-management/TemporaryAccessModal";

const convertToMinutes = jest.fn();
const isValidDuration = jest.fn();
const hasTemporaryAccess = jest.fn();

jest.mock("@/hooks/device-management/useDeviceUtils", () => ({
  useDeviceUtils: () => ({
    convertToMinutes,
    isValidDuration,
    hasTemporaryAccess,
  }),
}));

jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    selected,
    onSelect,
    disabled,
  }: {
    selected?: Date;
    onSelect: (date?: Date) => void;
    disabled: (date: Date) => boolean;
  }) => (
    <div>
      <span>{`calendar:${selected ? selected.toISOString() : "none"}`}</span>
      <span>{`past-disabled:${disabled(new Date(Date.now() - 86400000))}`}</span>
      <button onClick={() => onSelect(new Date(Date.now() + 3 * 86400000))}>
        pick date
      </button>
      <button onClick={() => onSelect(undefined)}>clear date</button>
    </div>
  ),
}));

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "TV",
  devicePlatform: "Roku",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 1,
  ...overrides,
});

const renderModal = (
  props: {
    user?: { userId: string; username?: string } | null;
    userDevices?: UserDevice[];
    isOpen?: boolean;
    actionLoading?: number | null;
    shouldShowGrantTempAccess?: (device: UserDevice) => boolean;
  } = {},
) => {
  const onClose = jest.fn();
  const onGrantAccess = jest.fn();
  const view = render(
    <TemporaryAccessModal
      user={
        props.user === undefined
          ? { userId: "u-1", username: "testuser" }
          : props.user
      }
      userDevices={props.userDevices ?? [device()]}
      isOpen={props.isOpen ?? true}
      onClose={onClose}
      onGrantAccess={onGrantAccess}
      actionLoading={props.actionLoading ?? null}
      shouldShowGrantTempAccess={
        props.shouldShowGrantTempAccess ?? (() => true)
      }
    />,
  );
  return { ...view, onClose, onGrantAccess, user: userEvent.setup() };
};

const selectDevice = async (
  user: ReturnType<typeof userEvent.setup>,
  name = "TV",
) => user.click(screen.getByText(name));

beforeEach(() => {
  jest.clearAllMocks();
  convertToMinutes.mockImplementation((value: number, unit: string) => {
    const factor =
      unit === "minutes"
        ? 1
        : unit === "hours"
          ? 60
          : unit === "days"
            ? 1440
            : 10080;
    return value * factor;
  });
  isValidDuration.mockReturnValue(true);
  hasTemporaryAccess.mockReturnValue(false);
});

describe("TemporaryAccessModal", () => {
  it("renders nothing without a user", () => {
    const { container } = renderModal({ user: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("names the user", () => {
    renderModal();
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("falls back to the user id", () => {
    renderModal({ user: { userId: "u-9" } });
    expect(screen.getByText("u-9")).toBeInTheDocument();
  });

  describe("device selection", () => {
    it("lists only eligible devices", () => {
      renderModal({
        userDevices: [
          device({ id: 1, deviceName: "TV" }),
          device({ id: 2, deviceName: "Phone" }),
        ],
        shouldShowGrantTempAccess: (d) => d.id === 1,
      });

      expect(screen.getByText("TV")).toBeInTheDocument();
      expect(screen.queryByText("Phone")).toBeNull();
    });

    it("says when none are eligible", () => {
      renderModal({ shouldShowGrantTempAccess: () => false });

      expect(
        screen.getByText("No devices eligible for temporary access"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Select All/ })).toBeNull();
    });

    it("falls back to the identifier for an unnamed device", () => {
      renderModal({ userDevices: [device({ deviceName: undefined })] });
      expect(screen.getByText("device-1")).toBeInTheDocument();
    });

    it("flags a device that already has temporary access", () => {
      hasTemporaryAccess.mockReturnValue(true);
      renderModal();
      expect(screen.getByText("Has temporary access")).toBeInTheDocument();
    });

    it("counts the selection", async () => {
      const { user } = renderModal();
      expect(screen.getByText(/\(0 selected\)/)).toBeInTheDocument();

      await selectDevice(user);
      expect(screen.getByText(/\(1 selected\)/)).toBeInTheDocument();
    });

    it("toggles a device off again", async () => {
      const { user } = renderModal();

      await selectDevice(user);
      await selectDevice(user);

      expect(screen.getByText(/\(0 selected\)/)).toBeInTheDocument();
    });

    it("selects and deselects everything", async () => {
      const { user } = renderModal({
        userDevices: [
          device({ id: 1, deviceName: "TV" }),
          device({ id: 2, deviceName: "Phone" }),
        ],
      });

      await user.click(screen.getByRole("button", { name: "Select All" }));
      expect(screen.getByText(/\(2 selected\)/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Deselect All" }));
      expect(screen.getByText(/\(0 selected\)/)).toBeInTheDocument();
    });

    it("hides the duration and bypass sections until something is selected", async () => {
      const { user } = renderModal();
      expect(screen.queryByText("Access Duration")).toBeNull();
      expect(screen.queryByText("Policy Bypass")).toBeNull();

      await selectDevice(user);

      expect(screen.getByText("Access Duration")).toBeInTheDocument();
      expect(screen.getByText("Policy Bypass")).toBeInTheDocument();
    });
  });

  describe("duration mode", () => {
    it("offers quick durations", async () => {
      const { user, onGrantAccess } = renderModal();
      await selectDevice(user);

      await user.click(screen.getByRole("button", { name: "1d" }));
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith([1], 1440, false);
    });

    it.each([
      ["1h", 60],
      ["3h", 180],
      ["6h", 360],
      ["1w", 10080],
    ])("%s converts to %p minutes", async (label, expected) => {
      const { user, onGrantAccess } = renderModal();
      await selectDevice(user);

      await user.click(screen.getByRole("button", { name: label }));
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith([1], expected, false);
    });

    it("accepts a typed duration", async () => {
      const { user, onGrantAccess } = renderModal();
      await selectDevice(user);

      const input = screen.getByPlaceholderText("Enter duration");
      await user.clear(input);
      await user.type(input, "5");
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith([1], 300, false);
    });

    it("changes the unit", async () => {
      const { user, onGrantAccess } = renderModal();
      await selectDevice(user);

      await user.click(screen.getByRole("button", { name: /hours/ }));
      await user.click(await screen.findByText("minutes"));
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith([1], 1, false);
    });

    it.each([
      ["minutes", 1],
      ["days", 1440],
      ["weeks", 10080],
    ])("switches the unit to %s", async (unit, expected) => {
      const { user, onGrantAccess } = renderModal();
      await selectDevice(user);

      await user.click(screen.getByRole("button", { name: /hours/ }));
      await user.click(await screen.findByText(unit));
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith([1], expected, false);
    });

    it("complains about a non-positive duration", async () => {
      const { user } = renderModal();
      await selectDevice(user);

      const input = screen.getByPlaceholderText("Enter duration");
      await user.clear(input);
      await user.type(input, "0");

      expect(
        screen.getByText("Please enter a valid duration"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Grant Access/ }),
      ).toBeDisabled();
    });

    it("warns when the duration overflows the calendar", async () => {
      convertToMinutes.mockReturnValue(Number.MAX_SAFE_INTEGER);
      const { user } = renderModal();
      await selectDevice(user);

      expect(screen.getByText(/Duration is too large/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Grant Access/ }),
      ).toBeDisabled();
    });

    it("blocks a unit the hook rejects", async () => {
      isValidDuration.mockReturnValue(false);
      const { user } = renderModal();
      await selectDevice(user);

      expect(
        screen.getByRole("button", { name: /Grant Access/ }),
      ).toBeDisabled();
    });

    it("previews the expiry", async () => {
      const { user } = renderModal();
      await selectDevice(user);

      expect(screen.getByText("Access will expire at:")).toBeInTheDocument();
    });
  });

  describe("calendar mode", () => {
    const openCalendar = async (user: ReturnType<typeof userEvent.setup>) => {
      await selectDevice(user);
      await user.click(screen.getByRole("button", { name: /Calendar/ }));
      await user.click(
        screen.getByRole("button", { name: /Pick a date and time/ }),
      );
    };

    it("starts with no date chosen", async () => {
      const { user } = renderModal();
      await openCalendar(user);

      expect(screen.getByText("calendar:none")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Grant Access/ }),
      ).toBeDisabled();
    });

    it("disables dates in the past", async () => {
      const { user } = renderModal();
      await openCalendar(user);

      expect(screen.getByText("past-disabled:true")).toBeInTheDocument();
    });

    it("grants until the chosen date", async () => {
      const { user, onGrantAccess } = renderModal();
      await openCalendar(user);

      await user.click(screen.getByRole("button", { name: "pick date" }));
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith(
        [1],
        expect.any(Number),
        false,
      );
      expect(onGrantAccess.mock.calls[0][1]).toBeGreaterThan(0);
    });

    it("clears a chosen date", async () => {
      const { user } = renderModal();
      await openCalendar(user);

      await user.click(screen.getByRole("button", { name: "pick date" }));
      await user.click(screen.getByRole("button", { name: "clear date" }));

      expect(screen.getByText("calendar:none")).toBeInTheDocument();
    });

    it("adjusts the hour and minute", async () => {
      const { user } = renderModal();
      await openCalendar(user);
      await user.click(screen.getByRole("button", { name: "pick date" }));

      const hours = screen.getByPlaceholderText("HH");
      await user.clear(hours);
      await user.type(hours, "23");

      const minutes = screen.getByPlaceholderText("MM");
      await user.clear(minutes);
      await user.type(minutes, "45");

      expect(screen.getByText(/calendar:/)).toBeInTheDocument();
    });

    it("clamps out-of-range time entries", async () => {
      const { user } = renderModal();
      await openCalendar(user);
      await user.click(screen.getByRole("button", { name: "pick date" }));

      fireEvent.change(screen.getByPlaceholderText("HH"), {
        target: { value: "99" },
      });
      fireEvent.change(screen.getByPlaceholderText("MM"), {
        target: { value: "99" },
      });

      expect(screen.getByText(/calendar:/)).toBeInTheDocument();
    });

    it("treats an unparseable time as zero", async () => {
      const { user } = renderModal();
      await openCalendar(user);
      await user.click(screen.getByRole("button", { name: "pick date" }));

      fireEvent.change(screen.getByPlaceholderText("HH"), {
        target: { value: "" },
      });

      expect(screen.getByText(/calendar:/)).toBeInTheDocument();
    });

    it("switches back to duration mode", async () => {
      const { user } = renderModal();
      await selectDevice(user);

      await user.click(screen.getByRole("button", { name: /Calendar/ }));
      await user.click(screen.getByRole("button", { name: /^Duration$/ }));

      expect(screen.getByPlaceholderText("Enter duration")).toBeInTheDocument();
    });
  });

  describe("policy bypass", () => {
    it("passes the flag through", async () => {
      const { user, onGrantAccess } = renderModal();
      await selectDevice(user);

      await user.click(screen.getByRole("switch"));
      await user.click(screen.getByRole("button", { name: /Grant Access/ }));

      expect(onGrantAccess).toHaveBeenCalledWith([1], 60, true);
    });
  });

  describe("footer", () => {
    it("cancels", async () => {
      const { user, onClose } = renderModal();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
    });

    it("blocks granting with nothing selected", () => {
      renderModal();
      expect(
        screen.getByRole("button", { name: /Grant Access/ }),
      ).toBeDisabled();
    });

    it("shows progress and locks both buttons while granting", () => {
      renderModal({ actionLoading: 1 });

      expect(screen.getByText("Granting Access...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });
  });

  it("resets its state each time it reopens", async () => {
    const { user, rerender } = renderModal();
    await selectDevice(user);
    expect(screen.getByText(/\(1 selected\)/)).toBeInTheDocument();

    const props = (isOpen: boolean) => (
      <TemporaryAccessModal
        user={{ userId: "u-1", username: "testuser" }}
        userDevices={[device()]}
        isOpen={isOpen}
        onClose={jest.fn()}
        onGrantAccess={jest.fn()}
        actionLoading={null}
        shouldShowGrantTempAccess={() => true}
      />
    );

    rerender(props(false));
    rerender(props(true));

    expect(screen.getByText(/\(0 selected\)/)).toBeInTheDocument();
  });
});
