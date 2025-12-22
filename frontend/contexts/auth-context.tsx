"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiClient } from "@/lib/api";

// Admin user type
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  plexUserId?: string;
  plexUsername?: string;
  plexEmail?: string;
  plexThumb?: string;
}

// Plex user type (non-admin)
export interface PlexUser {
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
}

// Combined user type
export type User = AdminUser | PlexUser;

// Type guards
export function isAdminUser(user: User | null): user is AdminUser {
  return user !== null && "id" in user && "username" in user;
}

export function isPlexUser(user: User | null): user is PlexUser {
  return user !== null && "plexUserId" in user && !("id" in user);
}

export type UserType = "admin" | "plex_user";

export interface AuthContextType {
  user: User | null;
  userType: UserType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  backendError: string | null;
  plexOAuthEnabled: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithPlex: (authToken: string) => Promise<void>;
  logout: () => Promise<void>;
  createAdmin: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [plexOAuthEnabled, setPlexOAuthEnabled] = useState(false);

  const checkPlexOAuthEnabled = async () => {
    try {
      const res = await fetch("/api/pg/auth/plex/enabled");
      if (res.ok) {
        const data = await res.json();
        setPlexOAuthEnabled(data.enabled);
      }
    } catch (error) {
      console.error("Failed to check Plex OAuth status:", error);
    }
  };

  const initAuth = async () => {
    setIsLoading(true);
    setBackendError(null);
    try {
      // Check setup status
      const setupRes = await fetch("/api/pg/auth/check-setup");

      if (!setupRes.ok) {
        throw new Error(
          `Backend returned ${setupRes.status}: ${setupRes.statusText}`
        );
      }

      const setupData = await setupRes.json();
      setSetupRequired(setupData.setupRequired);

      // Check Plex OAuth status
      await checkPlexOAuthEnabled();

      // Get current user if authenticated
      if (!setupData.setupRequired) {
        const userRes = await fetch("/api/pg/auth/me", {
          credentials: "include",
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          // Determine user type from response
          if (userData.id) {
            // Admin user
            setUser(userData as AdminUser);
            setUserType("admin");
          } else if (userData.plexUserId) {
            // Plex user
            setUser(userData as PlexUser);
            setUserType("plex_user");
          } else {
            setUser(null);
            setUserType(null);
          }
        } else {
          setUser(null);
          setUserType(null);
        }
      }
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      setUser(null);
      setUserType(null);

      // Distinguish between network errors and server errors
      let errorMessage = "Unable to connect to Guardian backend service.";

      if (error instanceof TypeError) {
        // Network/connection errors
        errorMessage =
          "Unable to reach Guardian backend service. Please ensure the service is running and accessible.";
      } else if (error instanceof Error) {
        // Server errors with specific codes
        const msg = error.message;
        if (msg.includes("500")) {
          errorMessage =
            "The Guardian backend service encountered an internal error.";
        } else if (msg.includes("502") || msg.includes("503")) {
          errorMessage =
            "The Guardian backend service is temporarily unavailable. Please try again shortly.";
        } else if (msg.includes("404")) {
          errorMessage =
            "The Guardian backend service is not properly configured. Please check your setup.";
        } else {
          errorMessage =
            "The Guardian backend service is not responding correctly. Please try again.";
        }
      }

      setBackendError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Check authentication and setup status on mount
  useEffect(() => {
    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch("/api/pg/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();
    setUser(data.user);
    setUserType("admin");
  };

  const loginWithPlex = async (authToken: string) => {
    const response = await fetch("/api/pg/auth/plex/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ authToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Plex login failed");
    }

    const data = await response.json();
    setUser(data.user);
    setUserType(data.userType);
  };

  const logout = async () => {
    const response = await fetch("/api/pg/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      setUser(null);
      setUserType(null);
    } else {
      throw new Error("Logout failed");
    }
  };

  const createAdmin = async (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    const response = await fetch("/api/pg/auth/create-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        username,
        email,
        password,
        confirmPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create admin");
    }

    const data = await response.json();
    setUser(data.user);
    setSetupRequired(false);
  };

  const checkAuth = async () => {
    try {
      const setupRes = await fetch("/api/pg/auth/check-setup");
      const setupData = await setupRes.json();
      setSetupRequired(setupData.setupRequired);

      // Check Plex OAuth status
      await checkPlexOAuthEnabled();

      if (!setupData.setupRequired) {
        const userRes = await fetch("/api/pg/auth/me", {
          credentials: "include",
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          // Determine user type from response
          if (userData.id) {
            setUser(userData as AdminUser);
            setUserType("admin");
          } else if (userData.plexUserId) {
            setUser(userData as PlexUser);
            setUserType("plex_user");
          } else {
            setUser(null);
            setUserType(null);
          }
        } else {
          setUser(null);
          setUserType(null);
        }
      }
    } catch (error) {
      console.error("Failed to check auth:", error);
      setUser(null);
      setUserType(null);
    }
  };

  const retryConnection = async () => {
    await initAuth();
  };

  const updateProfile = async (data: {
    username?: string;
    email?: string;
    avatarUrl?: string;
  }) => {
    try {
      const updatedUser = await apiClient.updateProfile(data);
      setUser(updatedUser as User);
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Failed to update profile");
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
      throw error instanceof Error
        ? error
        : new Error("Failed to update password");
    }
  };

  const linkPlexAccount = async (authToken: string) => {
    const response = await fetch("/api/pg/auth/plex/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ authToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to link Plex account");
    }

    const data = await response.json();

    // Update user with Plex info
    if (user && isAdminUser(user)) {
      setUser({
        ...user,
        plexUserId: data.plexUserId,
        plexUsername: data.plexUsername,
        plexEmail: data.plexEmail,
        plexThumb: data.plexThumb,
      });
    }

    // Refresh Plex OAuth status since an admin linked their account
    await checkPlexOAuthEnabled();
  };

  const unlinkPlexAccount = async () => {
    const response = await fetch("/api/pg/auth/plex/link", {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to unlink Plex account");
    }

    // Update user to remove Plex info
    if (user && isAdminUser(user)) {
      setUser({
        ...user,
        plexUserId: undefined,
        plexUsername: undefined,
        plexEmail: undefined,
        plexThumb: undefined,
      });
    }

    // Refresh Plex OAuth status
    await checkPlexOAuthEnabled();
  };

  const refreshPlexOAuthStatus = async () => {
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
        retryConnection,
        updateProfile,
        updatePassword,
        linkPlexAccount,
        unlinkPlexAccount,
        refreshPlexOAuthStatus,
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
