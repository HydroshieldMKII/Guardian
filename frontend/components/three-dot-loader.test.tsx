import { render, screen } from "@testing-library/react";
import { PageLoader, ThreeDotLoader } from "@/components/three-dot-loader";

describe("ThreeDotLoader", () => {
  it("renders three staggered dots", () => {
    const { container } = render(<ThreeDotLoader />);
    const dots = container.querySelectorAll("span.animate-loader-dot");

    expect(dots).toHaveLength(3);
    expect(
      Array.from(dots).map((dot) => (dot as HTMLElement).style.animationDelay),
    ).toEqual(["0ms", "160ms", "320ms"]);
  });

  it("announces itself and waits a beat before fading in", () => {
    render(<ThreeDotLoader className="extra" />);
    const status = screen.getByRole("status", { name: "Loading" });

    expect(status).toHaveClass("delay-200", "fade-in", "extra");
  });
});

describe("PageLoader", () => {
  it("pins the loader to the centre of the viewport", () => {
    render(<PageLoader />);

    expect(screen.getByRole("status").parentElement).toHaveClass(
      "fixed",
      "inset-0",
    );
  });
});
