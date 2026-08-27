import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/navbar";

const push = jest.fn();
const router = { push };
let pathname = "/";
jest.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

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

let versionInfo: { isVersionMismatch?: boolean } | null = null;
jest.mock("@/contexts/version-context", () => ({
  useVersion: () => ({ versionInfo }),
}));

const logout = jest.fn();
let auth = {
  user: null as Record<string, unknown> | null,
  userType: "admin" as string | null,
  setupRequired: false,
  isAuthenticated: true,
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ ...auth, logout }),
  isAdminUser: (user: Record<string, unknown> | null) =>
    Boolean(user && "username" in user),
  isPlexUser: (user: Record<string, unknown> | null) =>
    Boolean(user && "plexUsername" in user),
}));

const setShowUnsavedWarning = jest.fn();
const setPendingNavigation = jest.fn();
let unsaved = {
  hasUnsavedChanges: false,
  showUnsavedWarning: false,
  pendingNavigation: null as string | null,
  onSaveAndLeave: null as (() => Promise<void>) | null,
  onDiscardChanges: null as (() => void) | null,
};
jest.mock("@/contexts/unsaved-changes-context", () => ({
  useUnsavedChanges: () => ({
    ...unsaved,
    setShowUnsavedWarning,
    setPendingNavigation,
  }),
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

jest.mock("@/components/notification-menu", () => ({
  NotificationMenu: () => <span>notification-menu</span>,
}));

jest.mock("@/components/edit-profile-modal", () => ({
  EditProfileModal: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (value: boolean) => void;
  }) => (
    <div>
      <span>{`profile:${open}`}</span>
      <button onClick={() => onOpenChange(false)}>close profile</button>
    </div>
  ),
}));

const admin = { username: "testuser", email: "test@example.com" };

const openUserMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    document.querySelector('[aria-haspopup="menu"]') as HTMLElement,
  );
  await screen.findByRole("menu");
};

beforeEach(() => {
  jest.clearAllMocks();
  pathname = "/";
  theme = "light";
  versionInfo = null;
  auth = {
    user: admin,
    userType: "admin",
    setupRequired: false,
    isAuthenticated: true,
  };
  unsaved = {
    hasUnsavedChanges: false,
    showUnsavedWarning: false,
    pendingNavigation: null,
    onSaveAndLeave: null,
    onDiscardChanges: null,
  };
  logout.mockResolvedValue(undefined);
});

describe("Navbar visibility", () => {
  it.each([
    ["during setup", { setupRequired: true }, "/"],
    ["when signed out", { isAuthenticated: false }, "/"],
    ["for a Plex user", { userType: "plex_user" }, "/"],
  ])("renders nothing %s", (_label, overrides, path) => {
    auth = { ...auth, ...overrides };
    pathname = path;
    const { container } = render(<Navbar />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["/login", "/setup"])("renders nothing on %s", (path) => {
    pathname = path;
    const { container } = render(<Navbar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders for a signed-in admin", () => {
    render(<Navbar />);
    expect(screen.getByText("notification-menu")).toBeInTheDocument();
  });
});

describe("Navbar theme toggle", () => {
  it("offers dark mode while light", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    await user.click(button);

    expect(toggleTheme).toHaveBeenCalled();
  });

  it("offers light mode while dark", () => {
    theme = "dark";
    render(<Navbar />);
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });
});

describe("Navbar settings link", () => {
  it("marks a version mismatch with a dot", () => {
    versionInfo = { isVersionMismatch: true };
    const { container } = render(<Navbar />);
    expect(container.querySelector(".bg-red-500")).not.toBeNull();
  });

  it("shows no dot when versions agree", () => {
    versionInfo = { isVersionMismatch: false };
    const { container } = render(<Navbar />);
    expect(container.querySelector(".bg-red-500")).toBeNull();
  });
});

describe("Navbar user menu", () => {
  it("is hidden without a user", () => {
    auth.user = null;
    render(<Navbar />);
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it("renders no identity at all without a user", () => {
    auth.user = null;
    render(<Navbar />);

    expect(screen.getByText("notification-menu")).toBeInTheDocument();
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it("shows an admin's name, email and initials", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await openUserMenu(user);

    expect(screen.getAllByText("testuser").length).toBeGreaterThan(0);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("T").length).toBeGreaterThan(0);
  });

  it("shows a Plex user's name and no email", async () => {
    auth.user = { plexUsername: "plex person", plexThumb: "/t.png" };
    const user = userEvent.setup();
    render(<Navbar />);
    await openUserMenu(user);

    expect(screen.getAllByText("plex person").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PP").length).toBeGreaterThan(0);
  });

  it("falls back to a question mark for an unrecognised user shape", async () => {
    auth.user = { id: "x" };
    const user = userEvent.setup();
    render(<Navbar />);
    await openUserMenu(user);

    expect(screen.getAllByText("?").length).toBeGreaterThan(0);
  });

  it("falls back to a question mark for an empty display name", async () => {
    auth.user = { username: "" };
    const user = userEvent.setup();
    render(<Navbar />);
    await openUserMenu(user);

    expect(screen.getAllByText("?").length).toBeGreaterThan(0);
  });

  it("opens and closes the profile modal", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    expect(screen.getByText("profile:false")).toBeInTheDocument();

    await openUserMenu(user);
    await user.click(screen.getByText("Edit Profile"));

    expect(screen.getByText("profile:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close profile" }));
    expect(screen.getByText("profile:false")).toBeInTheDocument();
  });

  it("logs out and routes to login", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await openUserMenu(user);

    await user.click(screen.getByText("Logout"));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/login");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("reports a failed logout without routing", async () => {
    logout.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<Navbar />);
    await openUserMenu(user);

    await user.click(screen.getByText("Logout"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Navbar unsaved-changes guard", () => {
  it("lets the logo through when there is nothing to lose", async () => {
    unsaved.hasUnsavedChanges = true;
    pathname = "/";
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getAllByAltText("Guardian")[0]);

    expect(setShowUnsavedWarning).not.toHaveBeenCalled();
  });

  it("intercepts the logo on the settings page with unsaved changes", async () => {
    unsaved.hasUnsavedChanges = true;
    pathname = "/settings";
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getAllByAltText("Guardian")[0]);

    expect(setPendingNavigation).toHaveBeenCalledWith("/");
    expect(setShowUnsavedWarning).toHaveBeenCalledWith(true);
  });

  it("does not intercept on settings without unsaved changes", async () => {
    pathname = "/settings";
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getAllByAltText("Guardian")[0]);

    expect(setShowUnsavedWarning).not.toHaveBeenCalled();
  });

  describe("the warning dialog", () => {
    beforeEach(() => {
      unsaved.showUnsavedWarning = true;
      unsaved.pendingNavigation = "/";
    });

    it("stays on the page when cancelled", async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Stay on Page" }));

      expect(setShowUnsavedWarning).toHaveBeenCalledWith(false);
      expect(setPendingNavigation).toHaveBeenCalledWith(null);
      expect(push).not.toHaveBeenCalled();
    });

    it("closes on escape the same way", async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      await user.keyboard("{Escape}");

      expect(setShowUnsavedWarning).toHaveBeenCalledWith(false);
    });

    it("discards and navigates", async () => {
      const onDiscardChanges = jest.fn();
      unsaved.onDiscardChanges = onDiscardChanges;
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Discard Changes" }));

      expect(onDiscardChanges).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/");
    });

    it("discards without a handler or a destination", async () => {
      unsaved.pendingNavigation = null;
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: "Discard Changes" }));

      expect(push).not.toHaveBeenCalled();
    });

    it("saves without navigating when there is no destination", async () => {
      const onSaveAndLeave = jest.fn().mockResolvedValue(undefined);
      unsaved.onSaveAndLeave = onSaveAndLeave;
      unsaved.pendingNavigation = null;
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: /Save & Leave/ }));

      await waitFor(() => expect(onSaveAndLeave).toHaveBeenCalled());
      expect(push).not.toHaveBeenCalled();
    });

    it("saves then navigates", async () => {
      const onSaveAndLeave = jest.fn().mockResolvedValue(undefined);
      unsaved.onSaveAndLeave = onSaveAndLeave;
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: /Save & Leave/ }));

      await waitFor(() => expect(onSaveAndLeave).toHaveBeenCalled());
      expect(push).toHaveBeenCalledWith("/");
    });

    it("does not navigate when the save throws", async () => {
      const onSaveAndLeave = jest.fn().mockRejectedValue(new Error("nope"));
      unsaved.onSaveAndLeave = onSaveAndLeave;
      render(<Navbar />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Save & Leave/ }));
      });

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "Failed to save your changes",
          }),
        ),
      );
      expect(push).not.toHaveBeenCalled();
      expect(setShowUnsavedWarning).not.toHaveBeenCalledWith(false);
    });

    it("does nothing without a save handler", async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      await user.click(screen.getByRole("button", { name: /Save & Leave/ }));

      expect(push).not.toHaveBeenCalled();
    });
  });
});
