import { render, screen } from "@testing-library/react";
import { PortalRules } from "@/components/portal/PortalRules";
import { portalRules } from "@/test-utils/portal";

describe("PortalRules", () => {
  it("summarises an open account", () => {
    render(<PortalRules rules={portalRules()} />);

    expect(screen.getByText("Local network and internet")).toBeInTheDocument();
    expect(screen.getByText("Any address")).toBeInTheDocument();
    expect(
      screen.getByText("Which addresses you can stream from"),
    ).toBeInTheDocument();
    expect(screen.getByText("Allowed straight away")).toBeInTheDocument();
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
    expect(screen.queryByText("Time schedule")).toBeNull();
  });

  it("summarises a restricted account", () => {
    render(
      <PortalRules
        rules={portalRules({
          networkPolicy: "lan",
          ipAccessPolicy: "restricted",
          allowedIPs: ["10.0.0.1", "10.0.0.2"],
          effectiveDefaultBlock: true,
          effectiveConcurrentStreamLimit: 2,
          timeRules: [
            {
              id: 1,
              dayOfWeek: 0,
              startTime: "01:00",
              endTime: "06:00",
              ruleName: "",
              enabled: true,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("Local network only")).toBeInTheDocument();
    expect(screen.getByText("Only listed addresses")).toBeInTheDocument();
    expect(
      screen.getByText("You can only stream from these addresses"),
    ).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.2")).toBeInTheDocument();
    expect(screen.getByText("Blocked until approved")).toBeInTheDocument();
    expect(screen.getByText("2 streams")).toBeInTheDocument();
    expect(screen.getByText("Time schedule")).toBeInTheDocument();
    expect(screen.getByText("Sunday")).toBeInTheDocument();
  });

  it("lists no addresses for a restricted account without any", () => {
    render(
      <PortalRules rules={portalRules({ ipAccessPolicy: "restricted" })} />,
    );

    expect(screen.getByText("Only listed addresses")).toBeInTheDocument();
    expect(
      screen.getByText("Which addresses you can stream from"),
    ).toBeInTheDocument();
  });
});
