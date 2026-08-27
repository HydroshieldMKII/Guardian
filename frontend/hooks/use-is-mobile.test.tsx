import { act, render, screen } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-is-mobile";

const Probe = ({ breakpoint }: { breakpoint?: number }) => (
  <span>{String(useIsMobile(breakpoint))}</span>
);

const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, value });

const original = window.innerWidth;

afterEach(() => setWidth(original));

describe("useIsMobile", () => {
  it("reads the viewport on mount", () => {
    setWidth(500);
    render(<Probe />);
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("stays false on a wide viewport", () => {
    setWidth(1200);
    render(<Probe />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("follows the viewport as it is resized", () => {
    setWidth(1200);
    render(<Probe />);

    act(() => {
      setWidth(400);
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("true")).toBeInTheDocument();

    act(() => {
      setWidth(900);
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("honours a custom breakpoint", () => {
    setWidth(900);
    render(<Probe breakpoint={1024} />);
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("stops listening once unmounted", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<Probe />);

    unmount();

    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    remove.mockRestore();
  });
});
