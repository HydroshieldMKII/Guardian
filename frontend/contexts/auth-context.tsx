"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiClient } from "@/lib/api";

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  backendError: string | null;
  login: (username: string, password: string) => Promise<void>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  const initAuth = async () => {
    setIsLoading(true);
    setBackendError(null);
    try {
      // Check setup status
      const setupRes = await fetch("/api/pg/auth/check-setup");

      if (!setupRes.ok) {
        throw new Error(
          `Backend returned ${setupRes.status}: ${setupRes.statusText}`,
        );
      }

      const setupData = await setupRes.json();
      setSetupRequired(setupData.setupRequired);

      // Get current user if authenticated
      if (!setupData.setupRequired) {
        const userRes = await fetch("/api/pg/auth/me", {
          credentials: "include",
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      setUser(null);

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
  };

  const logout = async () => {
    const response = await fetch("/api/pg/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      setUser(null);
    } else {
      throw new Error("Logout failed");
    }
  };

  const createAdmin = async (
    username: string,
    email: string,
    password: string,
    confirmPassword: string,
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

      if (!setupData.setupRequired) {
        const userRes = await fetch("/api/pg/auth/me", {
          credentials: "include",
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error("Failed to check auth:", error);
      setUser(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        setupRequired,
        backendError,
        login,
        logout,
        createAdmin,
        checkAuth,
        retryConnection,
        updateProfile,
        updatePassword,
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
