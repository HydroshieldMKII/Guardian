import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/auth-guard";

const push = jest.fn();
const router = { push };
let pathname = "/";

jest.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

let auth = {
  isAuthenticated: false,
  isLoading: false,
  setupRequired: false,
  backendError: null as string | null,
  userType: "admin" as "admin" | "plex_user" | null,
  retryConnection: jest.fn(),
};

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => auth,
}));

const renderGuard = () =>
  render(
    <AuthGuard>
      <div>protected content</div>
    </AuthGuard>,
  );

const shown = () => screen.queryByText("protected content") !== null;

beforeEach(() => {
  jest.clearAllMocks();
  pathname = "/";
  auth = {
    isAuthenticated: true,
    isLoading: false,
    setupRequired: false,
    backendError: null,
    userType: "admin",
    retryConnection: jest.fn(),
  };
});

describe("AuthGuard", () => {
  it("renders an authenticated admin on a protected route", () => {
    renderGuard();
    expect(shown()).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("holds everything back while auth is still loading", () => {
    auth.isLoading = true;
    renderGuard();

    expect(shown()).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  describe("a backend that will not answer", () => {
    it("explains the failure instead of spinning forever", () => {
      auth.backendError = "The Guardian backend service encountered an error.";
      renderGuard();

      expect(shown()).toBe(false);
      expect(screen.getByText("Cannot Reach Guardian")).toBeInTheDocument();
      expect(
        screen.getByText("The Guardian backend service encountered an error."),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("offers a retry", () => {
      auth.backendError = "offline";
      renderGuard();

      expect(
        screen.getByRole("button", { name: "Retry Connection" }),
      ).toBeInTheDocument();
    });

    it("reports the failure on a public route too", () => {
      pathname = "/login";
      auth.isAuthenticated = false;
      auth.backendError = "offline";
      renderGuard();

      expect(shown()).toBe(false);
      expect(screen.getByText("Cannot Reach Guardian")).toBeInTheDocument();
    });

    it("reports the failure before setup has ever run", () => {
      auth.isAuthenticated = false;
      auth.setupRequired = true;
      auth.backendError = "offline";
      renderGuard();

      expect(shown()).toBe(false);
      expect(screen.getByText("Cannot Reach Guardian")).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("setup", () => {
    it("sends an unconfigured instance to /setup", () => {
      auth.setupRequired = true;
      auth.isAuthenticated = false;
      renderGuard();

      expect(push).toHaveBeenCalledWith("/setup");
    });

    it("renders the setup page itself", () => {
      auth.setupRequired = true;
      auth.isAuthenticated = false;
      pathname = "/setup";
      renderGuard();

      expect(shown()).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it("sends an admin off /setup once setup is complete", () => {
      pathname = "/setup";
      renderGuard();

      expect(push).toHaveBeenCalledWith("/");
    });

    it("sends a Plex user off /setup to the portal", () => {
      pathname = "/setup";
      auth.userType = "plex_user";
      renderGuard();

      expect(push).toHaveBeenCalledWith("/portal");
    });
  });

  describe("login", () => {
    it("sends an anonymous visitor to /login", () => {
      auth.isAuthenticated = false;
      renderGuard();

      expect(push).toHaveBeenCalledWith("/login");
      expect(shown()).toBe(false);
    });

    it("renders /login for an anonymous visitor", () => {
      auth.isAuthenticated = false;
      pathname = "/login";
      renderGuard();

      expect(shown()).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it("sends an authenticated admin off /login", () => {
      pathname = "/login";
      renderGuard();

      expect(push).toHaveBeenCalledWith("/");
    });

    it("sends an authenticated Plex user off /login to the portal", () => {
      pathname = "/login";
      auth.userType = "plex_user";
      renderGuard();

      expect(push).toHaveBeenCalledWith("/portal");
    });
  });

  describe("portal boundaries", () => {
    it("keeps a Plex user inside /portal", () => {
      auth.userType = "plex_user";
      pathname = "/";
      renderGuard();

      expect(push).toHaveBeenCalledWith("/portal");
      expect(shown()).toBe(false);
    });

    it("renders /portal for a Plex user", () => {
      auth.userType = "plex_user";
      pathname = "/portal";
      renderGuard();

      expect(shown()).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it("treats a nested portal path as inside the portal", () => {
      auth.userType = "plex_user";
      pathname = "/portal/devices";
      renderGuard();

      expect(shown()).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it("keeps an admin out of /portal", () => {
      pathname = "/portal";
      renderGuard();

      expect(push).toHaveBeenCalledWith("/");
      expect(shown()).toBe(false);
    });
  });
});
