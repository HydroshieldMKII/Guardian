import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalVersionMismatchBanner } from "@/components/global-version-mismatch-banner";

const refreshVersionInfo = jest.fn();
let versionInfo: Record<string, unknown> | null = null;

jest.mock("@/contexts/version-context", () => ({
  useVersion: () => ({ versionInfo, refreshVersionInfo }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  versionInfo = null;
});

describe("GlobalVersionMismatchBanner", () => {
  it("stays hidden without version info", () => {
    const { container } = render(<GlobalVersionMismatchBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when the versions agree", () => {
    versionInfo = { isVersionMismatch: false };
    const { container } = render(<GlobalVersionMismatchBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names both versions on a mismatch", () => {
    versionInfo = {
      isVersionMismatch: true,
      databaseVersion: "2.1.0",
      codeVersion: "2.0.0",
    };
    render(<GlobalVersionMismatchBanner />);

    expect(
      screen.getByText("Critical Version Mismatch Detected"),
    ).toBeInTheDocument();
    expect(screen.getByText(/2\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0\.0/)).toBeInTheDocument();
  });

  it("refreshes on demand without dismissing", async () => {
    versionInfo = { isVersionMismatch: true };
    const user = userEvent.setup();
    render(<GlobalVersionMismatchBanner />);

    await user.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(refreshVersionInfo).toHaveBeenCalled();
    expect(
      screen.getByText("Critical Version Mismatch Detected"),
    ).toBeInTheDocument();
  });

  it("hides for the rest of the session once dismissed", async () => {
    versionInfo = { isVersionMismatch: true };
    const user = userEvent.setup();
    const { container } = render(<GlobalVersionMismatchBanner />);

    await user.click(
      screen.getByRole("button", { name: "Dismiss (until page reload)" }),
    );

    expect(container).toBeEmptyDOMElement();
  });
});
