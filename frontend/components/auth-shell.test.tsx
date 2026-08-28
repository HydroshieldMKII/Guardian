import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthShell } from "@/components/auth-shell";

const toggleTheme = jest.fn();
let theme = "dark";

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme, toggleTheme }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  theme = "dark";
});

const renderShell = (
  props: Partial<React.ComponentProps<typeof AuthShell>> = {},
) =>
  render(
    <AuthShell
      title="Forgot Password"
      description="Enter your email"
      {...props}
    >
      {props.children ?? <p>form goes here</p>}
    </AuthShell>,
  );

describe("AuthShell", () => {
  it("names the page and explains it", () => {
    renderShell();

    expect(screen.getByText("Forgot Password")).toBeInTheDocument();
    expect(screen.getByText("Enter your email")).toBeInTheDocument();
  });

  it("renders what it wraps", () => {
    renderShell();
    expect(screen.getByText("form goes here")).toBeInTheDocument();
  });

  it("offers a way back to sign in by default", () => {
    renderShell();

    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("lets a page supply its own footer instead", () => {
    renderShell({ footer: <p>ask the owner</p> });

    expect(screen.getByText("ask the owner")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to sign in" })).toBeNull();
  });

  it("toggles the theme", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(toggleTheme).toHaveBeenCalled();
  });
});
