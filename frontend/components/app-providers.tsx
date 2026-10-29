"use client";

import React, { Suspense, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-client";
import { VersionProvider } from "@/contexts/version-context";
import { UnsavedChangesProvider } from "@/contexts/unsaved-changes-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { GlobalVersionMismatchBanner } from "@/components/global-version-mismatch-banner";
import { GlobalUpdateBanner } from "@/components/global-update-banner";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import { useDisableScroll } from "@/hooks/use-disable-scroll";

function AppProvidersContent({ children }: { children: React.ReactNode }) {
  useDisableScroll();

  return (
    <VersionProvider>
      <UnsavedChangesProvider>
        <ErrorBoundary>
          <GlobalVersionMismatchBanner />
          <GlobalUpdateBanner />
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          {children}
        </ErrorBoundary>
        <Toaster />
      </UnsavedChangesProvider>
    </VersionProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvidersContent>{children}</AppProvidersContent>
    </QueryClientProvider>
  );
}
