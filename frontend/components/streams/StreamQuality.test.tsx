import { render, screen } from "@testing-library/react";
import {
  StreamQuality,
  StreamQualityDetails,
} from "@/components/streams/StreamQuality";

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

describe("StreamQuality", () => {
  it("renders nothing without media", () => {
    const { container } = render(<StreamQuality session={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for video with neither resolution nor codec", () => {
    const { container } = render(
      <StreamQuality
        session={session({ videoResolution: undefined, videoCodec: undefined })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders video with only a resolution", () => {
    render(<StreamQuality session={session({ videoCodec: undefined })} />);
    expect(screen.getByText("1080")).toBeInTheDocument();
  });

  it("still renders video with only a codec", () => {
    render(<StreamQuality session={session({ videoResolution: undefined })} />);
    expect(screen.getByText("H264")).toBeInTheDocument();
  });

  it("shows every badge it can for video", () => {
    render(<StreamQuality session={session()} />);

    expect(screen.getByText("1080")).toBeInTheDocument();
    expect(screen.getByText("H264")).toBeInTheDocument();
    expect(screen.getByText("MKV")).toBeInTheDocument();
    expect(screen.getByText("8 Mbps")).toBeInTheDocument();
  });

  it("omits a container it does not know", () => {
    render(<StreamQuality session={session({ container: undefined })} />);
    expect(screen.queryByText("MKV")).toBeNull();
  });

  it("omits a bitrate it does not know", () => {
    render(<StreamQuality session={session({ bitrate: undefined })} />);
    expect(screen.queryByText(/Mbps/)).toBeNull();
  });

  describe("music", () => {
    it("renders nothing without a bitrate", () => {
      const { container } = render(
        <StreamQuality
          session={session({ bitrate: undefined }, { type: "track" })}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("drops the video badges but keeps container and bitrate", () => {
      render(<StreamQuality session={session({}, { type: "track" })} />);

      expect(screen.queryByText("1080")).toBeNull();
      expect(screen.queryByText("H264")).toBeNull();
      expect(screen.getByText("MKV")).toBeInTheDocument();
      expect(screen.getByText("8 Mbps")).toBeInTheDocument();
    });
  });

  describe("inline mode", () => {
    it("renders the same badges as pill fragments", () => {
      const { container } = render(
        <StreamQuality session={session()} inline />,
      );

      expect(screen.getByText("1080")).toBeInTheDocument();
      expect(container.innerHTML).toContain("rounded-full");
      expect(container.innerHTML).toContain("bg-blue-600/90");
    });

    it("switches to the over-artwork palette", () => {
      const { container } = render(
        <StreamQuality session={session()} inline hasArt />,
      );
      expect(container.innerHTML).toContain("bg-blue-600/80");
    });

    it("always shows the container for music but hides it on mobile for video", () => {
      const { container: music } = render(
        <StreamQuality session={session({}, { type: "track" })} inline />,
      );
      const { container: video } = render(
        <StreamQuality session={session()} inline />,
      );

      expect(music.innerHTML).not.toContain("hidden sm:flex");
      expect(video.innerHTML).toContain("hidden sm:flex");
    });

    it("omits unknown fields", () => {
      render(
        <StreamQuality
          session={session({ container: undefined, bitrate: undefined })}
          inline
        />,
      );

      expect(screen.queryByText("MKV")).toBeNull();
      expect(screen.queryByText(/Mbps/)).toBeNull();
    });
  });
});

describe("StreamQualityDetails", () => {
  it("renders nothing without media", () => {
    const { container } = render(<StreamQualityDetails session={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels every video field", () => {
    render(<StreamQualityDetails session={session()} />);

    expect(screen.getByText("Stream Quality")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
    expect(screen.getByText("Bandwidth")).toBeInTheDocument();
    expect(screen.getByText("Video Codec")).toBeInTheDocument();
    expect(screen.getByText("Bitrate")).toBeInTheDocument();
    expect(screen.getByText("Audio Codec")).toBeInTheDocument();
    expect(screen.getByText("Container")).toBeInTheDocument();
    expect(screen.getByText("12 Mbps")).toBeInTheDocument();
  });

  it("drops the video-only fields for music", () => {
    render(<StreamQualityDetails session={session({}, { type: "track" })} />);

    expect(screen.queryByText("Resolution")).toBeNull();
    expect(screen.queryByText("Bandwidth")).toBeNull();
    expect(screen.queryByText("Video Codec")).toBeNull();
    expect(screen.getByText("Bitrate")).toBeInTheDocument();
    expect(screen.getByText("Audio Codec")).toBeInTheDocument();
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
    expect(overArt.innerHTML).toContain("bg-black/60");
  });
});
