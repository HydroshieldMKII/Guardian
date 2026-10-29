"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PageLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";
import {
  AUTH_ROUTES,
  loginPathReturningTo,
  returnPathFrom,
} from "@/lib/auth/return-to";

const USER_PORTAL_ROUTES = ["/portal"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isAuthenticated,
    isLoading,
    setupRequired,
    backendError,
    userType,
    retryConnection,
  } = useAuth();

  useEffect(() => {
    if (isLoading || backendError) {
      return;
    }

    const isPublicRoute = AUTH_ROUTES.includes(pathname);
    const isUserPortalRoute = USER_PORTAL_ROUTES.some((route) =>
      pathname.startsWith(route),
    );

    if (setupRequired && pathname !== "/setup") {
      router.push("/setup");
      return;
    }

    if (!setupRequired && pathname === "/setup") {
      if (userType === "plex_user") {
        router.push("/portal");
      } else {
        router.push("/");
      }
      return;
    }

    if (!isAuthenticated && !isPublicRoute && !setupRequired) {
      router.push(
        loginPathReturningTo(
          `${pathname}${window.location.search}${window.location.hash}`,
        ),
      );
      return;
    }

    if (isAuthenticated && pathname === "/login") {
      if (userType === "plex_user") {
        router.push("/portal");
      } else {
        router.push(returnPathFrom(window.location.search) ?? "/");
      }
      return;
    }

    if (isAuthenticated && userType === "plex_user" && !isUserPortalRoute) {
      router.push("/portal");
      return;
    }

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

  const isPublicRoute = AUTH_ROUTES.includes(pathname);
  const isUserPortalRoute = USER_PORTAL_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  const shouldRenderContent =
    !isLoading &&
    (isPublicRoute || (isAuthenticated && !setupRequired) || setupRequired);

  const plexUserAllowed =
    userType !== "plex_user" || isUserPortalRoute || isPublicRoute;

  const adminAllowed =
    userType !== "admin" || !isUserPortalRoute || isPublicRoute;

  if (backendError) {
    return (
      <ErrorHandler
        backendError={backendError}
        onRetry={() => void retryConnection()}
      />
    );
  }

  if (!shouldRenderContent || !plexUserAllowed || !adminAllowed) {
    return <PageLoader />;
  }

  return <>{children}</>;
}
