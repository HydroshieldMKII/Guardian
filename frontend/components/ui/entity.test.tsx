import { render, screen } from "@testing-library/react";
import {
  ActionBar,
  EntityCard,
  EntityHeader,
  Meta,
  MetaGrid,
  PillRow,
  StatTile,
  StatusPill,
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
