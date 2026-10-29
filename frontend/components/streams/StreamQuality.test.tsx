import { render, screen } from "@testing-library/react";
import { StreamQualityDetails } from "@/components/streams/StreamQuality";

const media = (overrides: Record<string, unknown> = {}) => ({
  videoResolution: "1080",
  bitrate: 8000,
  videoCodec: "h264",
  audioCodec: "eac3",
  container: "mkv",
  ...overrides,
});

const session = (
  mediaOverrides: Record<string, unknown> = {},
  rest: Record<string, unknown> = {},
) => ({
  Media: [media(mediaOverrides)],
  Session: { bandwidth: 12000 },
  ...rest,
});

describe("StreamQualityDetails", () => {
  it("renders nothing without media", () => {
    const { container } = render(<StreamQualityDetails session={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels every video field", () => {
    render(<StreamQualityDetails session={session()} />);

    expect(screen.getByText("Stream quality")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
    expect(screen.getByText("Bandwidth")).toBeInTheDocument();
    expect(screen.getByText("Video codec")).toBeInTheDocument();
    expect(screen.getByText("Bitrate")).toBeInTheDocument();
    expect(screen.getByText("Audio codec")).toBeInTheDocument();
    expect(screen.getByText("Container")).toBeInTheDocument();
    expect(screen.getByText("12 Mbps")).toBeInTheDocument();
  });

  it("drops the video-only fields for music", () => {
    render(<StreamQualityDetails session={session({}, { type: "track" })} />);

    expect(screen.queryByText("Resolution")).toBeNull();
    expect(screen.queryByText("Bandwidth")).toBeNull();
    expect(screen.queryByText("Video codec")).toBeNull();
    expect(screen.getByText("Bitrate")).toBeInTheDocument();
    expect(screen.getByText("Audio codec")).toBeInTheDocument();
    expect(screen.getByText("Container")).toBeInTheDocument();
  });

  it("shows unknowns rather than hiding fields", () => {
    render(<StreamQualityDetails session={{ Media: [{}] }} />);
    expect(screen.getAllByText("Unknown").length).toBe(6);
  });

  it("switches to the over-artwork palette", () => {
    const { container: plain } = render(
      <StreamQualityDetails session={session()} />,
    );
    const { container: overArt } = render(
      <StreamQualityDetails session={session()} hasArt />,
    );

    expect(plain.innerHTML).toContain("bg-muted/30");
    expect(overArt.innerHTML).toContain("bg-black/50");
  });
});
