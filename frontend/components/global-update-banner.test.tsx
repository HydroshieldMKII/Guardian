import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalUpdateBanner } from "@/components/global-update-banner";

const checkForUpdatesManually = jest.fn();
const clearUpdateInfo = jest.fn();
let updateInfo: Record<string, unknown> | null = null;

jest.mock("@/contexts/version-context", () => ({
  useVersion: () => ({ updateInfo, checkForUpdatesManually, clearUpdateInfo }),
}));

jest.mock("@/components/ui/release-notes-modal", () => ({
  ReleaseNotesModal: ({
    isOpen,
    latestVersion,
    releaseNotes,
    onClose,
  }: {
    isOpen: boolean;
    latestVersion: string;
    releaseNotes: string;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>{`notes:${latestVersion}:${releaseNotes}`}</span>
        <button onClick={onClose}>close notes</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  updateInfo = {
    hasUpdate: true,
    latestVersion: "2.0.0",
    currentVersion: "1.3.5",
    releaseNotes: "Lots of fixes",
    updateUrl: "https://example.test",
  };
});

describe("GlobalUpdateBanner", () => {
  it("stays hidden without update info", () => {
    updateInfo = null;
    const { container } = render(<GlobalUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when there is no update", () => {
    updateInfo = { hasUpdate: false };
    const { container } = render(<GlobalUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names both versions", () => {
    render(<GlobalUpdateBanner />);

    expect(
      screen.getByText("Update Available: Guardian v2.0.0"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\.3\.5/)).toBeInTheDocument();
  });

  it("opens and closes the release notes", async () => {
    const user = userEvent.setup();
    render(<GlobalUpdateBanner />);

    expect(screen.queryByText(/^notes:/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /See what's new/ }));
    expect(screen.getByText("notes:2.0.0:Lots of fixes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close notes" }));
    expect(screen.queryByText(/^notes:/)).toBeNull();
  });

  it("passes an empty string when there are no release notes", async () => {
    updateInfo = { ...updateInfo, releaseNotes: undefined };
    const user = userEvent.setup();
    render(<GlobalUpdateBanner />);

    await user.click(screen.getByRole("button", { name: /See what's new/ }));

    expect(screen.getByText("notes:2.0.0:")).toBeInTheDocument();
  });

  it("opens the updating instructions in a new tab", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<GlobalUpdateBanner />);

    await user.click(screen.getByRole("button", { name: /How to Update/ }));

    expect(open).toHaveBeenCalledWith(
      "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
      "_blank",
    );
    open.mockRestore();
  });

  it("clears the update on dismiss and stays hidden", async () => {
    const user = userEvent.setup();
    const { container } = render(<GlobalUpdateBanner />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(clearUpdateInfo).toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
