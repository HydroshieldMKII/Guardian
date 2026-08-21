import { fireEvent, render, screen } from "@testing-library/react";
import { useSwipeToRefresh } from "./useSwipeToRefresh";

type Options = Parameters<typeof useSwipeToRefresh>[0];

function Pullable(props: Options) {
  const handlers = useSwipeToRefresh(props);
  return (
    <div data-testid="surface" {...handlers}>
      surface
    </div>
  );
}

const setScrollTop = (value: number) => {
  Object.defineProperty(document.documentElement, "scrollTop", {
    configurable: true,
    value,
  });
  Object.defineProperty(window, "pageYOffset", {
    configurable: true,
    value,
  });
};

const setup = (options: Omit<Options, "onRefresh"> = {}) => {
  const onRefresh = jest.fn();
  render(<Pullable onRefresh={onRefresh} {...options} />);
  return { onRefresh, surface: screen.getByTestId("surface") };
};

const touch = (clientY: number) => ({ touches: [{ clientY }] });

beforeEach(() => {
  setScrollTop(0);
});

describe("useSwipeToRefresh", () => {
  it("fires onRefresh once the pull passes the threshold", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("ignores a pull that stops short of the threshold", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(50));
    fireEvent.touchEnd(surface);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("respects a custom threshold", () => {
    const { onRefresh, surface } = setup({ threshold: 20 });

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(30));
    fireEvent.touchEnd(surface);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const { onRefresh, surface } = setup({ enabled: false });

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("ignores an upward swipe", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchStart(surface, touch(200));
    fireEvent.touchMove(surface, touch(0));
    fireEvent.touchEnd(surface);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("stops tracking when the page is scrolled away from the top", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchStart(surface, touch(0));
    setScrollTop(400);
    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("ignores a move that never started", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("resets between gestures so a second release does not re-fire", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);
    fireEvent.touchEnd(surface);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("tracks a fresh gesture after a completed one", () => {
    const { onRefresh, surface } = setup();

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);

    fireEvent.touchStart(surface, touch(0));
    fireEvent.touchMove(surface, touch(150));
    fireEvent.touchEnd(surface);

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
