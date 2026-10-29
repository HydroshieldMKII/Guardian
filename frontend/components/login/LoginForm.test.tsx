import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

const login = jest.fn<Promise<void>, [string, string, string | undefined]>();
let plexOAuthEnabled = false;
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ login, loginWithPlex: jest.fn(), plexOAuthEnabled }),
}));

const start = jest.fn();
const cancel = jest.fn();
let plex = { loading: false, waiting: false };
jest.mock("@/hooks/use-plex-oauth", () => ({
  usePlexOAuth: () => ({ ...plex, start, cancel }),
}));

const fetchMock = jest.fn();
let status = { enabled: false };

const renderForm = async () => {
  render(<LoginForm theme="light" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  return userEvent.setup();
};

beforeEach(() => {
  jest.clearAllMocks();
  plexOAuthEnabled = false;
  plex = { loading: false, waiting: false };
  status = { enabled: false };
  login.mockResolvedValue(undefined);
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => (url.endsWith("/status") ? status : {}),
    }),
  );
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
});

describe("LoginForm", () => {
  it("flags empty fields", async () => {
    const user = await renderForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      screen.getByText("Username or email is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Username or Email")).toHaveClass(
      "border-red-500",
    );
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in with the entered credentials", async () => {
    const user = await renderForm();

    await user.type(screen.getByLabelText("Username or Email"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(login).toHaveBeenCalledWith("admin", "secret", undefined);
  });

  it("shows why sign-in failed", async () => {
    login.mockRejectedValue(new Error("Invalid credentials"));
    const user = await renderForm();

    await user.type(screen.getByLabelText("Username or Email"), "admin");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("reveals and hides the password", async () => {
    const user = await renderForm();
    const password = screen.getByLabelText("Password");
    const toggle = password.parentElement?.querySelector("button");

    expect(password).toHaveAttribute("type", "password");
    await user.click(toggle as HTMLButtonElement);
    expect(password).toHaveAttribute("type", "text");
    await user.click(toggle as HTMLButtonElement);
    expect(password).toHaveAttribute("type", "password");
  });

  it("links to password recovery only when resets are offered", async () => {
    status = { enabled: true };
    await renderForm();

    expect(
      await screen.findByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("hides password recovery when resets are off", async () => {
    await renderForm();

    expect(screen.queryByText("Forgot password?")).toBeNull();
  });

  it("hides Plex sign-in unless it is enabled", async () => {
    await renderForm();

    expect(screen.queryByText("Sign in with Plex")).toBeNull();
  });

  it("starts Plex sign-in", async () => {
    plexOAuthEnabled = true;
    const user = await renderForm();

    await user.click(screen.getByRole("button", { name: /Sign in with Plex/ }));

    expect(start).toHaveBeenCalled();
    expect(screen.queryByText(/Finish signing in/)).toBeNull();
  });

  it("waits for Plex and lets the user cancel", async () => {
    plexOAuthEnabled = true;
    plex = { loading: true, waiting: true };
    const user = await renderForm();

    expect(screen.getByText("Waiting for Plex...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "cancel" }));
    expect(cancel).toHaveBeenCalled();
  });
});
