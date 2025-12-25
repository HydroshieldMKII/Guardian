"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ThreeDotLoader } from "@/components/three-dot-loader";

const PUBLIC_ROUTES = ["/login", "/setup"];
const USER_PORTAL_ROUTES = ["/portal"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, setupRequired, backendError, userType } =
    useAuth();

  useEffect(() => {
    if (isLoading || backendError) {
      return;
    }

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isUserPortalRoute = USER_PORTAL_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    // If setup is required, redirect to setup page (unless already there)
    if (setupRequired && pathname !== "/setup") {
      router.push("/setup");
      return;
    }

    // If setup is complete but user is on setup page, redirect appropriately
    if (!setupRequired && pathname === "/setup") {
      if (userType === "plex_user") {
        router.push("/portal");
      } else {
        router.push("/");
      }
      return;
    }

    // If not authenticated and not on a public route, redirect to login
    if (!isAuthenticated && !isPublicRoute && !setupRequired) {
      router.push("/login");
      return;
    }

    // If authenticated and on login page, redirect appropriately
    if (isAuthenticated && pathname === "/login") {
      if (userType === "plex_user") {
        router.push("/portal");
      } else {
        router.push("/");
      }
      return;
    }

    // Plex users can only access /portal routes
    if (isAuthenticated && userType === "plex_user" && !isUserPortalRoute) {
      router.push("/portal");
      return;
    }

    // Admins cannot access /portal - redirect to dashboard
    if (isAuthenticated && userType === "admin" && isUserPortalRoute) {
      router.push("/");
      return;
    }
  }, [
    isAuthenticated,
    isLoading,
    setupRequired,
    pathname,
    router,
    backendError,
    userType,
  ]);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isUserPortalRoute = USER_PORTAL_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const shouldRenderContent =
    !isLoading && // Auth check complete
    !backendError && // No backend errors
    (isPublicRoute || // Public routes always render
      (isAuthenticated && !setupRequired) || // Authenticated users on protected routes
      setupRequired); // Setup page renders during setup

  // Additional check for Plex users - they can only see portal
  const plexUserAllowed =
    userType !== "plex_user" || isUserPortalRoute || isPublicRoute;

  // Additional check for Admins - they cannot access portal
  const adminAllowed =
    userType !== "admin" || !isUserPortalRoute || isPublicRoute;

  // Show loading state while checking auth or redirecting
  if (!shouldRenderContent || !plexUserAllowed || !adminAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ThreeDotLoader />
      </div>
    );
  }

  return <>{children}</>;
}
