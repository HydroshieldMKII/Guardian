import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeRuleRow } from "@/components/device-management/TimeRuleRow";
import type { UserTimeRule } from "@/types";

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule => ({
  id: 1,
  userId: "u-1",
  ruleName: "School hours",
  enabled: true,
  action: "block",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "15:00",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const renderRow = (props: Partial<Parameters<typeof TimeRuleRow>[0]> = {}) => {
  const handlers = {
    onStartEdit: jest.fn(),
    onDraftChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onToggle: jest.fn(),
    onDelete: jest.fn(),
  };
  const view = render(
    <TimeRuleRow
      rule={rule()}
      draft={null}
      busy={false}
      deleting={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers, user: userEvent.setup() };
};

describe("TimeRuleRow", () => {
  it("summarises the rule", () => {
    renderRow();

    expect(screen.getByText("School hours")).toBeInTheDocument();
    expect(screen.getByText("Monday · 09:00 – 15:00")).toBeInTheDocument();
  });

  it("mutes a disabled rule", () => {
    const { container } = renderRow({ rule: rule({ enabled: false }) });

    expect(container.firstChild).toHaveClass("bg-muted/30");
    expect(screen.getByText("School hours")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("locks its actions while it is being deleted", () => {
    renderRow({ deleting: true });

    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });

  it("hands its actions back", async () => {
    const { user, onStartEdit, onDelete, onToggle } = renderRow();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("switch"));

    expect(onStartEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("edits the draft rather than the saved rule", async () => {
    const { user, onDraftChange, onSave, onCancel } = renderRow({
      draft: { ruleName: "Homework" },
    });

    expect(screen.getByPlaceholderText("Rule name")).toHaveValue("Homework");

    await user.type(screen.getByPlaceholderText("Rule name"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDraftChange).toHaveBeenLastCalledWith({ ruleName: "Homework!" });
    expect(onSave).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows the save in progress", () => {
    renderRow({ draft: {}, busy: true });

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
