import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SetupPage from "@/app/setup/page";

const retryConnection = jest.fn();
let auth = {
  isLoading: false,
  setupRequired: true,
  backendError: null as string | null,
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ ...auth, retryConnection }),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: jest.fn() }),
}));

jest.mock("@/components/setup/SetupForm", () => ({
  SetupForm: () => <p>setup form</p>,
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
  auth = { isLoading: false, setupRequired: true, backendError: null };
});

describe("SetupPage", () => {
  it("shows a loader while checking the setup state", () => {
    auth.isLoading = true;
    render(<SetupPage />);

    expect(screen.queryByText("setup form")).toBeNull();
  });

  it("offers a retry when the backend is unreachable", async () => {
    auth.backendError = "Backend unavailable";
    render(<SetupPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Backend unavailable" }),
    );
    expect(retryConnection).toHaveBeenCalled();
  });

  it("renders nothing once setup is done", () => {
    auth.setupRequired = false;
    const { container } = render(<SetupPage />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the setup card", () => {
    render(<SetupPage />);

    expect(
      screen.getByText("Create your admin account to get started"),
    ).toBeInTheDocument();
    expect(screen.getByText("setup form")).toBeInTheDocument();
  });
});
