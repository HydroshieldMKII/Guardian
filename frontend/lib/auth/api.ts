import {
  SIGNED_OUT,
  type AdminUser,
  type PlexUser,
  type Session,
} from "./user";

interface ErrorResponse {
  message?: string;
}

export interface SetupStatusResponse {
  setupRequired: boolean;
}

interface PlexOAuthEnabledResponse {
  enabled: boolean;
}

type CurrentUserResponse = Partial<AdminUser> & Partial<PlexUser>;

interface AuthRequestInit {
  method: "POST" | "DELETE";
  body?: unknown;
}

export async function authRequest(
  url: string,
  init: AuthRequestInit,
  fallback: string,
): Promise<Response> {
  const response = await fetch(url, {
    method: init.method,
    ...(init.body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(init.body),
    }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message || fallback);
  }

  return response;
}

export async function authJson<T>(
  url: string,
  init: AuthRequestInit,
  fallback: string,
): Promise<T> {
  const response = await authRequest(url, init, fallback);
  return (await response.json()) as T;
}

export async function logoutRequest(): Promise<void> {
  const response = await fetch("/api/pg/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Logout failed");
}

export async function fetchPlexOAuthEnabled(): Promise<boolean | undefined> {
  const response = await fetch("/api/pg/auth/plex/enabled");
  if (!response.ok) return undefined;
  const data = (await response.json()) as PlexOAuthEnabledResponse;
  return data.enabled;
}

export async function fetchCurrentSession(): Promise<Session> {
  const response = await fetch("/api/pg/auth/me", { credentials: "include" });
  if (!response.ok) return SIGNED_OUT;

  const data = (await response.json()) as CurrentUserResponse;
  if (data.id) return { user: data as AdminUser, userType: "admin" };
  if (data.plexUserId) return { user: data as PlexUser, userType: "plex_user" };
  return SIGNED_OUT;
}
