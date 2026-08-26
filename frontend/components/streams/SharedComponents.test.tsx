import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ClickableIP,
  formatDuration,
  getContentTitle,
  getDetailedQuality,
  getProgressPercentage,
} from "@/components/streams/SharedComponents";

describe("ClickableIP", () => {
  it.each([null, "Unknown IP", "Unknown"])("renders %p as plain text", (ip) => {
    render(<ClickableIP ipAddress={ip} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(ip ?? "Unknown")).toBeInTheDocument();
  });

  it("opens an ipinfo lookup without bubbling the click", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const onParentClick = jest.fn();
    const user = userEvent.setup();

    render(
      <div onClick={onParentClick}>
        <ClickableIP ipAddress="8.8.8.8" />
      </div>,
    );
    await user.click(screen.getByRole("button"));

    expect(open).toHaveBeenCalledWith(
      "https://ipinfo.io/8.8.8.8",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onParentClick).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("works for an IPv6 address", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();

    render(<ClickableIP ipAddress="2001:db8::1" />);
    await user.click(screen.getByRole("button"));

    expect(open).toHaveBeenCalledWith(
      "https://ipinfo.io/2001:db8::1",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5_000, "0:05"],
    [65_000, "1:05"],
    [600_000, "10:00"],
    [3_600_000, "1:00:00"],
    [3_725_000, "1:02:05"],
    [86_400_000, "24:00:00"],
  ])("formats %pms as %p", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("getProgressPercentage", () => {
  it("returns zero without a duration", () => {
    expect(getProgressPercentage(500, 0)).toBe(0);
    expect(getProgressPercentage()).toBe(0);
  });

  it("returns the ratio as a percentage", () => {
    expect(getProgressPercentage(500, 1000)).toBe(50);
  });

  it("never exceeds one hundred", () => {
    expect(getProgressPercentage(5000, 1000)).toBe(100);
  });

  it("treats a missing offset as the start", () => {
    expect(getProgressPercentage(undefined, 1000)).toBe(0);
  });
});

describe("getContentTitle", () => {
  it("joins show, season and episode", () => {
    expect(
      getContentTitle({
        type: "episode",
        grandparentTitle: "Severance",
        parentTitle: "Season 1",
        title: "Good News About Hell",
      }),
    ).toBe("Severance - Season 1: Good News About Hell");
  });

  it("falls through when an episode has no show title", () => {
    expect(getContentTitle({ type: "episode", title: "Orphan" })).toBe(
      "Orphan",
    );
  });

  it("appends the year to a movie", () => {
    expect(
      getContentTitle({ type: "movie", title: "Arrival", year: 2016 }),
    ).toBe("Arrival (2016)");
  });

  it("renders a track as artist and title", () => {
    expect(
      getContentTitle({
        type: "track",
        grandparentTitle: "Boards of Canada",
        title: "Roygbiv",
        parentYear: 1998,
      }),
    ).toBe("Boards of Canada - Roygbiv (1998)");
  });

  it("renders a track without an artist or a year", () => {
    expect(getContentTitle({ type: "track", title: "Untitled" })).toBe(
      "Untitled",
    );
  });

  it("falls back to a placeholder for an unknown shape", () => {
    expect(getContentTitle({ type: "clip" })).toBe("Unknown Title");
  });
});

describe("getDetailedQuality", () => {
  it("returns null without media", () => {
    expect(getDetailedQuality({})).toBeNull();
    expect(getDetailedQuality({ Media: [] })).toBeNull();
  });

  it("normalizes every field it can read", () => {
    expect(
      getDetailedQuality({
        Media: [
          {
            videoResolution: "1080",
            bitrate: 8000,
            videoCodec: "h264",
            audioCodec: "eac3",
            container: "mkv",
          },
        ],
        Session: { bandwidth: 12000 },
      }),
    ).toEqual({
      resolution: "1080",
      bitrate: "8 Mbps",
      videoCodec: "H264",
      audioCodec: "EAC3",
      container: "MKV",
      bandwidth: "12 Mbps",
    });
  });

  it("reports every missing field as unknown", () => {
    expect(getDetailedQuality({ Media: [{}] })).toEqual({
      resolution: "Unknown",
      bitrate: "Unknown",
      videoCodec: "Unknown",
      audioCodec: "Unknown",
      container: "Unknown",
      bandwidth: "Unknown",
    });
  });
});
