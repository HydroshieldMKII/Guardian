import { openInPlex, type PlexWindow } from "./open-in-plex";
import type { PlexSession } from "@/types";

const stream = (overrides: Partial<PlexSession> = {}): PlexSession => ({
  sessionKey: "s-1",
  type: "movie",
  ratingKey: "rk-1",
  serverMachineIdentifier: "server-1",
  ...overrides,
});

const blankWindow = (): PlexWindow & { close: jest.Mock } => ({
  location: { href: "" },
  close: jest.fn(),
});

const fetchMock = jest.fn();
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({
    json: async () => ({ webUrl: "https://plex.test" }),
  });
});

afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

describe("openInPlex", () => {
  it("opens the item on the right server", async () => {
    const opened = blankWindow();

    await openInPlex(stream(), () => opened);

    expect(opened.location.href).toBe(
      "https://plex.test/web/index.html#!/server/server-1/details?key=%2Flibrary%2Fmetadata%2Frk-1",
    );
  });

  it("uses the album key for a music track", async () => {
    const opened = blankWindow();

    await openInPlex(
      stream({
        type: "track",
        ratingKey: "track-1",
        parentRatingKey: "album-1",
      }),
      () => opened,
    );

    expect(opened.location.href).toContain("album-1");
  });

  it("uses the track key when there is no album", async () => {
    const opened = blankWindow();

    await openInPlex(
      stream({ type: "track", ratingKey: "track-1" }),
      () => opened,
    );

    expect(opened.location.href).toContain("track-1");
  });

  it("warns and opens nothing without a rating key", async () => {
    const open = jest.fn(blankWindow);

    await openInPlex(stream({ ratingKey: undefined }), open);

    expect(consoleWarn).toHaveBeenCalledWith("No rating key found for stream");
    expect(open).not.toHaveBeenCalled();
  });

  it("errors and opens nothing without a server identifier", async () => {
    const open = jest.fn(blankWindow);

    await openInPlex(stream({ serverMachineIdentifier: undefined }), open);

    expect(consoleError).toHaveBeenCalledWith(
      "No server machine identifier available",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("closes the blank window when the backend has no web url", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({}) });
    const opened = blankWindow();

    await openInPlex(stream(), () => opened);

    expect(opened.close).toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith("No Plex web URL available");
  });

  it("closes the blank window when the lookup fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const opened = blankWindow();

    await openInPlex(stream(), () => opened);

    expect(opened.close).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to get Plex web URL:",
      expect.any(Error),
    );
  });

  it.each([
    ["has a web url", { webUrl: "https://plex.test" }],
    ["has no web url", {}],
  ])("survives a blocked popup when the backend %s", async (_label, reply) => {
    fetchMock.mockResolvedValue({ json: async () => reply });

    await expect(openInPlex(stream(), () => null)).resolves.toBeUndefined();
  });

  it("survives a blocked popup when the lookup fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(openInPlex(stream(), () => null)).resolves.toBeUndefined();
  });
});
