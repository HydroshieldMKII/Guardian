import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "@/app/reset-password/page";

let token: string | null = "reset-token";

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => token }),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: jest.fn() }),
}));

const fetchMock = jest.fn();

const json = (data: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => data });

const renderPage = async () => {
  const view = render(<ResetPasswordPage />);
  await act(async () => {});
  return { ...view, user: userEvent.setup() };
};

const fillForm = async (
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation = password,
) => {
  await user.type(screen.getByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm new password"), confirmation);
  await user.click(screen.getByRole("button", { name: "Set New Password" }));
};

beforeEach(() => {
  jest.clearAllMocks();
  token = "reset-token";
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/verify") ? json({ valid: true }) : json({ success: true }),
  );
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
});

describe("ResetPasswordPage", () => {
  it("checks the link before showing the form", async () => {
    await renderPage();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pg/auth/password-reset/verify",
      expect.objectContaining({
        body: JSON.stringify({ token: "reset-token" }),
      }),
    );
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("says the link expired when the server rejects it", async () => {
    fetchMock.mockImplementation(() => json({ valid: false }));
    await renderPage();

    expect(screen.getByText("Link Expired")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("says the link expired without checking when there is no token", async () => {
    token = null;
    await renderPage();

    expect(screen.getByText("Link Expired")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the link expired when the check itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await renderPage();

    expect(screen.getByText("Link Expired")).toBeInTheDocument();
  });

  it("says the link expired when the check returns an error status", async () => {
    fetchMock.mockImplementation(() => json({}, false));
    await renderPage();

    expect(screen.getByText("Link Expired")).toBeInTheDocument();
  });

  it("tracks each rule as the password is typed", async () => {
    const { user } = await renderPage();

    expect(screen.getByText("At least 12 characters")).toBeInTheDocument();

    await user.type(screen.getByLabelText("New password"), "BrandNewPass1!");

    expect(screen.getByText("Uppercase letter (A-Z)")).toHaveClass(
      "text-emerald-700",
    );
  });

  it("refuses a password that misses a rule", async () => {
    const { user } = await renderPage();

    await fillForm(user, "short");

    expect(
      screen.getByText(
        "Your password must meet every requirement listed below",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a mismatched confirmation", async () => {
    const { user } = await renderPage();

    await fillForm(user, "BrandNewPass1!", "SomethingElse1!");

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the token with the new password", async () => {
    const { user } = await renderPage();

    await fillForm(user, "BrandNewPass1!");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pg/auth/password-reset/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            token: "reset-token",
            password: "BrandNewPass1!",
            confirmPassword: "BrandNewPass1!",
          }),
        }),
      ),
    );
  });

  it("says the other sessions were signed out", async () => {
    const { user } = await renderPage();

    await fillForm(user, "BrandNewPass1!");

    expect(await screen.findByText("Password Changed")).toBeInTheDocument();
    expect(
      screen.getByText(/Your other devices were signed out/),
    ).toBeInTheDocument();
  });

  it("reports the reason the server gave", async () => {
    const { user } = await renderPage();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/verify")
        ? json({ valid: true })
        : json({ message: "This reset link is no longer valid." }, false),
    );

    await fillForm(user, "BrandNewPass1!");

    expect(
      await screen.findByText("This reset link is no longer valid."),
    ).toBeInTheDocument();
  });

  it("reports the first of a list of validation messages", async () => {
    const { user } = await renderPage();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/verify")
        ? json({ valid: true })
        : json({ message: ["password is too weak", "and too short"] }, false),
    );

    await fillForm(user, "BrandNewPass1!");

    expect(await screen.findByText("password is too weak")).toBeInTheDocument();
  });

  it("falls back to a generic message when the server says nothing", async () => {
    const { user } = await renderPage();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/verify") ? json({ valid: true }) : Promise.reject("boom"),
    );

    await fillForm(user, "BrandNewPass1!");

    expect(
      await screen.findByText("Could not set the new password"),
    ).toBeInTheDocument();
  });

  it("reveals and hides the password", async () => {
    const { user } = await renderPage();

    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password",
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "text",
    );

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password",
    );
  });
});
