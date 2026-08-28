import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, Trash2 } from "lucide-react";
import { ActionMenu, type Action } from "@/components/ui/action-menu";

const approve = jest.fn();
const remove = jest.fn();

const actions: Action[] = [
  { label: "Approve", icon: Check, tone: "positive", onSelect: approve },
];

const destructive: Action = {
  label: "Delete",
  icon: Trash2,
  tone: "danger",
  onSelect: remove,
};

const renderMenu = (
  props: Partial<React.ComponentProps<typeof ActionMenu>> = {},
) => {
  const view = render(<ActionMenu actions={actions} {...props} />);
  return { ...view, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Actions" }));
  return screen.findAllByRole("menuitem");
};

beforeEach(() => jest.clearAllMocks());

describe("ActionMenu", () => {
  it("reports the chosen action", async () => {
    const { user } = renderMenu();

    await open(user);
    await user.click(screen.getByRole("menuitem", { name: "Approve" }));

    expect(approve).toHaveBeenCalled();
  });

  it("puts the destructive entry last, behind a separator", async () => {
    const { user } = renderMenu({ destructive });

    const items = await open(user);

    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Approve",
      "Delete",
    ]);
    expect(
      screen
        .getByRole("menuitem", { name: "Delete" })
        .previousElementSibling?.getAttribute("role"),
    ).toBe("separator");
  });

  it("omits the separator when there is nothing destructive", async () => {
    const { user } = renderMenu();
    await open(user);

    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("tints each entry by tone", async () => {
    const { user } = renderMenu({ destructive });
    await open(user);

    expect(
      screen.getByRole("menuitem", { name: "Approve" }).className,
    ).toContain("text-emerald-700");
    expect(
      screen.getByRole("menuitem", { name: "Delete" }).className,
    ).toContain("text-rose-600");
  });

  it("marks an unavailable action rather than hiding it", async () => {
    const { user } = renderMenu({
      actions: [{ ...actions[0], disabled: true }],
    });
    await open(user);

    expect(screen.getByRole("menuitem", { name: "Approve" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("hides the trigger label only where the trigger is a square", () => {
    const { rerender } = render(<ActionMenu actions={actions} />);
    expect(screen.getByText("Actions").className).toBe("sr-only");

    rerender(<ActionMenu actions={actions} trigger="responsive" />);
    expect(screen.getByText("Actions").className).toBe("lg:sr-only");
  });

  it("blocks the menu and spins while busy", () => {
    renderMenu({ busy: true });

    const trigger = screen.getByRole("button", { name: "Actions" });

    expect(trigger).toBeDisabled();
    expect(trigger.querySelector(".animate-spin")).not.toBeNull();
  });
});
