import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthLayout } from "./AuthLayout";

const toggleTheme = jest.fn();

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme }),
}));

const renderLayout = () =>
  render(
    <AuthLayout>
      <p>form goes here</p>
    </AuthLayout>,
  );

describe("AuthLayout", () => {
  it("renders the form as the page content", () => {
    renderLayout();

    expect(screen.getByRole("main")).toHaveTextContent("form goes here");
  });

  it("keeps the backdrop out of reach of readers and clicks", () => {
    renderLayout();

    const backdrop = screen.getByTestId("auth-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden");
    expect(backdrop).toHaveClass("pointer-events-none");
  });

  it("toggles the theme", async () => {
    renderLayout();

    await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(toggleTheme).toHaveBeenCalled();
  });
});
