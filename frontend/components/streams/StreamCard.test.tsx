import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlexSession } from "@/types";
import { StreamCard } from "@/components/streams/StreamCard";

jest.mock("@/components/streams/StreamQuality", () => ({
  StreamQuality: () => <span>quality-inline</span>,
  StreamQualityDetails: () => <span>quality-details</span>,
}));
jest.mock("@/components/streams/StreamDeviceInfo", () => ({
  StreamDeviceInfo: () => <span>device-info</span>,
}));
jest.mock("@/components/streams/StreamProgress", () => ({
  StreamProgress: () => <span>progress</span>,
}));

const stream = (overrides: Record<string, unknown> = {}) =>
  ({
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
  }) as unknown as PlexSession;

const renderCard = (
  overrides: Record<string, unknown> = {},
  props: Partial<{ isExpanded: boolean; isRevoking: boolean }> = {},
) => {
  const onToggleExpand = jest.fn();
  const onRemoveAccess = jest.fn();
  const onNavigateToDevice = jest.fn();
  const onNavigateToUser = jest.fn();
  const view = render(
    <StreamCard
      stream={stream(overrides)}
      index={0}
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
  global.fetch = fetchMock as unknown as typeof fetch;
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

    expect(screen.getByText("Arrival (2016)")).toBeInTheDocument();
    expect(screen.getByText("alice · Living Room TV")).toBeInTheDocument();
    expect(screen.getByText("quality-inline")).toBeInTheDocument();
    expect(screen.getByText("progress")).toBeInTheDocument();
  });

  it("spends the corner on actions rather than a badge every card repeats", async () => {
    const { user } = renderCard();

    expect(screen.queryByText("Streaming")).toBeNull();
    expect(await menuLabels(user)).toEqual([
      "See User",
      "See Device",
      "View Details",
      "Remove Access",
    ]);
  });

  it("keeps the actions in the header, not in a row of their own", () => {
    const { container } = renderCard();
    const heading = screen.getByText("Arrival (2016)").closest("h4");

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
    expect(screen.getByAltText("Arrival (2016)")).toBeInTheDocument();
  });

  it("omits the poster block without a thumbnail", () => {
    renderCard();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("survives a poster error with no fallback node", () => {
    const { container } = renderCard({ thumbnailUrl: "/poster.jpg" });
    const img = screen.getByAltText("Arrival (2016)") as HTMLImageElement;
    container.querySelector(".thumbnail-fallback")?.remove();

    fireEvent.error(img);

    expect(img.style.display).toBe("none");
  });

  it("hides the poster when it fails to load", () => {
    renderCard({ thumbnailUrl: "/poster.jpg" });
    const img = screen.getByAltText("Arrival (2016)") as HTMLImageElement;

    fireEvent.error(img);

    expect(img.style.display).toBe("none");
  });

  it("paints the artwork background and overlay", () => {
    const { container } = renderCard({ artUrl: "/art.jpg" });
    const card = container.firstElementChild as HTMLElement;

    expect(card.style.backgroundImage).toContain("/art.jpg");
    expect(container.innerHTML).toContain("from-black/85");
  });

  it("shows the details only when expanded", () => {
    const { rerender } = renderCard();
    expect(screen.queryByText("quality-details")).toBeNull();

    rerender(
      <StreamCard
        stream={stream()}
        index={0}
        isExpanded
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );

    expect(screen.getByText("quality-details")).toBeInTheDocument();
    expect(screen.getByText("device-info")).toBeInTheDocument();
  });

  it("swaps the details label when expanded", async () => {
    const collapsed = renderCard();
    expect(await menuLabels(collapsed.user)).toContain("View Details");

    collapsed.unmount();

    const expanded = renderCard({}, { isExpanded: true });
    expect(await menuLabels(expanded.user)).toContain("Hide Details");
  });
});

describe("StreamCard navigation", () => {
  it("scrolls to the user", async () => {
    const { user, onNavigateToUser } = renderCard();

    await choose(user, "See User");

    expect(onNavigateToUser).toHaveBeenCalledWith("u-1");
  });

  it("does not scroll to a user it cannot identify", async () => {
    const { user, onNavigateToUser } = renderCard({ User: undefined });

    await choose(user, "See User");

    expect(onNavigateToUser).not.toHaveBeenCalled();
  });

  it("scrolls to the device", async () => {
    const { user, onNavigateToDevice } = renderCard();

    await choose(user, "See Device");

    expect(onNavigateToDevice).toHaveBeenCalledWith("u-1", "m-1");
  });

  it("does not scroll to a device it cannot identify", async () => {
    const { user, onNavigateToDevice } = renderCard({ Player: undefined });

    await choose(user, "See Device");

    expect(onNavigateToDevice).not.toHaveBeenCalled();
  });

  it("works with no navigation callbacks at all", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <StreamCard
        stream={stream()}
        index={0}
        isExpanded={false}
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );

    await choose(user, "See User");
    await choose(user, "See Device");

    expect(screen.getByText("Arrival (2016)")).toBeInTheDocument();
  });

  it("offers one navigation entry per target, not a mobile duplicate", async () => {
    const { user } = renderCard();
    const labels = await menuLabels(user);

    expect(labels).toEqual([...new Set(labels)]);
  });

  it("disables navigation without identifiers", async () => {
    const { user } = renderCard({ User: undefined, Player: undefined });
    await openMenu(user);

    for (const label of ["See User", "See Device"]) {
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

    await choose(user, "Remove Access");

    expect(onRemoveAccess).toHaveBeenCalled();
  });

  it("separates removal from the navigation entries", async () => {
    const { user } = renderCard();
    await openMenu(user);

    const remove = screen.getByRole("menuitem", { name: "Remove Access" });

    expect(remove.previousElementSibling?.getAttribute("role")).toBe(
      "separator",
    );
    expect(remove.className).toContain("text-rose-600");
  });

  it("spins the trigger and blocks the menu while revoking", () => {
    renderCard({}, { isRevoking: true });

    const trigger = screen.getByRole("button", { name: /Actions/ });

    expect(trigger).toBeDisabled();
    expect(trigger.querySelector(".animate-spin")).not.toBeNull();
  });

  it("does nothing without a user or device identifier", async () => {
    const { user, onRemoveAccess } = renderCard({ User: undefined });

    await choose(user, "Remove Access");

    expect(onRemoveAccess).not.toHaveBeenCalled();
  });

  it("hides the entry entirely for Plexamp", async () => {
    const { user } = renderCard({
      Player: { product: "Plexamp", machineIdentifier: "m-1" },
    });

    expect(await menuLabels(user)).not.toContain("Remove Access");
  });
});

describe("StreamCard expanding", () => {
  it("expands from the details entry", async () => {
    const { user, onToggleExpand } = renderCard();

    await choose(user, "View Details");

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("collapses from the same entry when open", async () => {
    const { user, onToggleExpand } = renderCard({}, { isExpanded: true });

    await choose(user, "Hide Details");

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("does not expand when a navigation entry is used", async () => {
    const { user, onToggleExpand, onNavigateToUser } = renderCard();

    await choose(user, "See User");

    expect(onNavigateToUser).toHaveBeenCalled();
    expect(onToggleExpand).not.toHaveBeenCalled();
  });
});

describe("StreamCard opening in Plex", () => {
  it("opens the item on the right server", async () => {
    const newWindow = { location: { href: "" }, close: jest.fn() };
    const open = jest
      .spyOn(window, "open")
      .mockReturnValue(newWindow as unknown as Window);
    const { user } = renderCard();

    await user.click(screen.getByText("Arrival (2016)"));

    await waitFor(() =>
      expect(newWindow.location.href).toBe(
        "https://plex.test/web/index.html#!/server/server-1/details?key=%2Flibrary%2Fmetadata%2Frk-1",
      ),
    );
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    open.mockRestore();
  });

  it("uses the album key for a music track", async () => {
    const newWindow = { location: { href: "" }, close: jest.fn() };
    jest.spyOn(window, "open").mockReturnValue(newWindow as unknown as Window);
    const { user } = renderCard({
      type: "track",
      title: "Roygbiv",
      ratingKey: "track-1",
      parentRatingKey: "album-1",
    });

    await user.click(screen.getByText("Roygbiv"));

    await waitFor(() => expect(newWindow.location.href).toContain("album-1"));
  });

  it("warns and opens nothing without a rating key", async () => {
    const open = jest.spyOn(window, "open").mockReturnValue(null);
    const { user } = renderCard({ ratingKey: undefined });

    await user.click(screen.getByText("Arrival (2016)"));

    expect(consoleWarn).toHaveBeenCalledWith("No rating key found for stream");
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("errors and opens nothing without a server identifier", async () => {
    const open = jest.spyOn(window, "open").mockReturnValue(null);
    const { user } = renderCard({ serverMachineIdentifier: undefined });

    await user.click(screen.getByText("Arrival (2016)"));

    expect(consoleError).toHaveBeenCalledWith(
      "No server machine identifier available",
    );
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("closes the blank window when the backend has no web url", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({}) });
    const newWindow = { location: { href: "" }, close: jest.fn() };
    jest.spyOn(window, "open").mockReturnValue(newWindow as unknown as Window);
    const { user } = renderCard();

    await user.click(screen.getByText("Arrival (2016)"));

    await waitFor(() => expect(newWindow.close).toHaveBeenCalled());
    expect(consoleWarn).toHaveBeenCalledWith("No Plex web URL available");
  });

  it("closes the blank window when the lookup fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const newWindow = { location: { href: "" }, close: jest.fn() };
    jest.spyOn(window, "open").mockReturnValue(newWindow as unknown as Window);
    const { user } = renderCard();

    await user.click(screen.getByText("Arrival (2016)"));

    await waitFor(() => expect(newWindow.close).toHaveBeenCalled());
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to get Plex web URL:",
      expect.any(Error),
    );
  });

  it("survives a blocked popup", async () => {
    jest.spyOn(window, "open").mockReturnValue(null);
    const { user } = renderCard();

    await user.click(screen.getByText("Arrival (2016)"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("labels a track differently from other content", () => {
    const { rerender } = renderCard();
    expect(screen.getByTitle("Click to open in Plex")).toBeInTheDocument();

    rerender(
      <StreamCard
        stream={stream({ type: "track", title: "Roygbiv" })}
        index={0}
        isExpanded={false}
        isRevoking={false}
        onToggleExpand={jest.fn()}
        onRemoveAccess={jest.fn()}
      />,
    );
    expect(
      screen.getByTitle("Click to open album in Plex"),
    ).toBeInTheDocument();
  });
});
