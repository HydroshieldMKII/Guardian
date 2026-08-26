import { render } from "@testing-library/react";
import { useDisableScroll } from "./use-disable-scroll";

const mockPathname = jest.fn<string, []>();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

function Consumer() {
  useDisableScroll();
  return null;
}

const overflow = () => ({
  root: document.documentElement.style.overflow,
  body: document.body.style.overflow,
});

beforeEach(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
});

describe("useDisableScroll", () => {
  it.each(["/login", "/setup"])("locks scrolling on %s", (pathname) => {
    mockPathname.mockReturnValue(pathname);
    render(<Consumer />);
    expect(overflow()).toEqual({ root: "hidden", body: "hidden" });
  });

  it.each(["/", "/settings", "/portal"])(
    "leaves scrolling alone on %s",
    (pathname) => {
      mockPathname.mockReturnValue(pathname);
      render(<Consumer />);
      expect(overflow()).toEqual({ root: "", body: "" });
    },
  );

  it("restores scrolling on unmount", () => {
    mockPathname.mockReturnValue("/login");
    const { unmount } = render(<Consumer />);
    expect(overflow()).toEqual({ root: "hidden", body: "hidden" });

    unmount();
    expect(overflow()).toEqual({ root: "", body: "" });
  });

  it("releases the lock when navigating away from an auth page", () => {
    mockPathname.mockReturnValue("/login");
    const { rerender } = render(<Consumer />);
    expect(overflow().body).toBe("hidden");

    mockPathname.mockReturnValue("/settings");
    rerender(<Consumer />);
    expect(overflow().body).toBe("");
  });
});
