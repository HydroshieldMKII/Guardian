import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlexSession } from "@/types";
import { StreamCard } from "@/components/streams/StreamCard";

jest.mock("@/components/streams/StreamQuality", () => ({
  StreamQualityDetails: () => <span>quality-details</span>,
}));
jest.mock("@/components/streams/StreamDeviceInfo", () => ({
  StreamDeviceInfo: () => <span>device-info</span>,
}));
jest.mock("@/components/streams/StreamProgress", () => ({
  StreamProgress: () => <span>progress</span>,
}));

const stream = (overrides: Partial<PlexSession> = {}): PlexSession => ({
  sessionKey: "s-1",
  type: "movie",
  title: "Arrival",
  year: 2016,
  ratingKey: "rk-1",
  serverMachineIdentifier: "server-1",
  User: { id: "u-1", title: "alice" },
  Player: {
    title: "Living Room TV",
    platform: "Roku",
    product: "Plex for Roku",
    machineIdentifier: "m-1",
  },
  ...overrides,
});

const renderCard = (
  overrides: Partial<PlexSession> = {},
  props: Partial<{ isExpanded: boolean; isRevoking: boolean }> = {},
) => {
  const onToggleExpand = jest.fn();
  const onRemoveAccess = jest.fn();
  const onNavigateToDevice = jest.fn();
  const onNavigateToUser = jest.fn();
  const view = render(
    <StreamCard
      stream={stream(overrides)}
      isExpanded={props.isExpanded ?? false}
      isRevoking={props.isRevoking ?? false}
      onToggleExpand={onToggleExpand}
      onRemoveAccess={onRemoveAccess}
      onNavigateToDevice={onNavigateToDevice}
      onNavigateToUser={onNavigateToUser}
    />,
  );
  return {
    ...view,
    onToggleExpand,
    onRemoveAccess,
    onNavigateToDevice,
    onNavigateToUser,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
};

type User = ReturnType<typeof userEvent.setup>;

const openMenu = async (user: User) => {
  await user.click(screen.getByRole("button", { name: /Actions/ }));
  return screen.findAllByRole("menuitem");
};

const choose = async (user: User, name: string) => {
  await openMenu(user);
  await user.click(await screen.findByRole("menuitem", { name }));
};

const menuLabels = async (user: User) =>
  (await openMenu(user)).map((item) => item.textContent?.trim());

const setViewport = (width: number) =>
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });

let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({
    json: async () => ({ webUrl: "https://plex.test" }),
  });
  setViewport(1200);
});

afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

describe("StreamCard content", () => {
  it("shows title, user, device and the child sections", () => {
    renderCard();

    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("2016")).toBeInTheDocument();
    expect(screen.getByText(/on Living Room TV/)).toHaveTextContent(
      "alice on Living Room TV",
    );
    expect(screen.queryByText("1080")).toBeNull();
    expect(screen.getByText("progress")).toBeInTheDocument();
  });

  it("spends the corner on actions rather than a badge every card repeats", async () => {
    const { user } = renderCard();

    expect(screen.queryByText("Streaming")).toBeNull();
    expect(await menuLabels(user)).toEqual([
      "Go to user",
      "Go to device",
      "Remove access",
    ]);
  });

  it("keeps the actions in the header, not in a row of their own", () => {
    const { container } = renderCard();
    const heading = screen.getByText("Arrival").closest("h4");

    expect(heading?.parentElement?.parentElement).toContainElement(
      screen.getByRole("button", { name: /Actions/ }),
    );
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("falls back for an unknown user and device", () => {
    renderCard({ User: undefined, Player: undefined });

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows the poster when there is one", () => {
    renderCard({ thumbnailUrl: "/poster.jpg" });
    expect(screen.getByAltText("Arrival (2016)")).toHaveAttribute(
      "src",
      "/poster.jpg",
    );
  });

  it.each([
    ["movie", "Roygbiv (2016)", "aspect-[2/3]"],
    ["track", "Roygbiv", "aspect-square"],
    ["episode", "Roygbiv", "aspect-video"],
  ])("frames a %s thumbnail in its usual shape", (type, alt, frame) => {
    renderCard({ type, title: "Roygbiv", thumbnailUrl: "/thumb.jpg" });
    expect(screen.getByAltText(alt).parentElement).toHaveClass(frame);
  });

  it.each([
    [200, 300, "aspect-[2/3]"],
    [300, 300, "aspect-square"],
    [480, 270, "aspect-video"],
  ])("reshapes the frame to a %ix%i image once it loads", (w, h, frame) => {
    renderCard({ thumbnailUrl: "/thumb.jpg" });
    const img = screen.getByAltText("Arrival (2016)");
    Object.defineProperty(img, "naturalWidth", { value: w });
    Object.defineProperty(img, "naturalHeight", { value: h });

    fireEvent.load(img);

    expect(img.parentElement).toHaveClass(frame);
  });

  it("keeps the expected shape when the image reports no size", () => {
    renderCard({ thumbnailUrl: "/thumb.jpg" });
    const img = screen.getByAltText("Arrival (2016)");

    fireEvent.load(img);

    expect(img.parentElement).toHaveClass("aspect-[2/3]");
  });

  it("omits the poster block without a thumbnail", () => {
    renderCard();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("fades the poster in once it loads", () => {
    renderCard({ thumbnailUrl: "/poster.jpg" });
    const img = screen.getByAltText("Arrival (2016)");
    expect(img).toHaveClass("opacity-0");

    fireEvent.load(img);

    expect(img).toHaveClass("opacity-100");
  });

  it("drops the poster frame when it fails to load", () => {
    renderCard({ thumbnailUrl: "/poster.jpg" });

    fireEvent.error(screen.getByAltText("Arrival (2016)"));

    expect(screen.queryByAltText("Arrival (2016)")).toBeNull();
  });

  it("lays the artwork in at its own shape behind a dark card", () => {
    const { container } = renderCard({ artUrl: "/art.jpg" });
    const card = container.firstElementChild as HTMLElement;
    const art = screen.getByTestId("stream-art");

    expect(art).toHaveAttribute("src", "/art.jpg");
    expect(art).toHaveClass("w-auto", "h-full", "opacity-0");
    expect(card).toHaveClass("bg-neutral-900", "dark:bg-black", "text-white");

    fireEvent.load(art);
    expect(art).toHaveClass("opacity-45");
  });

  it("tints the card with a blurred copy of the artwork once it loads", () => {
    renderCard({ artUrl: "/art.jpg" });
    const ambient = screen.getByTestId("stream-ambient");

    expect(ambient).toHaveAttribute("src", "/art.jpg");
    expect(ambient).toHaveClass("blur-3xl", "opacity-0");

    fireEvent.load(screen.getByTestId("stream-art"));
    expect(ambient).toHaveClass("opacity-70");
  });

  it("falls back to the plain card when the artwork fails", () => {
    const { container } = renderCard({ artUrl: "/art.jpg" });

    fireEvent.error(screen.getByTestId("stream-art"));

    expect(screen.queryByTestId("stream-art")).toBeNull();
    expect(screen.queryByTestId("stream-ambient")).toBeNull();
    expect(container.firstElementChild).not.toHaveClass("bg-neutral-900");
  });

  it("tries the poster and artwork again when the next item has new images", () => {
    const props = {
      isExpanded: false,
      isRevoking: false,
      onToggleExpand: jest.fn(),
      onRemoveAccess: jest.fn(),
    };
    const { rerender } = render(
      <StreamCard
        {...props}
        stream={stream({ thumbnailUrl: "/one.jpg", artUrl: "/one-art.jpg" })}
      />,
    );
    fireEvent.error(screen.getByAltText("Arrival (2016)"));
    fireEvent.error(screen.getByTestId("stream-art"));

    rerender(
      <StreamCard
        {...props}
        stream={stream({ thumbnailUrl: "/two.jpg", artUrl: "/two-art.jpg" })}
      />,
    );

    expect(screen.getByAltText("Arrival (2016)")).toHaveAttribute(
      "src",
      "/two.jpg",
    );
    expect(screen.getByTestId("stream-art")).toHaveAttribute(
      "src",
      "/two-art.jpg",
    );
  });

  it("fades new artwork in instead of showing it at once", () => {
    const { rerender } = renderCard({ artUrl: "/one-art.jpg" });
    fireEvent.load(screen.getByTestId("stream-art"));

    rerender(
      <StreamCard
        stream={stream({ artUrl: "/two-art.jpg" })}
        isExpanded={false}
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );

    expect(screen.getByTestId("stream-art")).toHaveClass("opacity-0");
  });

  it("shows the details only when expanded", () => {
    const { rerender } = renderCard();
    expect(screen.queryByText("quality-details")).toBeNull();

    rerender(
      <StreamCard
        stream={stream()}
        isExpanded
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );

    expect(screen.getByText("quality-details")).toBeInTheDocument();
    expect(screen.getByText("device-info")).toBeInTheDocument();
  });

  it("swaps the details label when expanded", () => {
    const collapsed = renderCard();
    expect(
      screen.getByRole("button", { name: "Show details" }),
    ).toHaveAttribute("aria-expanded", "false");

    collapsed.unmount();

    renderCard({}, { isExpanded: true });
    expect(
      screen.getByRole("button", { name: "Hide details" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("puts the details toggle beside the actions", () => {
    renderCard();

    expect(
      screen.getByRole("button", { name: "Show details" }).parentElement,
    ).toContainElement(screen.getByRole("button", { name: /Actions/ }));
  });
});

describe("StreamCard navigation", () => {
  it("opens the user from their name", async () => {
    const { user, onNavigateToUser } = renderCard();

    await user.click(screen.getByRole("button", { name: "alice" }));

    expect(onNavigateToUser).toHaveBeenCalledWith("u-1");
  });

  it("shows the name as plain text when the user cannot be opened", () => {
    renderCard({ User: { title: "alice" } });

    expect(screen.queryByRole("button", { name: "alice" })).toBeNull();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("scrolls to the user", async () => {
    const { user, onNavigateToUser } = renderCard();

    await choose(user, "Go to user");

    expect(onNavigateToUser).toHaveBeenCalledWith("u-1");
  });

  it("does not scroll to a user it cannot identify", async () => {
    const { user, onNavigateToUser } = renderCard({ User: undefined });

    await choose(user, "Go to user");

    expect(onNavigateToUser).not.toHaveBeenCalled();
  });

  it("scrolls to the device", async () => {
    const { user, onNavigateToDevice } = renderCard();

    await choose(user, "Go to device");

    expect(onNavigateToDevice).toHaveBeenCalledWith("u-1", "m-1");
  });

  it("does not scroll to a device it cannot identify", async () => {
    const { user, onNavigateToDevice } = renderCard({ Player: undefined });

    await choose(user, "Go to device");

    expect(onNavigateToDevice).not.toHaveBeenCalled();
  });

  it("works with no navigation callbacks at all", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <StreamCard
        stream={stream()}
        isExpanded={false}
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );

    await choose(user, "Go to user");
    await choose(user, "Go to device");

    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });

  it("offers one navigation entry per target, not a mobile duplicate", async () => {
    const { user } = renderCard();
    const labels = await menuLabels(user);

    expect(labels).toEqual([...new Set(labels)]);
  });

  it("disables navigation without identifiers", async () => {
    const { user } = renderCard({ User: undefined, Player: undefined });
    await openMenu(user);

    for (const label of ["Go to user", "Go to device"]) {
      expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
});

describe("StreamCard access removal", () => {
  it("removes access from the menu", async () => {
    const { user, onRemoveAccess } = renderCard();

    await choose(user, "Remove access");

    expect(onRemoveAccess).toHaveBeenCalled();
  });

  it("separates removal from the navigation entries", async () => {
    const { user } = renderCard();
    await openMenu(user);

    const remove = screen.getByRole("menuitem", { name: "Remove access" });

    expect(remove.previousElementSibling?.getAttribute("role")).toBe(
      "separator",
    );
    expect(remove.className).toContain("text-blocked");
  });

  it("spins the trigger and blocks the menu while revoking", () => {
    renderCard({}, { isRevoking: true });

    const trigger = screen.getByRole("button", { name: /Actions/ });

    expect(trigger).toBeDisabled();
    expect(trigger.querySelector(".animate-spin")).not.toBeNull();
  });

  it("does nothing without a user or device identifier", async () => {
    const { user, onRemoveAccess } = renderCard({ User: undefined });

    await choose(user, "Remove access");

    expect(onRemoveAccess).not.toHaveBeenCalled();
  });

  it("hides the entry entirely for Plexamp", async () => {
    const { user } = renderCard({
      Player: { product: "Plexamp", machineIdentifier: "m-1" },
    });

    expect(await menuLabels(user)).not.toContain("Remove access");
  });
});

describe("StreamCard expanding", () => {
  it("expands from the details button", async () => {
    const { user, onToggleExpand } = renderCard();

    await user.click(screen.getByRole("button", { name: "Show details" }));

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("collapses from the same button when open", async () => {
    const { user, onToggleExpand } = renderCard({}, { isExpanded: true });

    await user.click(screen.getByRole("button", { name: "Hide details" }));

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("does not expand when a navigation entry is used", async () => {
    const { user, onToggleExpand, onNavigateToUser } = renderCard();

    await choose(user, "Go to user");

    expect(onNavigateToUser).toHaveBeenCalled();
    expect(onToggleExpand).not.toHaveBeenCalled();
  });
});

describe("StreamCard opening in Plex", () => {
  it("opens a blank window and looks up the Plex address", async () => {
    const open = jest.spyOn(window, "open").mockReturnValue(null);
    const { user } = renderCard();

    await user.click(screen.getByText("Arrival"));

    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    open.mockRestore();
  });

  it("labels a track differently from other content", () => {
    const { rerender } = renderCard();
    expect(screen.getByTitle("Open this in Plex")).toBeInTheDocument();

    rerender(
      <StreamCard
        stream={stream({ type: "track", title: "Roygbiv" })}
        isExpanded={false}
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );
    expect(screen.getByTitle("Open this album in Plex")).toBeInTheDocument();
  });
});

describe("StreamCard music disc", () => {
  const disc = () => screen.queryByTestId("music-disc");

  it("fills the empty background of a track that has no artwork", () => {
    renderCard({ type: "track", title: "Roygbiv" });
    expect(disc()).toBeInTheDocument();
  });

  it("stays out of the way of real artwork", () => {
    renderCard({ type: "track", title: "Roygbiv", artUrl: "/art.jpg" });
    expect(disc()).toBeNull();
  });

  it("leaves video alone", () => {
    renderCard();
    expect(disc()).toBeNull();
  });

  it("turns only while the track is playing", () => {
    renderCard({
      type: "track",
      title: "Roygbiv",
      Player: { title: "Phone", state: "playing" },
    });
    expect(disc()).toHaveClass("animate-spin");
  });

  it("rests when the track is paused", () => {
    renderCard({
      type: "track",
      title: "Roygbiv",
      Player: { title: "Phone", state: "paused" },
    });
    expect(disc()).not.toHaveClass("animate-spin");
  });
});
