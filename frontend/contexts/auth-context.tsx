"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiClient } from "@/lib/api";
import {
  authJson,
  authRequest,
  fetchCurrentSession,
  fetchPlexOAuthEnabled,
  logoutRequest,
  type SetupStatusResponse,
} from "@/lib/auth/api";
import { backendErrorMessage } from "@/lib/auth/backend-error";
import {
  isAdminUser,
  SIGNED_OUT,
  type AdminUser,
  type Session,
  type User,
  type UserType,
} from "@/lib/auth/user";

export {
  isAdminUser,
  isPlexUser,
  type AdminUser,
  type PlexUser,
  type User,
  type UserType,
} from "@/lib/auth/user";

interface AuthUserResponse {
  user: User;
}

interface PlexLoginResponse extends AuthUserResponse {
  userType: UserType;
}

type PlexLinkResponse = Pick<
  AdminUser,
  "plexUserId" | "plexUsername" | "plexEmail" | "plexThumb"
>;

const NO_PLEX_LINK: PlexLinkResponse = {
  plexUserId: undefined,
  plexUsername: undefined,
  plexEmail: undefined,
  plexThumb: undefined,
};

export interface AuthContextType {
  user: User | null;
  userType: UserType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  backendError: string | null;
  plexOAuthEnabled: boolean;
  login: (
    username: string,
    password: string,
    captchaToken?: string,
  ) => Promise<void>;
  loginWithPlex: (authToken: string) => Promise<void>;
  logout: () => Promise<void>;
  createAdmin: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string,
  ) => Promise<void>;
  checkAuth: () => Promise<void>;
  retryConnection: () => Promise<void>;
  updateProfile: (data: {
    username?: string;
    email?: string;
    avatarUrl?: string;
  }) => Promise<void>;
  updatePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    clearSessions?: boolean;
  }) => Promise<void>;
  linkPlexAccount: (authToken: string) => Promise<void>;
  unlinkPlexAccount: () => Promise<void>;
  refreshPlexOAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const asError = (error: unknown, fallback: string) =>
  error instanceof Error ? error : new Error(fallback);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [plexOAuthEnabled, setPlexOAuthEnabled] = useState(false);

  const applySession = useCallback((session: Session) => {
    setUser(session.user);
    setUserType(session.userType);
  }, []);

  const checkPlexOAuthEnabled = useCallback(async () => {
    try {
      const enabled = await fetchPlexOAuthEnabled();
      if (enabled !== undefined) setPlexOAuthEnabled(enabled);
    } catch (error) {
      console.error("Failed to check Plex OAuth status:", error);
    }
  }, []);

  const loadSession = useCallback(
    async (setupResponse: Response) => {
      const setupData = (await setupResponse.json()) as SetupStatusResponse;
      setSetupRequired(setupData.setupRequired);
      await checkPlexOAuthEnabled();
      if (!setupData.setupRequired) {
        applySession(await fetchCurrentSession());
      }
    },
    [applySession, checkPlexOAuthEnabled],
  );

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    setBackendError(null);
    try {
      const setupResponse = await fetch("/api/pg/auth/check-setup");
      if (!setupResponse.ok) {
        throw new Error(
          `Backend returned ${setupResponse.status}: ${setupResponse.statusText}`,
        );
      }
      await loadSession(setupResponse);
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      applySession(SIGNED_OUT);
      setBackendError(backendErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [applySession, loadSession]);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  const login = async (
    username: string,
    password: string,
    captchaToken?: string,
  ) => {
    const data = await authJson<AuthUserResponse>(
      "/api/pg/auth/login",
      { method: "POST", body: { username, password, captchaToken } },
      "Login failed",
    );
    applySession({ user: data.user, userType: "admin" });
  };

  const loginWithPlex = async (authToken: string) => {
    const data = await authJson<PlexLoginResponse>(
      "/api/pg/auth/plex/login",
      { method: "POST", body: { authToken } },
      "Plex login failed",
    );
    applySession(data);
  };

  const logout = async () => {
    await logoutRequest();
    applySession(SIGNED_OUT);
  };

  const createAdmin = async (
    username: string,
    email: string,
    password: string,
    confirmPassword: string,
  ) => {
    const data = await authJson<AuthUserResponse>(
      "/api/pg/auth/create-admin",
      {
        method: "POST",
        body: { username, email, password, confirmPassword },
      },
      "Failed to create admin",
    );
    setUser(data.user);
    setSetupRequired(false);
  };

  const checkAuth = async () => {
    try {
      await loadSession(await fetch("/api/pg/auth/check-setup"));
    } catch (error) {
      console.error("Failed to check auth:", error);
      applySession(SIGNED_OUT);
    }
  };

  const updateProfile = async (data: {
    username?: string;
    email?: string;
    avatarUrl?: string;
  }) => {
    try {
      setUser(await apiClient.updateProfile<User>(data));
    } catch (error) {
      throw asError(error, "Failed to update profile");
    }
  };

  const updatePassword = async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    clearSessions?: boolean;
  }) => {
    try {
      await apiClient.updatePassword(data);
    } catch (error) {
      throw asError(error, "Failed to update password");
    }
  };

  const applyPlexLink = (link: PlexLinkResponse) => {
    if (isAdminUser(user)) {
      setUser({ ...user, ...link });
    }
  };

  const linkPlexAccount = async (authToken: string) => {
    const data = await authJson<PlexLinkResponse>(
      "/api/pg/auth/plex/link",
      { method: "POST", body: { authToken } },
      "Failed to link Plex account",
    );
    applyPlexLink({
      plexUserId: data.plexUserId,
      plexUsername: data.plexUsername,
      plexEmail: data.plexEmail,
      plexThumb: data.plexThumb,
    });
    await checkPlexOAuthEnabled();
  };

  const unlinkPlexAccount = async () => {
    await authRequest(
      "/api/pg/auth/plex/link",
      { method: "DELETE" },
      "Failed to unlink Plex account",
    );
    applyPlexLink(NO_PLEX_LINK);
    await checkPlexOAuthEnabled();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userType,
        isAuthenticated: !!user,
        isLoading,
        setupRequired,
        backendError,
        plexOAuthEnabled,
        login,
        loginWithPlex,
        logout,
        createAdmin,
        checkAuth,
        retryConnection: initAuth,
        updateProfile,
        updatePassword,
        linkPlexAccount,
        unlinkPlexAccount,
        refreshPlexOAuthStatus: checkPlexOAuthEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
