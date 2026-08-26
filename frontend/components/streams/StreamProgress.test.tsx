import { render, screen } from "@testing-library/react";
import { StreamProgress } from "@/components/streams/StreamProgress";

const session = (overrides: Record<string, unknown> = {}) => ({
  duration: 3_600_000,
  viewOffset: 900_000,
  Player: { state: "playing" },
  ...overrides,
});

describe("StreamProgress", () => {
  it.each([
    ["no duration", { duration: undefined }],
    ["no view offset", { viewOffset: undefined }],
  ])("renders nothing with %s", (_label, overrides) => {
    const { container } = render(
      <StreamProgress session={session(overrides)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows elapsed, total and the player state", () => {
    render(<StreamProgress session={session()} />);

    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByText("1:00:00")).toBeInTheDocument();
    expect(screen.getByText("playing")).toBeInTheDocument();
  });

  it("falls back to unknown when the player reports no state", () => {
    render(<StreamProgress session={session({ Player: undefined })} />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("fills the bar to the elapsed fraction", () => {
    const { container } = render(<StreamProgress session={session()} />);
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar?.style.width).toBe("25%");
  });

  it("uses the playing gradient and a shimmer while playing", () => {
    const { container } = render(<StreamProgress session={session()} />);
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar?.className).toContain("from-blue-500");
    expect(bar?.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("uses the paused gradient and drops the shimmer when not playing", () => {
    const { container } = render(
      <StreamProgress session={session({ Player: { state: "paused" } })} />,
    );
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar?.className).toContain("from-yellow-500");
    expect(bar?.querySelector(".animate-pulse")).toBeNull();
  });

  it("switches the label styling when drawn over artwork", () => {
    const { container: plain } = render(<StreamProgress session={session()} />);
    const { container: overArt } = render(
      <StreamProgress session={session()} hasArt />,
    );

    expect(plain.innerHTML).toContain("text-muted-foreground");
    expect(overArt.innerHTML).toContain("bg-black/60");
  });

  it("renders a zero-length progress at the very start", () => {
    const { container } = render(
      <StreamProgress session={session({ viewOffset: 0 })} />,
    );
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar?.style.width).toBe("0%");
    expect(screen.getAllByText("0:00").length).toBeGreaterThan(0);
  });
});
