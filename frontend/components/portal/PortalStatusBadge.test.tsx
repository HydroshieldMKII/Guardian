import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalStatusBadge } from "@/components/portal/PortalStatusBadge";
import { portalDevice } from "@/test-utils/portal";

const inTwoHours = () =>
  new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

describe("PortalStatusBadge", () => {
  it.each([
    ["approved", "Approved", "You can stream on it."],
    ["rejected", "Rejected", "You cannot stream on it."],
    ["pending", "Pending", "has not reviewed this device yet."],
  ] as const)("labels a %s device", (status, label, hint) => {
    render(<PortalStatusBadge device={portalDevice({ status })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(hint))).toBeInTheDocument();
  });

  it("tells a pending device its note was sent", () => {
    render(
      <PortalStatusBadge
        device={portalDevice({ requestSubmittedAt: "2026-01-01T00:00:00Z" })}
      />,
    );
    expect(
      screen.getByText(/Your note has been sent to them\./),
    ).toBeInTheDocument();
  });

  it("does not mention a note on a rejected device", () => {
    render(
      <PortalStatusBadge
        device={portalDevice({
          status: "rejected",
          requestSubmittedAt: "2026-01-01T00:00:00Z",
        })}
      />,
    );
    expect(screen.queryByText(/Your note has been sent/)).toBeNull();
  });

  it("shows temporary access over the status while it lasts", () => {
    render(
      <PortalStatusBadge
        device={portalDevice({
          status: "rejected",
          hasTemporaryAccess: true,
          temporaryAccessUntil: inTwoHours(),
        })}
      />,
    );
    expect(screen.getByText("Temporary access")).toBeInTheDocument();
    expect(screen.queryByText("Rejected")).toBeNull();
    expect(
      screen.getByText(/^Temporary access expires in/),
    ).toBeInTheDocument();
  });

  it.each([
    [true, "text-special"],
    [false, "text-info"],
  ])(
    "tones temporary access by whether it bypasses policies (%s)",
    async (bypass, tone) => {
      const user = userEvent.setup();
      render(
        <PortalStatusBadge
          device={portalDevice({
            hasTemporaryAccess: true,
            temporaryAccessUntil: inTwoHours(),
            temporaryAccessBypassPolicies: bypass,
          })}
        />,
      );
      const pill = screen.getByText("Temporary access");
      expect(pill.closest("span[class*='text-']")).toHaveClass(tone);

      await user.hover(pill);

      expect(
        (await screen.findAllByText("Temporary access granted")).length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryAllByText(/do not apply to this device/).length > 0,
      ).toBe(bypass);
    },
  );

  it("falls back to the status when temporary access has no end", () => {
    render(
      <PortalStatusBadge device={portalDevice({ hasTemporaryAccess: true })} />,
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
