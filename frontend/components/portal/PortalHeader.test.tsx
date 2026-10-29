import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalHeader } from "@/components/portal/PortalHeader";
import type { User } from "@/contexts/auth-context";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

const toggleTheme = jest.fn();
let theme = "light";
jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme, toggleTheme }),
}));

const toast = jest.fn<void, [unknown]>();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const logout = jest.fn<Promise<void>, []>();
let user: User | null = null;
jest.mock("@/contexts/auth-context", () => ({
  ...jest.requireActual<typeof import("@/contexts/auth-context")>(
    "@/contexts/auth-context",
  ),
  useAuth: () => ({ user, logout }),
}));

const plexUser: User = {
  plexUserId: "plex-1",
  plexUsername: "viewer",
  plexThumb: "https://example.com/viewer.png",
};

const renderHeader = (refreshing = false) => {
  const onRefresh = jest.fn();
  render(<PortalHeader refreshing={refreshing} onRefresh={onRefresh} />);
  return { onRefresh, events: userEvent.setup() };
};

beforeEach(() => {
  jest.clearAllMocks();
  theme = "light";
  user = plexUser;
  logout.mockResolvedValue(undefined);
});

describe("PortalHeader", () => {
  it("shows the Plex user's name and initial", () => {
    renderHeader();

    expect(screen.getByText("viewer")).toBeInTheDocument();
    expect(screen.getByText("V")).toBeInTheDocument();
  });

  it.each(["", "https://example.com/avatar.png"])(
    "names a linked admin by their username (avatar %p)",
    (avatarUrl) => {
      user = {
        id: "1",
        username: "owner",
        email: "owner@example.com",
        avatarUrl,
        plexThumb: "https://example.com/owner.png",
      };
      renderHeader();

      expect(screen.getByText("owner")).toBeInTheDocument();
    },
  );

  it("falls back to a generic name without a user", () => {
    user = null;
    renderHeader();

    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("refreshes on request", async () => {
    const { onRefresh, events } = renderHeader();

    await events.click(screen.getByRole("button", { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it.each([
    ["light", "Switch to dark mode"],
    ["dark", "Switch to light mode"],
  ])("toggles the theme from %s", async (current, title) => {
    theme = current;
    const { events } = renderHeader();

    await events.click(screen.getByTitle(title));

    expect(toggleTheme).toHaveBeenCalled();
  });

  it("signs out to the login page", async () => {
    const { events } = renderHeader();

    await events.click(screen.getByTitle("Logout"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("says when signing out failed", async () => {
    logout.mockRejectedValue(new Error("offline"));
    const { events } = renderHeader();

    await events.click(screen.getByTitle("Logout"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to sign out" }),
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
