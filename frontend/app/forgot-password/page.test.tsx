import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "@/app/forgot-password/page";

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: jest.fn() }),
}));

const fetchMock = jest.fn();

const json = (data: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => data });

const renderPage = async () => {
  const view = render(<ForgotPasswordPage />);
  await act(async () => {});
  return { ...view, user: userEvent.setup() };
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/status") ? json({ enabled: true }) : json({ success: true }),
  );
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
});

describe("ForgotPasswordPage", () => {
  it("asks the server whether resets are offered", async () => {
    await renderPage();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pg/auth/password-reset/status",
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("explains what is missing when resets are off", async () => {
    fetchMock.mockImplementation(() => json({ enabled: false }));
    await renderPage();

    expect(
      screen.getByText(/does not offer password resets/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("treats an unreadable status as unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await renderPage();

    expect(
      screen.getByText(/does not offer password resets/),
    ).toBeInTheDocument();
  });

  it("treats a failed status request as unavailable", async () => {
    fetchMock.mockImplementation(() => json({}, false));
    await renderPage();

    expect(
      screen.getByText(/does not offer password resets/),
    ).toBeInTheDocument();
  });

  it("sends the address it was given", async () => {
    const { user } = await renderPage();

    await user.type(screen.getByLabelText("Email"), "  owner@example.com  ");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pg/auth/password-reset/request",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "owner@example.com" }),
        }),
      ),
    );
  });

  it("says the same thing whether or not the address is registered", async () => {
    const { user } = await renderPage();

    await user.type(screen.getByLabelText("Email"), "stranger@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByText("Check Your Email")).toBeInTheDocument();
    expect(
      screen.getByText(/never disclosed/),
    ).toBeInTheDocument();
  });

  it("refuses to submit an empty address", async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(
      screen.getByText("Enter the email address on your account"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a rate limit rather than claiming success", async () => {
    const { user } = await renderPage();
    fetchMock.mockImplementation(() =>
      json({ message: "Too many password reset requests." }, false),
    );

    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(
      await screen.findByText("Too many password reset requests."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Check Your Email")).toBeNull();
  });

  it("falls back to a generic message when the server says nothing", async () => {
    const { user } = await renderPage();
    fetchMock.mockRejectedValue("boom");

    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(
      await screen.findByText("Could not send the email"),
    ).toBeInTheDocument();
  });

  it("offers a way back to sign in", async () => {
    await renderPage();

    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });
});
