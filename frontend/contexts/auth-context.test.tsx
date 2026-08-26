import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  AuthProvider,
  isAdminUser,
  isPlexUser,
  useAuth,
} from "./auth-context";

const updateProfile = jest.fn();
const updatePassword = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    updateProfile: (...args: unknown[]) => updateProfile(...args),
    updatePassword: (...args: unknown[]) => updatePassword(...args),
  },
}));

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const adminUser = {
  id: "admin-1",
  username: "testuser",
  email: "v@example.com",
};

const plexUser = { plexUserId: "plex-9", plexUsername: "guest" };

interface RouteMap {
  [route: string]: () => Response;
}

const routes: RouteMap = {};

const route = (url: RequestInfo | URL) => String(url).split("?")[0];

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const renderAuth = async () => {
  const rendered = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;

  for (const key of Object.keys(routes)) delete routes[key];
  routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: false });
  routes["/api/pg/auth/plex/enabled"] = () => json({ enabled: false });
  routes["/api/pg/auth/me"] = () => json(adminUser);

  fetchMock.mockImplementation(async (url) => {
    const handler = routes[route(url)];
    if (!handler) throw new Error(`unmocked route ${route(url)}`);
    return handler();
  });
});

describe("type guards", () => {
  it("recognises an admin user", () => {
    expect(isAdminUser(adminUser)).toBe(true);
    expect(isAdminUser(plexUser)).toBe(false);
  });

  it("recognises a portal user", () => {
    expect(isPlexUser(plexUser)).toBe(true);
    expect(isPlexUser(adminUser)).toBe(false);
  });

  it("treats no user as neither", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isPlexUser(null)).toBe(false);
  });
});

describe("useAuth", () => {
  it("refuses to be used outside a provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});

describe("initial load", () => {
  it("signs in the admin whose session cookie is still valid", async () => {
    const { result } = await renderAuth();

    expect(result.current.user).toEqual(adminUser);
    expect(result.current.userType).toBe("admin");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.setupRequired).toBe(false);
  });

  it("signs in a portal user", async () => {
    routes["/api/pg/auth/me"] = () => json(plexUser);

    const { result } = await renderAuth();

    expect(result.current.userType).toBe("plex_user");
    expect(result.current.user).toEqual(plexUser);
  });

  it("leaves the visitor signed out when the session has expired", async () => {
    routes["/api/pg/auth/me"] = () => json({}, { status: 401 });

    const { result } = await renderAuth();

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("leaves the visitor signed out when the response identifies nobody", async () => {
    routes["/api/pg/auth/me"] = () => json({ something: "else" });

    const { result } = await renderAuth();
    expect(result.current.user).toBeNull();
  });

  it("skips the user lookup when setup is still required", async () => {
    routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: true });

    const { result } = await renderAuth();

    expect(result.current.setupRequired).toBe(true);
    expect(
      fetchMock.mock.calls.some(([url]) => route(url) === "/api/pg/auth/me"),
    ).toBe(false);
  });

  it("reflects whether Plex sign-in is available", async () => {
    routes["/api/pg/auth/plex/enabled"] = () => json({ enabled: true });

    const { result } = await renderAuth();
    expect(result.current.plexOAuthEnabled).toBe(true);
  });

  it("leaves Plex sign-in unavailable when the check returns an error status", async () => {
    routes["/api/pg/auth/plex/enabled"] = () =>
      new Response("", { status: 503 });

    const { result } = await renderAuth();
    expect(result.current.plexOAuthEnabled).toBe(false);
  });

  it("carries on when the Plex availability check fails", async () => {
    routes["/api/pg/auth/plex/enabled"] = () => {
      throw new Error("offline");
    };

    const { result } = await renderAuth();

    expect(result.current.plexOAuthEnabled).toBe(false);
    expect(result.current.backendError).toBeNull();
  });

  it.each([
    [500, "encountered an internal error"],
    [502, "temporarily unavailable"],
    [503, "temporarily unavailable"],
    [404, "not properly configured"],
    [418, "not responding correctly"],
  ])("explains a %s from the backend", async (status, expected) => {
    routes["/api/pg/auth/check-setup"] = () => json({}, { status });

    const { result } = await renderAuth();

    expect(result.current.backendError).toContain(expected);
    expect(result.current.user).toBeNull();
  });

  it("explains an unreachable backend", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = await renderAuth();

    expect(result.current.backendError).toContain("Unable to reach Guardian");
  });

  it("clears the error on a successful retry", async () => {
    routes["/api/pg/auth/check-setup"] = () => json({}, { status: 500 });
    const { result } = await renderAuth();
    expect(result.current.backendError).not.toBeNull();

    routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: false });
    await act(async () => {
      await result.current.retryConnection();
    });

    expect(result.current.backendError).toBeNull();
    expect(result.current.user).toEqual(adminUser);
  });
});

describe("login", () => {
  it("signs the admin in", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/login"] = () => json({ user: adminUser });

    await act(async () => {
      await result.current.login("testuser", "hunter2");
    });

    expect(result.current.userType).toBe("admin");
    expect(result.current.user).toEqual(adminUser);
  });

  it("sends the captcha token when there is one", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/login"] = () => json({ user: adminUser });

    await act(async () => {
      await result.current.login("testuser", "hunter2", "captcha-token");
    });

    const call = fetchMock.mock.calls.find(
      ([url]) => route(url) === "/api/pg/auth/login",
    );
    expect(JSON.parse(call![1]!.body as string)).toEqual({
      username: "testuser",
      password: "hunter2",
      captchaToken: "captcha-token",
    });
  });

  it("surfaces the server's rejection without signing anyone in", async () => {
    routes["/api/pg/auth/me"] = () => json({}, { status: 401 });
    const { result } = await renderAuth();
    routes["/api/pg/auth/login"] = () =>
      json({ message: "Invalid credentials" }, { status: 401 });

    await expect(
      act(async () => {
        await result.current.login("testuser", "wrong");
      }),
    ).rejects.toThrow("Invalid credentials");
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("falls back to a generic message", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/login"] = () => json({}, { status: 401 });

    await expect(
      act(async () => {
        await result.current.login("testuser", "wrong");
      }),
    ).rejects.toThrow("Login failed");
  });
});

describe("loginWithPlex", () => {
  it("signs in whichever kind of user Plex resolves to", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/login"] = () =>
      json({ user: plexUser, userType: "plex_user" });

    await act(async () => {
      await result.current.loginWithPlex("plex-token");
    });

    expect(result.current.userType).toBe("plex_user");
    expect(result.current.user).toEqual(plexUser);
  });

  it("surfaces the server's rejection", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/login"] = () =>
      json({ message: "no access to this server" }, { status: 401 });

    await expect(
      act(async () => {
        await result.current.loginWithPlex("plex-token");
      }),
    ).rejects.toThrow("no access to this server");
  });

  it("falls back to a generic message", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/login"] = () => json({}, { status: 401 });

    await expect(
      act(async () => {
        await result.current.loginWithPlex("plex-token");
      }),
    ).rejects.toThrow("Plex login failed");
  });
});

describe("logout", () => {
  it("clears the signed-in user", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/logout"] = () => json({ success: true });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.userType).toBeNull();
  });

  it("keeps the user signed in when logout fails", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/logout"] = () => json({}, { status: 500 });

    await expect(
      act(async () => {
        await result.current.logout();
      }),
    ).rejects.toThrow("Logout failed");
    expect(result.current.user).toEqual(adminUser);
  });
});

describe("createAdmin", () => {
  it("creates the first admin and clears the setup flag", async () => {
    routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: true });
    const { result } = await renderAuth();
    routes["/api/pg/auth/create-admin"] = () => json({ user: adminUser });

    await act(async () => {
      await result.current.createAdmin(
        "testuser",
        "v@example.com",
        "hunter2hunter2",
        "hunter2hunter2",
      );
    });

    expect(result.current.setupRequired).toBe(false);
    expect(result.current.user).toEqual(adminUser);
  });

  it("surfaces the server's rejection", async () => {
    routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: true });
    const { result } = await renderAuth();
    routes["/api/pg/auth/create-admin"] = () =>
      json({ message: "Passwords do not match" }, { status: 400 });

    await expect(
      act(async () => {
        await result.current.createAdmin("testuser", "v@example.com", "a", "b");
      }),
    ).rejects.toThrow("Passwords do not match");
    expect(result.current.setupRequired).toBe(true);
  });

  it("falls back to a generic message", async () => {
    routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: true });
    const { result } = await renderAuth();
    routes["/api/pg/auth/create-admin"] = () => json({}, { status: 400 });

    await expect(
      act(async () => {
        await result.current.createAdmin("testuser", "v@example.com", "a", "a");
      }),
    ).rejects.toThrow("Failed to create admin");
  });
});

describe("checkAuth", () => {
  it("picks up a session that has since appeared", async () => {
    routes["/api/pg/auth/me"] = () => json({}, { status: 401 });
    const { result } = await renderAuth();
    expect(result.current.user).toBeNull();

    routes["/api/pg/auth/me"] = () => json(adminUser);
    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.user).toEqual(adminUser);
  });

  it("picks up a portal session", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/me"] = () => json(plexUser);

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.userType).toBe("plex_user");
  });

  it("clears the user when the response identifies nobody", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/me"] = () => json({ something: "else" });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.user).toBeNull();
  });

  it("clears the user when the session has expired", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/me"] = () => json({}, { status: 401 });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.user).toBeNull();
  });

  it("skips the user lookup when setup is required again", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/check-setup"] = () => json({ setupRequired: true });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.setupRequired).toBe(true);
  });

  it("signs the user out when the check fails", async () => {
    const { result } = await renderAuth();
    fetchMock.mockRejectedValue(new Error("offline"));

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.userType).toBeNull();
  });
});

describe("profile and password", () => {
  it("applies the updated profile to the signed-in user", async () => {
    const { result } = await renderAuth();
    updateProfile.mockResolvedValue({ ...adminUser, username: "renamed" });

    await act(async () => {
      await result.current.updateProfile({ username: "renamed" });
    });

    expect(updateProfile).toHaveBeenCalledWith({ username: "renamed" });
    expect(result.current.user).toMatchObject({ username: "renamed" });
  });

  it("propagates a profile failure", async () => {
    const { result } = await renderAuth();
    updateProfile.mockRejectedValue(new Error("Username already exists"));

    await expect(
      act(async () => {
        await result.current.updateProfile({ username: "taken" });
      }),
    ).rejects.toThrow("Username already exists");
  });

  it("wraps a non-Error profile failure", async () => {
    const { result } = await renderAuth();
    updateProfile.mockRejectedValue("boom");

    await expect(
      act(async () => {
        await result.current.updateProfile({ username: "x" });
      }),
    ).rejects.toThrow("Failed to update profile");
  });

  it("changes the password", async () => {
    const { result } = await renderAuth();
    updatePassword.mockResolvedValue(undefined);

    const payload = {
      currentPassword: "old",
      newPassword: "new",
      confirmPassword: "new",
    };
    await act(async () => {
      await result.current.updatePassword(payload);
    });

    expect(updatePassword).toHaveBeenCalledWith(payload);
  });

  it("propagates a password failure", async () => {
    const { result } = await renderAuth();
    updatePassword.mockRejectedValue(
      new Error("Current password is incorrect"),
    );

    await expect(
      act(async () => {
        await result.current.updatePassword({
          currentPassword: "wrong",
          newPassword: "new",
          confirmPassword: "new",
        });
      }),
    ).rejects.toThrow("Current password is incorrect");
  });

  it("wraps a non-Error password failure", async () => {
    const { result } = await renderAuth();
    updatePassword.mockRejectedValue("boom");

    await expect(
      act(async () => {
        await result.current.updatePassword({
          currentPassword: "a",
          newPassword: "b",
          confirmPassword: "b",
        });
      }),
    ).rejects.toThrow("Failed to update password");
  });
});

describe("linking a Plex account", () => {
  const linked = {
    plexUserId: "plex-9",
    plexUsername: "guest",
    plexEmail: "guest@example.com",
    plexThumb: "thumb.png",
  };

  it("stores the Plex identity on the admin", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json(linked);

    await act(async () => {
      await result.current.linkPlexAccount("plex-token");
    });

    expect(result.current.user).toMatchObject(linked);
  });

  it("re-checks whether Plex sign-in is now available", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json(linked);
    routes["/api/pg/auth/plex/enabled"] = () => json({ enabled: true });

    await act(async () => {
      await result.current.linkPlexAccount("plex-token");
    });

    expect(result.current.plexOAuthEnabled).toBe(true);
  });

  it("leaves a portal user's record alone", async () => {
    routes["/api/pg/auth/me"] = () => json(plexUser);
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json(linked);

    await act(async () => {
      await result.current.linkPlexAccount("plex-token");
    });

    expect(result.current.user).toEqual(plexUser);
  });

  it("surfaces the server's rejection", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () =>
      json({ message: "already linked elsewhere" }, { status: 400 });

    await expect(
      act(async () => {
        await result.current.linkPlexAccount("plex-token");
      }),
    ).rejects.toThrow("already linked elsewhere");
  });

  it("falls back to a generic link message", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json({}, { status: 400 });

    await expect(
      act(async () => {
        await result.current.linkPlexAccount("plex-token");
      }),
    ).rejects.toThrow("Failed to link Plex account");
  });

  it("leaves a signed-out visitor alone when unlinking", async () => {
    routes["/api/pg/auth/me"] = () => new Response("", { status: 401 });
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json({ success: true });

    await act(async () => {
      await result.current.unlinkPlexAccount();
    });

    expect(result.current.user).toBeNull();
  });

  it("clears the Plex identity when unlinking", async () => {
    routes["/api/pg/auth/me"] = () => json({ ...adminUser, ...linked });
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json({ success: true });

    await act(async () => {
      await result.current.unlinkPlexAccount();
    });

    expect(result.current.user).toMatchObject({
      plexUserId: undefined,
      plexUsername: undefined,
    });
  });

  it("surfaces a rejection when unlinking", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () =>
      json({ message: "not linked" }, { status: 400 });

    await expect(
      act(async () => {
        await result.current.unlinkPlexAccount();
      }),
    ).rejects.toThrow("not linked");
  });

  it("falls back to a generic unlink message", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/link"] = () => json({}, { status: 400 });

    await expect(
      act(async () => {
        await result.current.unlinkPlexAccount();
      }),
    ).rejects.toThrow("Failed to unlink Plex account");
  });

  it("re-checks Plex availability on demand", async () => {
    const { result } = await renderAuth();
    routes["/api/pg/auth/plex/enabled"] = () => json({ enabled: true });

    await act(async () => {
      await result.current.refreshPlexOAuthStatus();
    });

    expect(result.current.plexOAuthEnabled).toBe(true);
  });
});
