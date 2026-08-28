import { render, screen } from "@testing-library/react";
import { StreamDeviceInfo } from "@/components/streams/StreamDeviceInfo";

const session = (overrides: Record<string, unknown> = {}) => ({
  Player: {
    platform: "Roku",
    address: "192.168.1.10",
    product: "Plex for Roku",
  },
  Session: { sessionCount: 4 },
  ...overrides,
});

describe("StreamDeviceInfo", () => {
  it("labels every field it reads", () => {
    render(<StreamDeviceInfo session={session()} />);

    expect(screen.getByText("Device Information")).toBeInTheDocument();
    expect(screen.getByText("Roku")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
    expect(screen.getByText("Plex for Roku")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders an IPv6 address through the lookup link", () => {
    render(
      <StreamDeviceInfo
        session={session({ Player: { address: "2001:db8::1" } })}
      />,
    );

    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      "Look up 2001:db8::1 on ipinfo.io",
    );
  });

  it("falls back for every missing field", () => {
    render(<StreamDeviceInfo session={{}} />);

    expect(screen.getAllByText("Unknown")).toHaveLength(3);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("switches to the over-artwork palette", () => {
    const { container: plain } = render(
      <StreamDeviceInfo session={session()} />,
    );
    const { container: overArt } = render(
      <StreamDeviceInfo session={session()} hasArt />,
    );

    expect(plain.innerHTML).toContain("bg-muted/30");
    expect(overArt.innerHTML).toContain("bg-black/50");
  });
});
