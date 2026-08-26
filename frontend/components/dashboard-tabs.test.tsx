import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardTabs } from "@/components/dashboard-tabs";

const renderTabs = (
  props: Partial<React.ComponentProps<typeof DashboardTabs>> = {},
) => {
  const onTabChange = jest.fn();
  const view = render(
    <DashboardTabs
      activeTab={props.activeTab ?? "devices"}
      onTabChange={props.onTabChange ?? onTabChange}
      pendingDevices={props.pendingDevices ?? 0}
      activeStreams={props.activeStreams ?? 0}
    />,
  );

  return { ...view, onTabChange, user: userEvent.setup() };
};

describe("DashboardTabs", () => {
  it("labels each tab for both breakpoints", () => {
    renderTabs();

    expect(screen.getByText("Device Management")).toBeInTheDocument();
    expect(screen.getByText("Devices")).toBeInTheDocument();
    expect(screen.getByText("Active Streams")).toBeInTheDocument();
    expect(screen.getByText("Streams")).toBeInTheDocument();
  });

  it.each([
    ["devices", "Devices", "Streams"],
    ["streams", "Streams", "Devices"],
  ] as const)("marks %s as the active tab", (activeTab, active, inactive) => {
    renderTabs({ activeTab });

    const on = screen.getByText(active).closest("button");
    const off = screen.getByText(inactive).closest("button");

    expect(on?.className).toContain("bg-primary");
    expect(off?.className).not.toContain("bg-primary");
  });

  it.each([
    ["Devices", "devices"],
    ["Streams", "streams"],
  ] as const)("reports a switch to %s", async (label, tab) => {
    const { user, onTabChange } = renderTabs({ activeTab: "streams" });

    await user.click(screen.getByText(label));

    expect(onTabChange).toHaveBeenCalledWith(tab);
  });

  it("counts pending devices and active streams", () => {
    renderTabs({ pendingDevices: 3, activeStreams: 7 });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("drops both counters when there is nothing to report", () => {
    const { container } = renderTabs({ pendingDevices: 0, activeStreams: 0 });

    expect(container.querySelectorAll("[data-slot=badge]")).toHaveLength(0);
  });
});
