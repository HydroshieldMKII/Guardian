import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import {
  ClickableIP,
  DeviceStatus,
  UserAvatar,
  getDeviceIcon,
  getUserPreferenceBadge,
} from "@/components/device-management/SharedComponents";

const hasTemporaryAccess = jest.fn();
const getTemporaryAccessTimeLeft = jest.fn();

jest.mock("@/hooks/device-management/useDeviceUtils", () => ({
  useDeviceUtils: () => ({ hasTemporaryAccess, getTemporaryAccessTimeLeft }),
}));

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 1,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  hasTemporaryAccess.mockReturnValue(false);
  getTemporaryAccessTimeLeft.mockReturnValue("30m");
});

describe("ClickableIP", () => {
  it.each([null, undefined, "Unknown IP", "Unknown"])(
    "renders %p as plain text",
    (ip) => {
      render(<ClickableIP ipAddress={ip} />);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByText(ip || "Unknown IP")).toBeInTheDocument();
    },
  );

  it("links a real address to ipinfo without bubbling", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const onParentClick = jest.fn();
    const user = userEvent.setup();

    render(
      <div onClick={onParentClick}>
        <ClickableIP ipAddress="2001:db8::1" />
      </div>,
    );
    await user.click(screen.getByRole("button"));

    expect(open).toHaveBeenCalledWith(
      "https://ipinfo.io/2001:db8::1",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onParentClick).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("UserAvatar", () => {
  it("uses the first two letters of the username", () => {
    render(<UserAvatar userId="u-1" username="testuser" />);
    expect(screen.getByText("TE")).toBeInTheDocument();
  });

  it("falls back to the user id", () => {
    render(<UserAvatar userId="ab-1" />);
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("renders an image when an avatar url is supplied", () => {
    const { container } = render(
      <UserAvatar userId="u-1" username="testuser" avatarUrl="/a.png" />,
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });
});

describe("getDeviceIcon", () => {
  it.each([
    ["Android", undefined, "lucide-smartphone"],
    ["iPhone", undefined, "lucide-smartphone"],
    ["iOS", undefined, "lucide-smartphone"],
    ["Mobile", undefined, "lucide-smartphone"],
    ["Apple TV", undefined, "lucide-tv"],
    ["Roku", undefined, "lucide-tv"],
    ["Chromecast", undefined, "lucide-tv"],
    ["Windows", undefined, "lucide-laptop"],
    ["Mac", undefined, "lucide-laptop"],
    ["Linux", undefined, "lucide-laptop"],
    ["Something", undefined, "lucide-monitor"],
    [null, "Plex for Roku", "lucide-tv"],
    [null, null, "lucide-monitor"],
    [undefined, undefined, "lucide-monitor"],
  ])("maps platform %p / product %p", (platform, product, expected) => {
    const { container } = render(<div>{getDeviceIcon(platform, product)}</div>);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      expected,
    );
  });
});

describe("DeviceStatus", () => {
  it("shows temporary access with the time remaining", () => {
    hasTemporaryAccess.mockReturnValue(true);
    render(<DeviceStatus device={device()} />);

    expect(screen.getByText("Temporary Access (30m left)")).toBeInTheDocument();
  });

  it("drops the time remaining in compact mode", () => {
    hasTemporaryAccess.mockReturnValue(true);
    render(<DeviceStatus device={device()} compact />);

    expect(screen.getByText("Temporary Access")).toBeInTheDocument();
  });

  it.each([
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["pending", "Pending"],
  ] as const)("renders the %s badge", (status, label) => {
    render(<DeviceStatus device={device({ status })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ["deviceProduct", { deviceProduct: "Plexamp" }],
    ["deviceName", { deviceName: "Office PlexAmp" }],
  ])(
    "marks a pending PlexAmp device unmanageable via %s",
    (_label, overrides) => {
      render(
        <DeviceStatus device={device({ status: "pending", ...overrides })} />,
      );
      expect(screen.getByText("Not Manageable")).toBeInTheDocument();
    },
  );

  it("still reports an approved PlexAmp device as approved", () => {
    render(
      <DeviceStatus
        device={device({ status: "approved", deviceProduct: "Plexamp" })}
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("toggles the unmanageable tooltip on a narrow viewport", async () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    const user = userEvent.setup();

    render(<DeviceStatus device={device({ deviceProduct: "Plexamp" })} />);
    await user.click(screen.getByRole("button"));

    expect(
      screen.getAllByText(/PlexAmp devices cannot be managed/).length,
    ).toBeGreaterThan(0);

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: original,
    });
  });

  it("opens the unmanageable tooltip on hover on a wide viewport", async () => {
    const user = userEvent.setup();
    render(<DeviceStatus device={device({ deviceProduct: "Plexamp" })} />);

    await user.hover(screen.getByRole("button"));

    expect(
      screen.getAllByText(/PlexAmp devices cannot be managed/).length,
    ).toBeGreaterThan(0);

    await user.unhover(screen.getByRole("button"));
  });
});

describe("getUserPreferenceBadge", () => {
  it.each([
    [null, "Global Default"],
    [true, "Block by Default"],
    [false, "Allow by Default"],
  ])("renders %p as %s", (defaultBlock, label) => {
    render(<div>{getUserPreferenceBadge(defaultBlock)}</div>);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
