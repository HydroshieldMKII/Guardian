import { render } from "@testing-library/react";
import { ThreeDotLoader } from "@/components/three-dot-loader";

describe("ThreeDotLoader", () => {
  it("renders three staggered dots", () => {
    const { container } = render(<ThreeDotLoader />);
    const dots = container.querySelectorAll("div.animate-bounce");

    expect(dots).toHaveLength(3);
    expect(
      Array.from(dots).map((dot) => (dot as HTMLElement).style.animationDelay),
    ).toEqual(["0s", "0.2s", "0.4s"]);
  });
});
