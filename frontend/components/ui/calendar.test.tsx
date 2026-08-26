import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";

const january = new Date(2026, 0, 15);

describe("Calendar", () => {
  it("renders a month grid", () => {
    render(<Calendar mode="single" defaultMonth={january} />);

    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("selects a day", async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <Calendar mode="single" defaultMonth={january} onSelect={onSelect} />,
    );

    await user.click(screen.getByText("20"));

    expect(onSelect).toHaveBeenCalled();
  });

  it("marks the selected day", () => {
    const { container } = render(
      <Calendar mode="single" defaultMonth={january} selected={january} />,
    );

    expect(
      container.querySelector('[data-selected-single="true"]'),
    ).not.toBeNull();
  });

  it("disables days on request", () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={january}
        disabled={{ before: new Date(2026, 0, 10) }}
      />,
    );

    expect(screen.getByText("5").closest("button")).toBeDisabled();
  });

  it("navigates between months", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Calendar mode="single" defaultMonth={january} />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText(/February/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous/i }));

    expect(screen.getByText(/January/)).toBeInTheDocument();
  });

  it("merges custom classes and hides outside days", () => {
    const { container } = render(
      <Calendar
        mode="single"
        defaultMonth={january}
        showOutsideDays={false}
        className="my-calendar"
      />,
    );

    expect(container.querySelector(".my-calendar")).not.toBeNull();
  });

  it("supports a dropdown caption", () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={january}
        captionLayout="dropdown"
        startMonth={new Date(2025, 0)}
        endMonth={new Date(2027, 11)}
      />,
    );

    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });

  it("takes a different button variant", () => {
    const { container } = render(
      <Calendar mode="single" defaultMonth={january} buttonVariant="outline" />,
    );

    expect(container.querySelector("button")).not.toBeNull();
  });

  it("accepts custom formatters", () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={january}
        captionLayout="dropdown"
        startMonth={new Date(2025, 0)}
        endMonth={new Date(2027, 11)}
        formatters={{
          formatMonthDropdown: (date) =>
            date.toLocaleString("default", { month: "long" }),
        }}
      />,
    );

    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });

  it("selects a range", () => {
    const { container } = render(
      <Calendar
        mode="range"
        defaultMonth={january}
        selected={{
          from: new Date(2026, 0, 10),
          to: new Date(2026, 0, 20),
        }}
      />,
    );

    expect(container.querySelector('[data-range-start="true"]')).not.toBeNull();
    expect(container.querySelector('[data-range-end="true"]')).not.toBeNull();
    expect(
      container.querySelector('[data-range-middle="true"]'),
    ).not.toBeNull();
  });
});

describe("CalendarDayButton", () => {
  const day = {
    date: new Date(2026, 0, 15),
  } as React.ComponentProps<typeof CalendarDayButton>["day"];

  it("stamps the date it represents", () => {
    const { container } = render(
      <CalendarDayButton
        day={day}
        modifiers={
          {} as React.ComponentProps<typeof CalendarDayButton>["modifiers"]
        }
      >
        15
      </CalendarDayButton>,
    );

    expect(container.querySelector("[data-day]")).toHaveAttribute(
      "data-day",
      new Date(2026, 0, 15).toLocaleDateString(),
    );
  });

  it("focuses itself when the day is focused", () => {
    render(
      <CalendarDayButton
        day={day}
        modifiers={
          { focused: true } as unknown as React.ComponentProps<
            typeof CalendarDayButton
          >["modifiers"]
        }
      >
        15
      </CalendarDayButton>,
    );

    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("merges a custom class", () => {
    const { container } = render(
      <CalendarDayButton
        day={day}
        modifiers={
          {} as React.ComponentProps<typeof CalendarDayButton>["modifiers"]
        }
        className="my-day"
      >
        15
      </CalendarDayButton>,
    );

    expect(container.querySelector(".my-day")).not.toBeNull();
  });
});
