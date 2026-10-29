import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { scrollEdgeMask, useScrollEdges } from "@/hooks/use-scroll-edges";

const sizes = (el: HTMLElement, scrollHeight: number, clientHeight: number) => {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
};

function Probe({ contentKey }: { contentKey: number }) {
  const { ref, edges } = useScrollEdges<HTMLDivElement>(contentKey);
  return (
    <div ref={ref} data-testid="box">
      {`above:${edges.above} below:${edges.below}`}
    </div>
  );
}

describe("useScrollEdges", () => {
  it("reports nothing when the content fits", () => {
    render(<Probe contentKey={1} />);

    expect(screen.getByText("above:false below:false")).toBeInTheDocument();
  });

  it("tracks the edges as the box scrolls", () => {
    const { rerender } = render(<Probe contentKey={1} />);
    const box = screen.getByTestId("box");
    sizes(box, 500, 200);
    rerender(<Probe contentKey={2} />);

    expect(screen.getByText("above:false below:true")).toBeInTheDocument();

    act(() => {
      box.scrollTop = 150;
      fireEvent.scroll(box);
    });
    expect(screen.getByText("above:true below:true")).toBeInTheDocument();

    act(() => {
      box.scrollTop = 300;
      fireEvent.scroll(box);
    });
    expect(screen.getByText("above:true below:false")).toBeInTheDocument();
  });
});

describe("scrollEdgeMask", () => {
  it.each([
    [{ above: false, below: false }, ""],
    [{ above: false, below: true }, "transparent)]"],
    [{ above: true, below: false }, "transparent,black_2.5rem)]"],
    [{ above: true, below: true }, "black_calc(100%-2.5rem),transparent)]"],
  ])("fades the open edges of %o", (edges, ending) => {
    expect(scrollEdgeMask(edges).endsWith(ending)).toBe(true);
  });
});
