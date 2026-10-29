import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupForm } from "./SetupForm";

const createAdmin = jest.fn<Promise<void>, [string, string, string, string]>();
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ createAdmin }),
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

const STRONG = "Str0ng!Passw0rd";

beforeEach(() => {
  jest.clearAllMocks();
  createAdmin.mockResolvedValue(undefined);
});

describe("SetupForm", () => {
  it("shows the field errors", async () => {
    render(<SetupForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "admin@localhost");
    await user.click(
      screen.getByRole("button", { name: "Create administrator account" }),
    );

    expect(
      screen.getByText("Username must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Password must meet every requirement listed below"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveClass("border-red-500");
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("ticks the password requirements as they are met", async () => {
    render(<SetupForm />);
    const user = userEvent.setup();

    expect(screen.getByText("Uppercase letter (A-Z)")).toHaveClass(
      "text-muted-foreground",
    );
    await user.type(screen.getByLabelText("Password"), "A");

    expect(screen.getByText("Uppercase letter (A-Z)")).toHaveClass(
      "text-emerald-700",
    );
    expect(screen.getByText("Number (0-9)")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("creates the administrator account", async () => {
    render(<SetupForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), STRONG);
    await user.type(screen.getByLabelText("Confirm password"), STRONG);
    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.click(
      screen.getByRole("button", { name: "Create administrator account" }),
    );

    expect(createAdmin).toHaveBeenCalledWith(
      "admin",
      "admin@example.com",
      STRONG,
      STRONG,
    );
  });

  it("disables the form while creating the account", async () => {
    createAdmin.mockReturnValue(new Promise<void>(() => {}));
    render(<SetupForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), STRONG);
    await user.type(screen.getByLabelText("Confirm password"), STRONG);
    await user.click(
      screen.getByRole("button", { name: "Create administrator account" }),
    );

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });
});
