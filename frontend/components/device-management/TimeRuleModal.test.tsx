import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeRuleModal } from "@/components/device-management/TimeRuleModal";

const getTimeRules = jest.fn();
const createTimeRule = jest.fn();
const updateTimeRule = jest.fn();
const deleteTimeRule = jest.fn();
const createPreset = jest.fn();

jest.mock("@/hooks/device-management/useTimeRules", () => ({
  useTimeRules: () => ({
    getTimeRules,
    createTimeRule,
    updateTimeRule,
    deleteTimeRule,
    createPreset,
    loading: false,
  }),
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

jest.mock("@/components/ui/confirmation-modal", () => ({
  ConfirmationModal: ({
    isOpen,
    title,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>{`dialog:${title}`}</span>
        <button onClick={() => onConfirm()}>confirm dialog</button>
        <button onClick={() => onClose()}>cancel dialog</button>
      </div>
    ) : null,
}));

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: "u-1",
  ruleName: "School hours",
  enabled: true,
  action: "block",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "15:00",
  ...overrides,
});

const renderModal = async (
  props: { deviceIdentifier?: string; isOpen?: boolean } = {},
) => {
  const onClose = jest.fn();
  const view = render(
    <TimeRuleModal
      isOpen={props.isOpen ?? true}
      onClose={onClose}
      userId="u-1"
      username="testuser"
      deviceIdentifier={props.deviceIdentifier}
    />,
  );
  await act(async () => {});
  return {
    ...view,
    onClose,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  getTimeRules.mockResolvedValue([]);
  createTimeRule.mockImplementation(async (_userId, dto) => ({
    id: 99,
    userId: "u-1",
    enabled: true,
    ...dto,
  }));
  updateTimeRule.mockResolvedValue(undefined);
  deleteTimeRule.mockResolvedValue(undefined);
  createPreset.mockResolvedValue([rule({ id: 2 })]);
});

afterEach(() => consoleError.mockRestore());

describe("TimeRuleModal loading", () => {
  it("loads rules when it opens", async () => {
    await renderModal();
    expect(getTimeRules).toHaveBeenCalledWith("u-1", undefined);
  });

  it("scopes the load to a device when one is given", async () => {
    await renderModal({ deviceIdentifier: "device-1" });
    expect(getTimeRules).toHaveBeenCalledWith("u-1", "device-1");
  });

  it("loads nothing while closed", async () => {
    await renderModal({ isOpen: false });
    expect(getTimeRules).not.toHaveBeenCalled();
  });

  it("says when there are no rules", async () => {
    await renderModal();
    expect(
      screen.getByText("No blocking rules configured."),
    ).toBeInTheDocument();
  });

  it("lists existing rules", async () => {
    getTimeRules.mockResolvedValue([rule()]);
    await renderModal();
    expect(screen.getByText("School hours")).toBeInTheDocument();
  });

  it("sorts by day then start time", async () => {
    getTimeRules.mockResolvedValue([
      rule({
        id: 1,
        ruleName: "Tuesday late",
        dayOfWeek: 2,
        startTime: "18:00",
      }),
      rule({
        id: 2,
        ruleName: "Monday late",
        dayOfWeek: 1,
        startTime: "18:00",
      }),
      rule({
        id: 3,
        ruleName: "Monday early",
        dayOfWeek: 1,
        startTime: "08:00",
      }),
    ]);
    await renderModal();

    const names = Array.from(
      document.querySelectorAll("span.font-medium.truncate"),
    ).map((el) => el.textContent);
    expect(names.indexOf("Monday early")).toBeLessThan(
      names.indexOf("Monday late"),
    );
    expect(names.indexOf("Monday late")).toBeLessThan(
      names.indexOf("Tuesday late"),
    );
  });

  it("reports a load failure", async () => {
    getTimeRules.mockRejectedValue(new Error("offline"));
    await renderModal();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Failed to load blocking rules" }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load rules:",
      expect.any(Error),
    );
  });

  it("closes from the footer", async () => {
    const { user, onClose } = await renderModal();
    const buttons = screen.getAllByRole("button", { name: "Close" });
    await user.click(buttons[buttons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TimeRuleModal creating a rule", () => {
  const nameField = () =>
    screen.getByPlaceholderText("e.g. School hours, Sleep time, Work hours");

  it("refuses an empty name", async () => {
    const { user } = await renderModal();

    expect(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    ).toBeDisabled();
    expect(createTimeRule).not.toHaveBeenCalled();
  });

  it("creates and clears the form", async () => {
    const { user } = await renderModal();

    await user.type(nameField(), "Sleep time");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(createTimeRule).toHaveBeenCalledWith(
        "u-1",
        expect.objectContaining({
          ruleName: "Sleep time",
          action: "block",
          startTime: "10:00",
          endTime: "15:00",
        }),
      ),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rule Created" }),
    );
    expect(nameField()).toHaveValue("");
  });

  it("carries the device identifier through", async () => {
    const { user } = await renderModal({ deviceIdentifier: "device-1" });

    await user.type(nameField(), "Sleep time");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(createTimeRule).toHaveBeenCalledWith(
        "u-1",
        expect.objectContaining({ deviceIdentifier: "device-1" }),
      ),
    );
  });

  it("refuses a rule that overlaps an existing one", async () => {
    getTimeRules.mockResolvedValue([
      rule({ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }),
    ]);
    const { user } = await renderModal();

    await user.type(nameField(), "Overlapping");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Time Conflict" }),
      ),
    );
    expect(createTimeRule).not.toHaveBeenCalled();
  });

  it("allows a rule that only touches an existing one", async () => {
    getTimeRules.mockResolvedValue([
      rule({ dayOfWeek: 0, startTime: "15:00", endTime: "17:00" }),
    ]);
    const { user } = await renderModal();

    await user.type(nameField(), "Adjacent");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() => expect(createTimeRule).toHaveBeenCalled());
  });

  it("allows the same times on a different day", async () => {
    getTimeRules.mockResolvedValue([
      rule({ dayOfWeek: 3, startTime: "10:00", endTime: "15:00" }),
    ]);
    const { user } = await renderModal();

    await user.type(nameField(), "Other day");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() => expect(createTimeRule).toHaveBeenCalled());
  });

  it("reports a server failure", async () => {
    createTimeRule.mockRejectedValue(new Error("server said no"));
    const { user } = await renderModal();

    await user.type(nameField(), "Sleep time");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "server said no" }),
      ),
    );
  });

  it("falls back to a generic failure message", async () => {
    createTimeRule.mockRejectedValue({});
    const { user } = await renderModal();

    await user.type(nameField(), "Sleep time");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to create rule" }),
      ),
    );
  });

  it("edits the time range", async () => {
    const { user } = await renderModal();
    const times =
      document.querySelectorAll<HTMLInputElement>('input[type="time"]');

    await user.clear(times[0]);
    await user.type(times[0], "08:30");
    await user.clear(times[1]);
    await user.type(times[1], "12:45");

    await user.type(nameField(), "Morning");
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(createTimeRule).toHaveBeenCalledWith(
        "u-1",
        expect.objectContaining({ startTime: "08:30", endTime: "12:45" }),
      ),
    );
  });

  it("picks a different day", async () => {
    const { user } = await renderModal();

    await user.type(nameField(), "Friday rule");
    await user.click(screen.getByRole("button", { name: /Sunday/ }));
    await user.click(await screen.findByText("Friday"));
    await user.click(
      screen.getByRole("button", { name: /Create Blocking Rule/ }),
    );

    await waitFor(() =>
      expect(createTimeRule).toHaveBeenCalledWith(
        "u-1",
        expect.objectContaining({ dayOfWeek: 5 }),
      ),
    );
  });
});

describe("TimeRuleModal editing a rule", () => {
  beforeEach(() => {
    getTimeRules.mockResolvedValue([rule()]);
  });

  const startEditing = async (user: ReturnType<typeof userEvent.setup>) => {
    const buttons = screen.getAllByRole("button");
    const edit = buttons.find((b) => b.querySelector(".lucide-square-pen"));
    await user.click(edit as HTMLElement);
  };

  it("opens an editor", async () => {
    const { user } = await renderModal();

    await startEditing(user);

    expect(screen.getByPlaceholderText("Rule name")).toHaveValue(
      "School hours",
    );
  });

  it("saves the edit", async () => {
    const { user } = await renderModal();
    await startEditing(user);

    await user.type(screen.getByPlaceholderText("Rule name"), "!");
    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(updateTimeRule).toHaveBeenCalledWith(
        "u-1",
        1,
        expect.objectContaining({ ruleName: "School hours!" }),
      ),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rule Updated" }),
    );
  });

  it("edits the day and times of an existing rule", async () => {
    const { user } = await renderModal();
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: /Monday/ }));
    await user.click(await screen.findByText("Thursday"));

    const times =
      document.querySelectorAll<HTMLInputElement>('input[type="time"]');
    await user.clear(times[0]);
    await user.type(times[0], "07:15");
    await user.tab();

    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(updateTimeRule).toHaveBeenCalledWith(
        "u-1",
        1,
        expect.objectContaining({ dayOfWeek: 4 }),
      ),
    );
  });

  it("reports a toggle failure", async () => {
    updateTimeRule.mockRejectedValue(new Error("server said no"));
    const { user } = await renderModal();

    await user.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("cancels the edit", async () => {
    const { user } = await renderModal();
    await startEditing(user);

    const cancel = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-x"));
    await user.click(cancel as HTMLElement);

    expect(screen.queryByPlaceholderText("Rule name")).toBeNull();
    expect(updateTimeRule).not.toHaveBeenCalled();
  });

  it("refuses an edit that overlaps another rule", async () => {
    getTimeRules.mockResolvedValue([
      rule({ id: 1, dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }),
      rule({
        id: 2,
        ruleName: "Afternoon",
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "13:00",
      }),
    ]);
    const { user } = await renderModal();
    await startEditing(user);

    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Time Conflict" }),
      ),
    );
    expect(updateTimeRule).not.toHaveBeenCalled();
  });

  it("falls back to a generic save failure message", async () => {
    updateTimeRule.mockRejectedValue({});
    const { user } = await renderModal();
    await startEditing(user);

    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to update rule" }),
      ),
    );
  });

  it("reports a save failure", async () => {
    updateTimeRule.mockRejectedValue(new Error("server said no"));
    const { user } = await renderModal();
    await startEditing(user);

    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "server said no" }),
      ),
    );
  });

  it("toggles a rule on and off", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(updateTimeRule).toHaveBeenCalledWith("u-1", 1, {
        enabled: false,
      }),
    );
  });
});

describe("TimeRuleModal deleting", () => {
  beforeEach(() => {
    getTimeRules.mockResolvedValue([rule()]);
  });

  it("deletes a single rule", async () => {
    const { user } = await renderModal();
    const trashButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-trash-2"));
    const trash = trashButtons[trashButtons.length - 1];

    await user.click(trash as HTMLElement);

    await waitFor(() => expect(deleteTimeRule).toHaveBeenCalledWith("u-1", 1));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rule Deleted" }),
    );
  });

  it("reports a delete failure", async () => {
    deleteTimeRule.mockRejectedValue(new Error("server said no"));
    const { user } = await renderModal();
    const trashButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-trash-2"));
    const trash = trashButtons[trashButtons.length - 1];

    await user.click(trash as HTMLElement);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "server said no" }),
      ),
    );
  });

  it("falls back to a generic delete failure message", async () => {
    deleteTimeRule.mockRejectedValue({});
    const { user } = await renderModal();
    const trashButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-trash-2"));

    await user.click(trashButtons[trashButtons.length - 1]);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete rule" }),
      ),
    );
  });

  it("offers no delete-all control when there is nothing to delete", async () => {
    getTimeRules.mockResolvedValue([]);
    await renderModal();

    expect(screen.queryByRole("button", { name: /Delete All/ })).toBeNull();
  });

  it("falls back to a generic delete-all failure message", async () => {
    deleteTimeRule.mockRejectedValue({});
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: /Delete All/ }));
    await user.click(screen.getByText("confirm dialog"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete all rules" }),
      ),
    );
  });

  it("deletes every rule after confirmation", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: /Delete All/ }));
    expect(
      screen.getByText("dialog:Delete All Blocking Rules?"),
    ).toBeInTheDocument();

    await user.click(screen.getByText("confirm dialog"));

    await waitFor(() => expect(deleteTimeRule).toHaveBeenCalledWith("u-1", 1));
  });

  it("can abandon deleting every rule", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: /Delete All/ }));
    await user.click(screen.getByText("cancel dialog"));

    expect(screen.queryByText(/^dialog:/)).toBeNull();
    expect(deleteTimeRule).not.toHaveBeenCalled();
  });

  it("reports a failure deleting every rule", async () => {
    deleteTimeRule.mockRejectedValue(new Error("server said no"));
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: /Delete All/ }));
    await user.click(screen.getByText("confirm dialog"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });
});

describe("TimeRuleModal presets", () => {
  it.each([
    ["Weekdays Only", "weekdays-only"],
    ["Weekends Only", "weekends-only"],
  ])("applies the %s preset", async (label, presetType) => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: label }));
    expect(
      screen.getByText(`dialog:Apply ${presetType} Preset?`),
    ).toBeInTheDocument();

    await user.click(screen.getByText("confirm dialog"));

    await waitFor(() =>
      expect(createPreset).toHaveBeenCalledWith("u-1", presetType, undefined),
    );
  });

  it("can be abandoned", async () => {
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: "Weekdays Only" }));
    await user.click(screen.getByText("cancel dialog"));

    expect(createPreset).not.toHaveBeenCalled();
  });

  it("falls back to a generic preset failure message", async () => {
    createPreset.mockRejectedValue({});
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: "Weekdays Only" }));
    await user.click(screen.getByText("confirm dialog"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to create weekdays-only preset",
        }),
      ),
    );
  });

  it("labels a rule on an unrecognised day as unknown", async () => {
    getTimeRules.mockResolvedValue([
      rule({ id: 1, dayOfWeek: 9, startTime: "09:00", endTime: "12:00" }),
      rule({
        id: 2,
        ruleName: "Clash",
        dayOfWeek: 9,
        startTime: "10:00",
        endTime: "13:00",
      }),
    ]);
    const { user } = await renderModal();
    const buttons = screen.getAllByRole("button");
    await user.click(
      buttons.find((b) => b.querySelector(".lucide-square-pen")) as HTMLElement,
    );

    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("Unknown"),
        }),
      ),
    );
  });

  it("reports a preset failure", async () => {
    createPreset.mockRejectedValue(new Error("server said no"));
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: "Weekdays Only" }));
    await user.click(screen.getByText("confirm dialog"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });
});

describe("TimeRuleModal with several rules", () => {
  const twoRules = [
    rule({ id: 1, ruleName: "School hours", dayOfWeek: 1 }),
    rule({
      id: 2,
      ruleName: "Bedtime",
      dayOfWeek: 3,
      startTime: "20:00",
      endTime: "22:00",
    }),
  ];

  const editRuleNamed = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) => {
    const card = screen.getByText(name).closest("div[class]") as HTMLElement;
    const buttons = Array.from(
      card.querySelectorAll<HTMLElement>("button"),
    ).concat(screen.getAllByRole("button"));
    const edit = buttons.find((b) => b.querySelector(".lucide-square-pen"));
    await user.click(edit as HTMLElement);
  };

  beforeEach(() => {
    getTimeRules.mockResolvedValue(twoRules);
  });

  it("only edits the rule that was opened", async () => {
    const { user } = await renderModal();

    await editRuleNamed(user, "School hours");
    await user.type(screen.getByPlaceholderText("Rule name"), "!");

    expect(screen.getAllByPlaceholderText("Rule name")).toHaveLength(1);
    expect(screen.getByText("Bedtime")).toBeInTheDocument();
  });

  it("leaves the other rules untouched when one is saved", async () => {
    const { user } = await renderModal();

    await editRuleNamed(user, "School hours");
    await user.type(screen.getByPlaceholderText("Rule name"), "!");
    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(updateTimeRule).toHaveBeenCalledWith(
        "u-1",
        1,
        expect.objectContaining({ ruleName: "School hours!" }),
      ),
    );
    expect(screen.getByText("Bedtime")).toBeInTheDocument();
  });

  it("saves an unchanged edit with the rule's own values", async () => {
    const { user } = await renderModal();

    await editRuleNamed(user, "School hours");
    const save = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    await user.click(save as HTMLElement);

    await waitFor(() =>
      expect(updateTimeRule).toHaveBeenCalledWith("u-1", 1, {
        ruleName: "School hours",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "15:00",
        enabled: true,
      }),
    );
  });

  it("only toggles the rule whose switch was flipped", async () => {
    const { user } = await renderModal();

    await user.click(screen.getAllByRole("switch")[1]);

    await waitFor(() =>
      expect(updateTimeRule).toHaveBeenCalledWith("u-1", 2, { enabled: false }),
    );
  });

  it("falls back to a generic message when a toggle fails without one", async () => {
    updateTimeRule.mockRejectedValue({});
    const { user } = await renderModal();

    await user.click(screen.getAllByRole("switch")[0]);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to update rule" }),
      ),
    );
  });
});

describe("TimeRuleModal guards", () => {
  it("ignores a second preset request while one is in flight", async () => {
    let release: (value: unknown[]) => void = () => {};
    createPreset.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { user } = await renderModal();

    await user.click(screen.getByRole("button", { name: "Weekdays Only" }));
    await user.click(screen.getByText("confirm dialog"));
    await waitFor(() => expect(createPreset).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Weekends Only" }));
    await user.click(screen.getByText("confirm dialog"));

    expect(createPreset).toHaveBeenCalledTimes(1);

    await act(async () => {
      release([]);
    });
  });
});
