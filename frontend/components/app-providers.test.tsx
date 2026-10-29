import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { AppProviders } from "@/components/app-providers";

const useDisableScroll = jest.fn<void, []>();
jest.mock("@/hooks/use-disable-scroll", () => ({
  useDisableScroll: () => useDisableScroll(),
}));

function mockProvider(name: string) {
  function MockProvider({ children }: { children: React.ReactNode }) {
    return (
      <div>
        <span>{name}</span>
        {children}
      </div>
    );
  }
  return MockProvider;
}

jest.mock("@/contexts/version-context", () => ({
  VersionProvider: mockProvider("version-provider"),
}));
jest.mock("@/contexts/settings-context", () => ({
  SettingsProvider: mockProvider("settings-provider"),
}));
jest.mock("@/contexts/unsaved-changes-context", () => ({
  UnsavedChangesProvider: mockProvider("unsaved-provider"),
}));
jest.mock("@/components/error-boundary", () => ({
  ErrorBoundary: mockProvider("error-boundary"),
}));
jest.mock("@/components/global-version-mismatch-banner", () => ({
  GlobalVersionMismatchBanner: () => <span>version-banner</span>,
}));
jest.mock("@/components/global-update-banner", () => ({
  GlobalUpdateBanner: () => <span>update-banner</span>,
}));
jest.mock("@/components/navbar", () => ({
  Navbar: () => <span>navbar</span>,
}));
jest.mock("@/components/ui/toaster", () => ({
  Toaster: () => <span>toaster</span>,
}));

describe("AppProviders", () => {
  it("renders its children inside the whole provider stack", () => {
    render(
      <AppProviders>
        <div>page content</div>
      </AppProviders>,
    );

    for (const name of [
      "version-provider",
      "settings-provider",
      "unsaved-provider",
      "error-boundary",
      "version-banner",
      "update-banner",
      "navbar",
      "toaster",
      "page content",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("hands the same query client to every page it renders", () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useQueryClient());
      return null;
    }

    const { rerender } = render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    rerender(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it("disables scroll for the app shell", () => {
    render(
      <AppProviders>
        <div>page content</div>
      </AppProviders>,
    );
    expect(useDisableScroll).toHaveBeenCalled();
  });

  it("keeps the toaster outside the error boundary", () => {
    const { container } = render(
      <AppProviders>
        <div>page content</div>
      </AppProviders>,
    );

    const boundary = screen.getByText("error-boundary").parentElement;
    expect(boundary).not.toBeNull();
    expect(boundary?.textContent).not.toContain("toaster");
    expect(container.textContent).toContain("toaster");
  });
});
