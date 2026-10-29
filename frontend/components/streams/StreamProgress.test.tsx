import { render, screen } from "@testing-library/react";
import { StreamProgress } from "@/components/streams/StreamProgress";
import type { PlexSession } from "@/types";

const session = (
  overrides: Partial<PlexSession> = {},
): Partial<PlexSession> => ({
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
    expect(screen.getByText("/ 1:00:00")).toBeInTheDocument();
    expect(screen.getByText("Playing")).toBeInTheDocument();
  });

  it.each([
    ["paused", "Paused"],
    ["buffering", "Buffering"],
  ] as const)("names the %s state", (state, label) => {
    render(<StreamProgress session={session({ Player: { state } })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to unknown when the player reports no state", () => {
    render(<StreamProgress session={session({ Player: undefined })} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("fills the bar to the elapsed fraction", () => {
    const { container } = render(<StreamProgress session={session()} />);
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar?.style.width).toBe("25%");
    expect(
      screen.getByRole("progressbar", { name: "Playback progress" }),
    ).toHaveAttribute("aria-valuenow", "25");
  });

  it.each([
    ["playing", false, "bg-foreground"],
    ["playing", true, "bg-white"],
    ["paused", false, "bg-muted-foreground/60"],
    ["paused", true, "bg-white/50"],
    ["buffering", false, "bg-waiting"],
  ] as const)("fills a %s bar (over art: %s)", (state, hasArt, fill) => {
    const { container } = render(
      <StreamProgress
        session={session({ Player: { state } })}
        hasArt={hasArt}
      />,
    );
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar).toHaveClass(fill);
  });

  it("switches the label styling when drawn over artwork", () => {
    const { container: plain } = render(<StreamProgress session={session()} />);
    const { container: overArt } = render(
      <StreamProgress session={session()} hasArt />,
    );

    expect(plain.innerHTML).toContain("text-muted-foreground");
    expect(overArt.innerHTML).toContain("text-white/70");
  });

  it("renders a zero-length progress at the very start", () => {
    const { container } = render(
      <StreamProgress session={session({ viewOffset: 0 })} />,
    );
    const bar = container.querySelector<HTMLElement>("[style*='width']");

    expect(bar?.style.width).toBe("0%");
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });
});
