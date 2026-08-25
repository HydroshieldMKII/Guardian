import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice, UserPreference } from "@/types";
import { IPAccessModal } from "@/components/device-management/IPAccessModal";

const preference = (
  overrides: Partial<UserPreference> = {},
): UserPreference => ({
  id: 1,
  userId: "u-1",
  defaultBlock: null,
  hidden: false,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  allowedIPs: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "Living Room TV",
  approved: true,
  status: "approved",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-01-01T00:00:00Z",
  sessionCount: 3,
  ...overrides,
});

const renderModal = (
  overrides: {
    preference?: UserPreference;
    userDevices?: UserDevice[];
    isOpen?: boolean;
  } = {},
) => {
  const onSave = jest.fn();
  const onClose = jest.fn();

  const view = render(
    <IPAccessModal
      isOpen={overrides.isOpen ?? true}
      onClose={onClose}
      user={{
        userId: "u-1",
        username: "vincent",
        preference: overrides.preference ?? preference(),
      }}
      userDevices={overrides.userDevices ?? []}
      onSave={onSave}
    />,
  );

  return { ...view, onSave, onClose, user: userEvent.setup() };
};

const ipField = () => screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/);

const submitIP = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    within(ipField().parentElement as HTMLElement).getByRole("button"),
  );

const addIP = async (user: ReturnType<typeof userEvent.setup>, ip: string) => {
  await user.type(ipField(), ip);
  await submitIP(user);
};

const restrictedModal = async () => {
  const rendered = renderModal({
    preference: preference({ ipAccessPolicy: "restricted" }),
  });
  return rendered;
};

describe("IPAccessModal", () => {
  it("renders nothing while closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText("IP & Network Access Policies")).toBeNull();
  });

  it("names the user it is configuring", () => {
    renderModal();
    expect(screen.getByText("vincent")).toBeInTheDocument();
  });

  it("falls back to the user id when there is no username", () => {
    render(
      <IPAccessModal
        isOpen
        onClose={jest.fn()}
        user={{ userId: "u-42" }}
        userDevices={[]}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText("u-42")).toBeInTheDocument();
  });

  it("seeds its controls from the existing preference", () => {
    renderModal({
      preference: preference({
        networkPolicy: "lan",
        ipAccessPolicy: "restricted",
        allowedIPs: ["10.0.0.0/8", "2001:db8::/32"],
      }),
    });

    expect(screen.getByText("2 IP addresses configured")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.0/8")).toBeInTheDocument();
    expect(screen.getByText("2001:db8::/32")).toBeInTheDocument();
  });

  it("defaults every control when the user has no preference at all", () => {
    render(
      <IPAccessModal
        isOpen
        onClose={jest.fn()}
        user={{ userId: "u-1", username: "vincent" }}
        userDevices={[]}
        onSave={jest.fn()}
      />,
    );

    expect(screen.queryByText(/IP addresses? configured/)).toBeNull();
    expect(screen.queryByPlaceholderText(/e\.g\. 192\.168\.1\.100/)).toBeNull();
  });

  describe("network policy", () => {
    it.each([
      ["Both (LAN + WAN)", "both"],
      ["LAN", "lan"],
      ["WAN", "wan"],
    ])("saves %s", async (label, expected) => {
      const { user, onSave } = renderModal();

      await user.click(screen.getByText(label));
      await user.click(screen.getByRole("button", { name: "Save Policies" }));

      expect(onSave).toHaveBeenCalledWith(
        "u-1",
        expect.objectContaining({ networkPolicy: expected }),
      );
    });

    it("describes what each policy does", () => {
      renderModal();
      expect(
        screen.getByText(
          "Allow streaming from both local network and internet",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Only allow streaming from local network (same subnet)",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Only allow streaming from internet (remote access)"),
      ).toBeInTheDocument();
    });
  });

  describe("the allowed-IP list", () => {
    it("stays hidden while access is unrestricted", () => {
      renderModal();
      expect(
        screen.queryByPlaceholderText(/e\.g\. 192\.168\.1\.100/),
      ).toBeNull();
    });

    it("appears once access is restricted", async () => {
      const { user } = renderModal();
      await user.click(screen.getByText("restricted"));
      expect(
        screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/),
      ).toBeInTheDocument();
    });

    it.each([
      "192.168.1.50",
      "192.168.1.0/24",
      "2001:db8::1",
      "2001:db8::/32",
      "fe80::1%eth0",
    ])("accepts %s", async (ip) => {
      const { user } = await restrictedModal();
      await addIP(user, ip);

      expect(screen.getByText(ip)).toBeInTheDocument();
      expect(screen.getByText("1 IP address configured")).toBeInTheDocument();
    });

    it.each(["not-an-ip", "999.1.1.1", "010.0.0.1", "2001:db8::/129"])(
      "rejects %s with an error naming both families",
      async (ip) => {
        const { user } = await restrictedModal();
        await addIP(user, ip);

        expect(
          screen.getByText(
            /Please enter a valid IP address or CIDR range.*2001:db8::1/,
          ),
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/^\d+ IP address(es)? configured$/),
        ).toBeNull();
      },
    );

    it("ignores an empty submission", async () => {
      const { user } = await restrictedModal();
      await submitIP(user);

      expect(screen.queryByText(/Please enter a valid IP/)).toBeNull();
      expect(screen.queryByText(/^\d+ IP address(es)? configured$/)).toBeNull();
    });

    it("adds on Enter", async () => {
      const { user } = await restrictedModal();
      await user.type(
        screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/),
        "2001:db8::5{Enter}",
      );

      expect(screen.getByText("2001:db8::5")).toBeInTheDocument();
    });

    it("refuses a duplicate", async () => {
      const { user } = await restrictedModal();
      await addIP(user, "10.0.0.1");
      await addIP(user, "10.0.0.1");

      expect(
        screen.getByText("This IP address is already in the list"),
      ).toBeInTheDocument();
      expect(screen.getByText("1 IP address configured")).toBeInTheDocument();
    });

    it("clears the error as soon as the field is edited again", async () => {
      const { user } = await restrictedModal();
      await addIP(user, "nope");
      expect(screen.getByText(/Please enter a valid IP/)).toBeInTheDocument();

      await user.type(
        screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/),
        "1",
      );
      expect(screen.queryByText(/Please enter a valid IP/)).toBeNull();
    });

    it("removes an entry", async () => {
      const { user } = renderModal({
        preference: preference({
          ipAccessPolicy: "restricted",
          allowedIPs: ["10.0.0.1", "10.0.0.2"],
        }),
      });

      await user.click(
        within(screen.getByText("10.0.0.1")).getByRole("button"),
      );

      expect(screen.queryByText("10.0.0.1")).toBeNull();
      expect(screen.getByText("10.0.0.2")).toBeInTheDocument();
      expect(screen.getByText("1 IP address configured")).toBeInTheDocument();
    });

    it("warns while restricted with an empty list", async () => {
      await restrictedModal();
      expect(
        screen.getByText(/No IP addresses configured/),
      ).toBeInTheDocument();
    });
  });

  describe("auto-filling from current devices", () => {
    it("is offered only when the user has devices", async () => {
      renderModal({ preference: preference({ ipAccessPolicy: "restricted" }) });
      expect(
        screen.queryByRole("button", { name: /Add Current Device IPs/ }),
      ).toBeNull();
    });

    it("adds each distinct device IP once, skipping ones already listed", async () => {
      const { user } = renderModal({
        preference: preference({
          ipAccessPolicy: "restricted",
          allowedIPs: ["10.0.0.1"],
        }),
        userDevices: [
          device({ id: 1, ipAddress: "10.0.0.1" }),
          device({ id: 2, ipAddress: "2001:db8::7" }),
          device({ id: 3, ipAddress: "2001:db8::7" }),
          device({ id: 4, ipAddress: undefined }),
        ],
      });

      await user.click(
        screen.getByRole("button", { name: /Add Current Device IPs/ }),
      );

      expect(screen.getByText("2 IP addresses configured")).toBeInTheDocument();
    });

    it("does nothing when every device IP is already listed", async () => {
      const { user } = renderModal({
        preference: preference({
          ipAccessPolicy: "restricted",
          allowedIPs: ["10.0.0.1"],
        }),
        userDevices: [device({ ipAddress: "10.0.0.1" })],
      });

      await user.click(
        screen.getByRole("button", { name: /Add Current Device IPs/ }),
      );

      expect(screen.getByText("1 IP address configured")).toBeInTheDocument();
    });
  });

  describe("the current-device summary", () => {
    it("labels each device with its network type", () => {
      renderModal({
        userDevices: [
          device({ id: 1, deviceName: "TV", ipAddress: "192.168.1.10" }),
          device({ id: 2, deviceName: "Phone", ipAddress: "2001:db8::1" }),
          device({ id: 3, deviceName: "Laptop", ipAddress: "fd00::1" }),
          device({ id: 4, deviceName: "Ghost", ipAddress: undefined }),
        ],
      });

      expect(screen.getByText(/192\.168\.1\.10 \(LAN\)/)).toBeInTheDocument();
      expect(screen.getByText(/2001:db8::1 \(WAN\)/)).toBeInTheDocument();
      expect(screen.getByText(/fd00::1 \(LAN\)/)).toBeInTheDocument();
      expect(screen.queryByText("Ghost")).toBeNull();
    });

    it("falls back to the device identifier when it has no name", () => {
      renderModal({
        userDevices: [
          device({ deviceName: undefined, ipAddress: "192.168.1.10" }),
        ],
      });
      expect(screen.getByText("device-1")).toBeInTheDocument();
    });

    it("falls back to the user id in its heading", () => {
      render(
        <IPAccessModal
          isOpen
          onClose={jest.fn()}
          user={{ userId: "u-42" }}
          userDevices={[device({ ipAddress: "10.0.0.1" })]}
          onSave={jest.fn()}
        />,
      );
      expect(
        screen.getByText(/Current Device IPs for u-42/),
      ).toBeInTheDocument();
    });

    it("is omitted entirely when the user has no devices", () => {
      renderModal();
      expect(screen.queryByText(/Current Device IPs for/)).toBeNull();
    });
  });

  describe("saving", () => {
    it("discards the allow list when access is unrestricted", async () => {
      const { user, onSave } = renderModal({
        preference: preference({
          ipAccessPolicy: "restricted",
          allowedIPs: ["10.0.0.1"],
        }),
      });

      await user.click(screen.getByText("all"));
      await user.click(screen.getByRole("button", { name: "Save Policies" }));

      expect(onSave).toHaveBeenCalledWith("u-1", {
        networkPolicy: "both",
        ipAccessPolicy: "all",
        allowedIPs: [],
      });
    });

    it("passes the allow list through when restricted", async () => {
      const { user, onSave } = renderModal({
        preference: preference({
          networkPolicy: "wan",
          ipAccessPolicy: "restricted",
          allowedIPs: ["2001:db8::/32"],
        }),
      });

      await user.click(screen.getByRole("button", { name: "Save Policies" }));

      expect(onSave).toHaveBeenCalledWith("u-1", {
        networkPolicy: "wan",
        ipAccessPolicy: "restricted",
        allowedIPs: ["2001:db8::/32"],
      });
    });

    it("cannot be submitted while restricted with an empty list", async () => {
      const { onSave } = await restrictedModal();
      expect(
        screen.getByRole("button", { name: "Save Policies" }),
      ).toBeDisabled();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("closes on cancel without saving", async () => {
      const { user, onSave, onClose } = renderModal();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it("re-seeds from the preference each time it reopens", async () => {
    const { rerender } = renderModal({
      preference: preference({
        ipAccessPolicy: "restricted",
        allowedIPs: ["10.0.0.1"],
      }),
    });

    const props = (isOpen: boolean, allowedIPs: string[]) => (
      <IPAccessModal
        isOpen={isOpen}
        onClose={jest.fn()}
        user={{
          userId: "u-1",
          username: "vincent",
          preference: preference({
            ipAccessPolicy: "restricted",
            allowedIPs,
          }),
        }}
        userDevices={[]}
        onSave={jest.fn()}
      />
    );

    rerender(props(false, ["10.0.0.1"]));
    rerender(props(true, ["2001:db8::9"]));

    expect(screen.getByText("2001:db8::9")).toBeInTheDocument();
    expect(screen.queryByText("10.0.0.1")).toBeNull();
  });
});
