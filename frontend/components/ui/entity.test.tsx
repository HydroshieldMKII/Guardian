import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ActionBar,
  Chip,
  CollapsibleSection,
  EmptyState,
  EntityCard,
  EntityHeader,
  Field,
  Meta,
  MetaGrid,
  ModalShell,
  OptionCard,
  OptionGroup,
  Panel,
  PillRow,
  Section,
  SegmentedControl,
  SelectRow,
  StatTile,
  StatusPill,
  ToggleRow,
  toneButton,
  toneMenuItem,
  type Tone,
} from "@/components/ui/entity";

const TONES: Tone[] = [
  "neutral",
  "positive",
  "warning",
  "danger",
  "info",
  "accent",
];

describe("EntityCard", () => {
  it("defaults to the neutral rail when no tone is given", () => {
    const { container } = render(<EntityCard>body</EntityCard>);

    expect(container.innerHTML).toContain("bg-border");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("can drop the rail entirely", () => {
    const { container } = render(<EntityCard rail={false}>body</EntityCard>);
    expect(container.querySelector("span[aria-hidden]")).toBeNull();
  });

  it.each(TONES)("paints the %s rail", (tone) => {
    const { container } = render(<EntityCard tone={tone}>body</EntityCard>);
    const rail = container.querySelector("span[aria-hidden]");

    expect(rail).not.toBeNull();
  });

  it("forwards arbitrary div props", () => {
    const { container } = render(
      <EntityCard id="card-1" data-thing="x" className="extra">
        body
      </EntityCard>,
    );
    const card = container.firstElementChild as HTMLElement;

    expect(card.id).toBe("card-1");
    expect(card.getAttribute("data-thing")).toBe("x");
    expect(card.className).toContain("extra");
  });

  it("does not lift or shadow on hover", () => {
    const { container } = render(<EntityCard>body</EntityCard>);

    expect(container.innerHTML).not.toContain("hover:-translate-y");
    expect(container.innerHTML).not.toContain("hover:shadow");
  });
});

describe("EntityHeader", () => {
  it("renders a title on its own", () => {
    render(<EntityHeader title="Living Room TV" />);

    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
  });

  it("renders subtitle and status when supplied", () => {
    render(
      <EntityHeader
        title="Living Room TV"
        subtitle="Plex for Roku"
        status={<span>Pending</span>}
      />,
    );

    expect(screen.getByText("Plex for Roku")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("omits the subtitle and status nodes when absent", () => {
    const { container } = render(<EntityHeader title="Bare" />);

    expect(container.querySelector("p")).toBeNull();
  });
});

describe("StatusPill", () => {
  it.each(TONES)("renders the %s tone", (tone) => {
    render(<StatusPill tone={tone}>{tone}</StatusPill>);
    expect(screen.getByText(tone)).toBeInTheDocument();
  });

  it("defaults to neutral", () => {
    const { container } = render(<StatusPill>Idle</StatusPill>);
    expect(container.innerHTML).toContain("bg-muted/60");
  });

  it("adds a dot only when asked", () => {
    const { container: without } = render(<StatusPill>Idle</StatusPill>);
    const { container: with_ } = render(
      <StatusPill dot tone="positive">
        Live
      </StatusPill>,
    );

    expect(without.querySelectorAll("span[aria-hidden]")).toHaveLength(0);
    expect(with_.querySelectorAll("span[aria-hidden]")).toHaveLength(1);
  });
});

describe("layout primitives", () => {
  it("lays pills out in a row", () => {
    render(
      <PillRow>
        <span>one</span>
      </PillRow>,
    );
    expect(screen.getByText("one")).toBeInTheDocument();
  });

  it("renders label and value pairs as a description list", () => {
    const { container } = render(
      <MetaGrid>
        <Meta label="IP Address">192.168.1.10</Meta>
      </MetaGrid>,
    );

    expect(container.querySelector("dl")).not.toBeNull();
    expect(screen.getByText("IP Address").tagName).toBe("DT");
    expect(screen.getByText("192.168.1.10").tagName).toBe("DD");
  });

  it("accepts a className on the grid and on a cell", () => {
    const { container } = render(
      <MetaGrid className="grid-extra">
        <Meta label="Streams" className="cell-extra">
          7
        </Meta>
      </MetaGrid>,
    );

    expect(container.innerHTML).toContain("grid-extra");
    expect(container.innerHTML).toContain("cell-extra");
  });

  it("stacks actions above the small breakpoint", () => {
    const { container } = render(
      <ActionBar>
        <button>Approve</button>
      </ActionBar>,
    );

    expect(container.innerHTML).toContain("sm:flex-row");
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("accepts a className on the action bar", () => {
    const { container } = render(
      <ActionBar className="bar-extra">
        <button>Approve</button>
      </ActionBar>,
    );
    expect(container.innerHTML).toContain("bar-extra");
  });
});

describe("StatTile", () => {
  it("shows a label and value", () => {
    render(<StatTile label="Active Streams" value={4} />);

    expect(screen.getByText("Active Streams")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("defaults to the neutral rail", () => {
    const { container } = render(<StatTile label="Total" value={0} />);
    expect(container.innerHTML).toContain("bg-border");
  });

  it.each(TONES)("paints the %s rail", (tone) => {
    const { container } = render(
      <StatTile label="Total" value={1} tone={tone} />,
    );
    expect(container.querySelector("span[aria-hidden]")).not.toBeNull();
  });

  it("accepts a className", () => {
    const { container } = render(
      <StatTile label="Total" value={1} className="tile-extra" />,
    );
    expect(container.innerHTML).toContain("tile-extra");
  });
});

describe("Panel", () => {
  it("defaults to the neutral tone", () => {
    const { container } = render(<Panel>body</Panel>);
    expect(container.innerHTML).toContain("bg-muted/30");
  });

  it.each(TONES)("paints the %s tone", (tone) => {
    const { container } = render(<Panel tone={tone}>body</Panel>);
    expect(container.firstElementChild?.className).toContain("border");
  });
});

describe("StatusPill sizing", () => {
  it("defaults to the roomier size", () => {
    const { container } = render(<StatusPill>Ready</StatusPill>);
    expect(container.firstElementChild?.className).toContain("text-[11px]");
  });

  it("shrinks for dense rows", () => {
    const { container } = render(<StatusPill size="sm">Ready</StatusPill>);

    expect(container.firstElementChild?.className).toContain("text-[10px]");
    expect(container.firstElementChild?.className).not.toContain("text-[11px]");
  });

  it("keeps the dot at either size", () => {
    const { container } = render(
      <StatusPill size="sm" dot>
        Ready
      </StatusPill>,
    );
    expect(container.querySelector("span[aria-hidden]")).not.toBeNull();
  });
});

describe("toneButton", () => {
  it("defaults to the outline variant", () => {
    expect(toneButton("danger")).toBe(toneButton("danger", "outline"));
  });

  it.each(TONES)("returns a solid class for %s", (tone) => {
    expect(typeof toneButton(tone, "solid")).toBe("string");
  });
});

describe("toneMenuItem", () => {
  it.each(TONES)("returns a class for %s", (tone) => {
    expect(typeof toneMenuItem(tone)).toBe("string");
  });

  it("leaves the neutral tone to the menu default", () => {
    expect(toneMenuItem("neutral")).toBe("");
  });

  it("carries the tint through to the focus state", () => {
    expect(toneMenuItem("danger")).toContain("focus:");
  });
});

describe("Field", () => {
  it("links the label to the control", () => {
    render(
      <Field label="Server IP" htmlFor="ip">
        <input id="ip" />
      </Field>,
    );

    expect(screen.getByLabelText("Server IP")).toBeInTheDocument();
  });

  it("renders a hint and an action when given", () => {
    render(
      <Field label="Token" hint="Kept secret" action={<span>Optional</span>}>
        <input />
      </Field>,
    );

    expect(screen.getByText("Kept secret")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("omits the hint when absent", () => {
    const { container } = render(
      <Field label="Token">
        <input />
      </Field>,
    );

    expect(container.querySelector("p")).toBeNull();
  });

  it("puts an action-only field on the label row", () => {
    render(
      <Field
        label="Default page"
        hint="Where Guardian opens"
        action={<button>Streams</button>}
      />,
    );

    const label = screen.getByText("Default page");
    const control = screen.getByRole("button", { name: "Streams" });

    expect(label.parentElement).toBe(control.parentElement);
    expect(screen.getByText("Where Guardian opens")).toBeInTheDocument();
  });
});

describe("ToggleRow", () => {
  it("reports a change", async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();
    render(
      <ToggleRow
        id="flag"
        label="Enable it"
        hint="Turns the thing on"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    expect(screen.getByText("Turns the thing on")).toBeInTheDocument();
    await user.click(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("dims and locks when disabled", () => {
    const { container } = render(
      <ToggleRow
        id="flag"
        label="Enable it"
        checked
        onCheckedChange={jest.fn()}
        disabled
      />,
    );

    expect(container.innerHTML).toContain("opacity-60");
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

describe("OptionCard", () => {
  it("announces its selected state and reports a choice", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <OptionGroup>
        <OptionCard
          selected
          title="Both"
          description="LAN and WAN"
          onSelect={onSelect}
        />
      </OptionGroup>,
    );

    const option = screen.getByRole("radio", { name: /Both/ });
    expect(option).toBeChecked();
    expect(screen.getByText("LAN and WAN")).toBeInTheDocument();

    await user.click(option);
    expect(onSelect).toHaveBeenCalled();
  });

  it("renders unselected and without a description", () => {
    render(<OptionCard selected={false} title="LAN" onSelect={jest.fn()} />);

    expect(screen.getByRole("radio", { name: "LAN" })).not.toBeChecked();
  });

  it("can be disabled", () => {
    render(
      <OptionCard selected={false} title="LAN" onSelect={jest.fn()} disabled />,
    );

    expect(screen.getByRole("radio", { name: "LAN" })).toBeDisabled();
  });
});

describe("SelectRow", () => {
  it("toggles and shows the subtitle when selected", async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(
      <SelectRow
        selected
        title="Living Room TV"
        subtitle="Roku · pending"
        onToggle={onToggle}
      />,
    );

    const row = screen.getByRole("checkbox", { name: /Living Room TV/ });
    expect(row).toBeChecked();
    expect(screen.getByText("Roku · pending")).toBeInTheDocument();

    await user.click(row);
    expect(onToggle).toHaveBeenCalled();
  });

  it("renders unselected without a subtitle", () => {
    render(<SelectRow selected={false} title="Bare" onToggle={jest.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Bare" })).not.toBeChecked();
  });
});

describe("SegmentedControl", () => {
  it("marks the active segment and reports a change", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SegmentedControl
        value="duration"
        onChange={onChange}
        options={[
          { value: "duration", label: "Duration" },
          { value: "calendar", label: "Calendar" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Duration" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(onChange).toHaveBeenCalledWith("calendar");
  });
});

describe("Chip", () => {
  it("removes itself when asked", async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn();
    render(
      <Chip onRemove={onRemove} removeLabel="Remove 10.0.0.1">
        10.0.0.1
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: "Remove 10.0.0.1" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("has no control when it cannot be removed", () => {
    render(<Chip tone="info">10.0.0.1</Chip>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("EmptyState", () => {
  it("shows a title on its own", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("shows a description and an action when given", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Try another filter"
        action={<button>Reset</button>}
      />,
    );

    expect(screen.getByText("Try another filter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});

describe("CollapsibleSection", () => {
  it("hides its body until opened", async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    const { rerender } = render(
      <CollapsibleSection
        title="Activity"
        open={false}
        onOpenChange={onOpenChange}
        status={<span>2 items</span>}
      >
        <p>First seen</p>
      </CollapsibleSection>,
    );

    expect(screen.queryByText("First seen")).toBeNull();
    expect(screen.getByText("2 items")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Activity/ }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <CollapsibleSection title="Activity" open onOpenChange={onOpenChange}>
        <p>First seen</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText("First seen")).toBeInTheDocument();
  });
});

describe("ModalShell", () => {
  it("renders a title with and without a description", () => {
    const { rerender } = render(
      <ModalShell title="Details" description="About this device">
        <p>body</p>
      </ModalShell>,
    );

    expect(screen.getByText("About this device")).toBeInTheDocument();

    rerender(
      <ModalShell title="Details">
        <p>body</p>
      </ModalShell>,
    );
    expect(screen.queryByText("About this device")).toBeNull();
  });
});

describe("Section", () => {
  it("renders bare children with no heading", () => {
    const { container } = render(
      <Section>
        <p>body</p>
      </Section>,
    );

    expect(container.querySelector("h3")).toBeNull();
  });

  it("renders a title, description and action", () => {
    render(
      <Section
        title="Rules"
        description="Blocking windows"
        action={<button>Add</button>}
      >
        <p>body</p>
      </Section>,
    );

    expect(screen.getByText("Rules")).toBeInTheDocument();
    expect(screen.getByText("Blocking windows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("renders an action without a title", () => {
    render(
      <Section action={<button>Add</button>}>
        <p>body</p>
      </Section>,
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
