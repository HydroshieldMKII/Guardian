"use client";

import React from "react";
import { VersionProvider } from "@/contexts/version-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { GlobalVersionMismatchBanner } from "@/components/global-version-mismatch-banner";
import { GlobalUpdateBanner } from "@/components/global-update-banner";
import { Navbar } from "@/components/navbar";
import { GlobalNotificationHandler } from "@/components/global-notification-handler";
import { Toaster } from "@/components/ui/toaster";
import { useDisableScroll } from "@/hooks/use-disable-scroll";

function AppProvidersContent({ children }: { children: React.ReactNode }) {
  useDisableScroll();

  return (
    <VersionProvider>
      <NotificationProvider>
        <SettingsProvider>
          <ErrorBoundary>
            <GlobalVersionMismatchBanner />
            <GlobalUpdateBanner />
            <Navbar />
            <GlobalNotificationHandler />
            {children}
          </ErrorBoundary>
          <Toaster />
        </SettingsProvider>
      </NotificationProvider>
    </VersionProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppProvidersContent>{children}</AppProvidersContent>;
}
