import { render, screen, within } from "@testing-library/react";
import { ScheduleList } from "@/components/portal/ScheduleList";
import type { PortalTimeRule } from "@/types";

const rule = (overrides: Partial<PortalTimeRule> = {}): PortalTimeRule => ({
  id: 1,
  dayOfWeek: 1,
  startTime: "22:00",
  endTime: "23:30",
  ruleName: "",
  enabled: true,
  ...overrides,
});

describe("ScheduleList", () => {
  it("lists each blocked window by day and hours", () => {
    render(
      <ScheduleList
        rules={[rule(), rule({ id: 2, dayOfWeek: 6, enabled: false })]}
      />,
    );
    const [monday, saturday] = screen.getAllByRole("listitem");

    expect(within(monday).getByText("Monday")).toBeInTheDocument();
    expect(within(monday).getByText("22:00 – 23:30")).toBeInTheDocument();
    expect(within(monday).getByText("Blocking")).toBeInTheDocument();
    expect(within(saturday).getByText("Saturday")).toBeInTheDocument();
    expect(within(saturday).getByText("Paused")).toBeInTheDocument();
  });

  it("names a rule after its day", () => {
    render(<ScheduleList rules={[rule({ ruleName: "School night" })]} />);
    expect(screen.getByText("(School night)")).toBeInTheDocument();
  });
});
