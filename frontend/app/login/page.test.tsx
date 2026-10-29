import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

const retryConnection = jest.fn();
let auth = {
  isLoading: false,
  isAuthenticated: false,
  backendError: null as string | null,
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ ...auth, retryConnection }),
}));

const toggleTheme = jest.fn();
let theme = "light";
jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme, toggleTheme }),
}));

jest.mock("@/components/login/LoginForm", () => ({
  LoginForm: ({ theme }: { theme: string }) => <p>{`form:${theme}`}</p>,
}));

jest.mock("@/components/error-handler", () => ({
  ErrorHandler: ({
    backendError,
    onRetry,
  }: {
    backendError: string;
    onRetry: () => void;
  }) => <button onClick={onRetry}>{backendError}</button>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  theme = "light";
  auth = { isLoading: false, isAuthenticated: false, backendError: null };
});

describe("LoginPage", () => {
  it("shows a loader while checking the session", () => {
    auth.isLoading = true;
    render(<LoginPage />);

    expect(screen.queryByText(/form:/)).toBeNull();
  });

  it("offers a retry when the backend is unreachable", async () => {
    auth.backendError = "Backend unavailable";
    render(<LoginPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Backend unavailable" }),
    );
    expect(retryConnection).toHaveBeenCalled();
  });

  it("renders nothing once signed in", () => {
    auth.isAuthenticated = true;
    const { container } = render(<LoginPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the sign-in card with the current theme", () => {
    render(<LoginPage />);

    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByText("form:light")).toBeInTheDocument();
  });

  it("toggles the theme", async () => {
    theme = "dark";
    render(<LoginPage />);

    await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(toggleTheme).toHaveBeenCalled();
    expect(screen.getByText("form:dark")).toBeInTheDocument();
  });
});
