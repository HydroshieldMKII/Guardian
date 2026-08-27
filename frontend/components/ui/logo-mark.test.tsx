import { render } from "@testing-library/react";
import { LogoMark } from "@/components/ui/logo-mark";

describe("LogoMark", () => {
  const mark = (className?: string) =>
    render(<LogoMark className={className} />).container.querySelector("svg");

  it("takes its colour from the surrounding text", () => {
    expect(mark()).toHaveAttribute("fill", "currentColor");
  });

  it("stays out of the accessibility tree", () => {
    expect(mark()).toHaveAttribute("aria-hidden");
  });

  it("keeps its own sizing classes alongside the caller's", () => {
    expect(mark("h-9 w-auto")).toHaveClass("shrink-0", "h-9", "w-auto");
  });
});
