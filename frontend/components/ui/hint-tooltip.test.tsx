import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HintTooltip } from "@/components/ui/hint-tooltip";

const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, value });

const original = window.innerWidth;

beforeEach(() => setWidth(1200));
afterEach(() => setWidth(original));

const trigger = () => screen.getByRole("button");

describe("HintTooltip", () => {
  it("stays shut until asked", () => {
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("repeats a text hint for a screen reader while shut", () => {
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    expect(
      screen.getByRole("button", { name: "Badge Why this is so" }),
    ).toBeInTheDocument();
  });

  it("takes an explicit screen reader hint when the visible one is markup", () => {
    render(
      <HintTooltip
        hint={<p>Why this is so</p>}
        screenReaderHint="Spoken instead"
      >
        Badge
      </HintTooltip>,
    );

    expect(
      screen.getByRole("button", { name: "Badge Spoken instead" }),
    ).toBeInTheDocument();
  });

  it("says nothing extra when markup arrives without a spoken hint", () => {
    render(<HintTooltip hint={<p>Why this is so</p>}>Badge</HintTooltip>);

    expect(screen.getByRole("button", { name: "Badge" })).toBeInTheDocument();
  });

  it("opens on hover and closes again on a wide viewport", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    await user.hover(trigger());
    expect(await screen.findAllByText("Why this is so")).not.toHaveLength(0);

    await user.unhover(trigger());
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("never opens on focus alone", async () => {
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    trigger().focus();

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("ignores a click on a wide viewport", () => {
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    fireEvent.click(trigger());

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("toggles on tap on a narrow viewport", async () => {
    setWidth(500);
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    fireEvent.click(trigger());
    expect(await screen.findAllByText("Why this is so")).not.toHaveLength(0);

    fireEvent.click(trigger());
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("ignores hover on a narrow viewport", () => {
    setWidth(500);
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes when the page is tapped elsewhere", async () => {
    setWidth(500);
    render(<HintTooltip hint="Why this is so">Badge</HintTooltip>);

    fireEvent.click(trigger());
    await screen.findAllByText("Why this is so");

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("keeps a click from reaching whatever wraps it", () => {
    const onParentClick = jest.fn();
    render(
      <div onClick={onParentClick}>
        <HintTooltip hint="Why this is so">Badge</HintTooltip>
      </div>,
    );

    fireEvent.click(trigger());

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("passes styling and placement through", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <HintTooltip
        hint="Why this is so"
        side="top"
        align="center"
        triggerClassName="w-full"
        contentClassName="max-w-sm"
      >
        Badge
      </HintTooltip>,
    );

    expect(trigger().className).toContain("w-full");

    await user.hover(trigger());
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.className).toContain("max-w-sm");
  });
});
