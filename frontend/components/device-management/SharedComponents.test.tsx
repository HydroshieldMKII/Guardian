import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import {
  ClickableIP,
  DeviceStatus,
  UserAvatar,
  getUserPreferenceBadge,
} from "@/components/device-management/SharedComponents";

const inMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

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
});

describe("ClickableIP", () => {
  it.each([null, undefined, "Unknown IP", "Unknown"])(
    "renders %p as plain text",
    (ip) => {
      render(<ClickableIP ipAddress={ip} />);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByText(ip || "Unknown")).toBeInTheDocument();
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

describe("DeviceStatus", () => {
  it("names the grant and keeps the countdown in its tooltip", () => {
    render(
      <DeviceStatus device={device({ temporaryAccessUntil: inMinutes(30) })} />,
    );

    const pill = screen.getByText("Temporary Access").closest("span[title]");
    expect(pill).toHaveAttribute("title", "Expires in 30 minutes");
  });

  it("never lets the pill outgrow the field it sits in", () => {
    render(
      <DeviceStatus
        device={device({ temporaryAccessUntil: inMinutes(60 * 24 * 9) })}
      />,
    );

    const pill = screen.getByText("Temporary Access").closest("span[title]");
    expect(pill?.className).toContain("max-w-full");
  });

  it("ignores a grant that has already lapsed", () => {
    render(
      <DeviceStatus
        device={device({ temporaryAccessUntil: inMinutes(-30) })}
      />,
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
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
    "marks a pending Plexamp device unmanageable via %s",
    (_label, overrides) => {
      render(
        <DeviceStatus device={device({ status: "pending", ...overrides })} />,
      );
      expect(screen.getByText("Not Manageable")).toBeInTheDocument();
    },
  );

  it("still reports an approved Plexamp device as approved", () => {
    render(
      <DeviceStatus
        device={device({ status: "approved", deviceProduct: "Plexamp" })}
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("keeps the unmanageable tooltip shut until asked", () => {
    render(<DeviceStatus device={device({ deviceProduct: "Plexamp" })} />);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not open the tooltip when the badge merely takes focus", async () => {
    render(<DeviceStatus device={device({ deviceProduct: "Plexamp" })} />);

    screen.getByRole("button").focus();

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("explains itself to a screen reader with the tooltip closed", () => {
    render(<DeviceStatus device={device({ deviceProduct: "Plexamp" })} />);

    expect(
      screen.getByRole("button", { name: /Plexamp devices cannot be managed/ }),
    ).toBeInTheDocument();
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
      screen.getAllByText(/Plexamp devices cannot be managed/).length,
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
      screen.getAllByText(/Plexamp devices cannot be managed/).length,
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
