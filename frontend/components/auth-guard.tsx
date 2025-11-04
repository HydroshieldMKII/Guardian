"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ThreeDotLoader } from "@/components/three-dot-loader";

const PUBLIC_ROUTES = ["/login", "/setup"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, setupRequired, backendError } = useAuth();

  useEffect(() => {
    if (isLoading || backendError) {
      return;
    }

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    // If setup is required, redirect to setup page (unless already there)
    if (setupRequired && pathname !== "/setup") {
      router.push("/setup");
      return;
    }

    // If setup is complete but user is on setup page, redirect to dashboard
    if (!setupRequired && pathname === "/setup") {
      router.push("/");
      return;
    }

    // If not authenticated and not on a public route, redirect to login
    if (!isAuthenticated && !isPublicRoute && !setupRequired) {
      router.push("/login");
      return;
    }

    // If authenticated and on login page, redirect to dashboard
    if (isAuthenticated && pathname === "/login") {
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
  ]);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const shouldRenderContent =
    !isLoading && // Auth check complete
    !backendError && // No backend errors
    (isPublicRoute || // Public routes always render
      (isAuthenticated && !setupRequired) || // Authenticated users on protected routes
      setupRequired); // Setup page renders during setup

  // Show loading state while checking auth or redirecting
  if (!shouldRenderContent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ThreeDotLoader />
      </div>
    );
  }

  return <>{children}</>;
}
